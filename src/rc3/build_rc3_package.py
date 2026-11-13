"""RC3 · isolated, deterministic preview package builder. Builds; never deploys; never touches a frozen package.

  python3 src/rc3/build_rc3_package.py [--out deploy/second-look-rc3-candidate] [--media-mode hardlink|copy|none]
                                       [--media-dir deploy/second-look-rc21-study/public/media] [--label rc3]

Rules (D-43):
  * REFUSES any output that is, or is inside: deploy/second-look-rc21-study (live study), deploy/second-look-vercel (original demo),
    deploy/second-look-rc2-candidate, any source tree, support/, prototype/, backup/, snapshots/.
  * No study layer: no /api/study, /api/research, no research console, no Neon dependency. /api/log is a NO-OP (returns 204 and stores
    nothing), so an RC3 preview can never write into the P01–P09 study. A ?t= study link fails closed in RC3 (no API to resolve it).
  * Site gate = HTTP Basic (SITE_USER / SITE_PASSWORD), FAIL CLOSED: without SITE_PASSWORD nothing is served.
  * Media: the five web encodes already QA'd for RC2.1 (default --media-dir) are linked/copied and their SHA-256 must equal the
    RC2.1 MANIFEST values below (RC3 uses exactly the same footage). --media-mode none = code-only package (inspection / CI).
  * Deterministic: files are copied byte-for-byte; MANIFEST.json lists the SHA-256 of every file (its own entry excluded);
    the only time-dependent fields are `built` in MANIFEST.json / BUILD_REPORT.json.
  * Publishing: built in a temporary sibling, validated, then renamed into place; an existing output is RENAMED to
    <out>.prev-<stamp> (never deleted).
  * Vercel link (release prep, 26 Oct 2026): the ONLY project this package may be linked to is pinned in
    src/rc3/vercel_target.json (team gamemind-digital, project second-look-rc3-preview). If the existing output folder is
    linked (.vercel/project.json) to that project, the link file is carried into the new build so a rebuild never orphans
    it (an orphaned folder makes the CLI offer to create/link a project in its DEFAULT team). A link to ANY other project,
    or a pinned org/project id that differs, STOPS the build. .env* files (e.g. VERCEL_OIDC_TOKEN from `vercel link`)
    are never carried, never packaged and are listed in .vercelignore. .vercel/ is excluded from MANIFEST.json.
  * BUILD_REPORT.json records source_sha256 (hash of every file copied from the source tree) so a build is identifiable
    even when RC3 is not yet committed (git describe then names the last commit, not the RC3 tree).
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / 'prototype_wave3b' / 'experience_rc3'
FROZEN = ['deploy/second-look-rc21-study', 'deploy/second-look-vercel', 'deploy/second-look-rc2-candidate']
PROTECTED = [REPO / x for x in FROZEN] + [REPO / x for x in ('support', 'prototype', 'prototype_wave3b', 'backup', 'snapshots', 'src', 'analysis')]
# RC2.1 MANIFEST (deploy/second-look-rc21-study/MANIFEST.json, built 20261021-173312): the exact web encodes RC3 reuses.
MEDIA_SHA = {
  'gp02': '1189e9ea47ab297440f64a670c855485b5bd790192336ae04c2ea425672c3c50', 'gp03': '528e1ec07ad5a6088f016c580a3d99fe1787ebad8b23faf5b2b4788157a19c05',
  'gp04': '931ddbd7dfe9fef627f638917b93175c5ef49e978b24348e1fcbcd7f7bd3845d', 'gp08': '81c2768d0605799d6c35ce8ca983f1f53a992c76b41a346dc9fe0582ef1c22d9',
  'gp09': 'dfd7be9337fa83ad8f2803fca0e9b90aa2b659eeef48ffc5d018dfcd11f8ce5c' }
VERCEL_TARGET = json.loads((REPO / 'src' / 'rc3' / 'vercel_target.json').read_text())
EXCLUDE_PUBLIC = {'observer.html', 'research'}            # local / study research consoles never ship in RC3
SECRET_PATTERNS = [r'postgres(ql)?://', r'npg_[A-Za-z0-9]{8,}', r'STUDY_SECRET\s*=\s*\S', r'RESEARCH_PASSWORD\s*=\s*\S', r'SITE_PASSWORD\s*=\s*\S']
MIDDLEWARE = """// RC3 preview · site gate in front of EVERY path (pages, /data, /media, /api). HTTP Basic with SITE_USER (default "sic") /
// SITE_PASSWORD. FAILS CLOSED: without SITE_PASSWORD nothing is served. No study, no research routes exist in this package.
export const config = { runtime: 'nodejs' };
function eq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const deny = (status, body, extra = {}) => new Response(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extra } });
export default async function middleware(request) {
  const pass = process.env.SITE_PASSWORD;
  if (!pass) return deny(503, 'RC3 preview is not configured (SITE_PASSWORD missing).');
  const user = process.env.SITE_USER || 'sic', h = request.headers.get('authorization') || '';
  let ok = false;
  if (h.startsWith('Basic ')) { let d = ''; try { d = atob(h.slice(6)); } catch {} const i = d.indexOf(':'); ok = i >= 0 && eq(d.slice(0, i), user) && eq(d.slice(i + 1), pass); }
  if (!ok) return deny(401, 'Password required.', { 'WWW-Authenticate': 'Basic realm="Second Look RC3 preview", charset="UTF-8"' });
}
"""
LOG_NOOP = """// RC3 preview · event sink is a NO-OP on purpose: an RC3 preview never collects data and can never write into the RC2.1 study.
// Formative RC3 tests are logged by the LOCAL server (prototype_wave3b/experience_rc3/server.mjs → sessions/*.jsonl).
export default function handler(req, res) { res.setHeader('Cache-Control', 'no-store'); res.status(204).end(); }
"""
VERCEL = {
  '$schema': 'https://openapi.vercel.sh/vercel.json', 'framework': None, 'outputDirectory': 'public', 'cleanUrls': True, 'trailingSlash': False, 'regions': ['fra1'],
  'headers': [
    {'source': '/(.*)', 'headers': [{'key': 'X-Robots-Tag', 'value': 'noindex, nofollow'}, {'key': 'X-Content-Type-Options', 'value': 'nosniff'},
      {'key': 'Referrer-Policy', 'value': 'no-referrer'}, {'key': 'X-Frame-Options', 'value': 'DENY'},
      {'key': 'Permissions-Policy', 'value': 'camera=(), microphone=(), geolocation=(), display-capture=()'}]},
    {'source': '/media/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'private, max-age=86400'}]},
    {'source': '/data/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'private, max-age=300'}]},
    {'source': '/(js|css)/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'private, max-age=60'}]},
    {'source': '/api/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'no-store, private'}]},
    {'source': '/', 'headers': [{'key': 'Cache-Control', 'value': 'private, max-age=0, must-revalidate'}]}]}

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def fail(msg, code=2): print(f'BUILD STOPPED — {msg}\nNothing was written or changed.', file=sys.stderr); sys.exit(code)
def inside(a: Path, b: Path):
    try: a.resolve().relative_to(b.resolve()); return True
    except ValueError: return False

def carried_link(out: Path):
    """Return the existing .vercel/project.json of THIS output folder if (and only if) it is the pinned RC3 preview project."""
    f = out / '.vercel' / 'project.json'
    if not f.is_file(): return None
    try: link = json.loads(f.read_text())
    except Exception: fail(f'{f.relative_to(REPO)} is not valid JSON; inspect it before rebuilding')
    want = VERCEL_TARGET
    if link.get('projectName') != want['project_name']:
        fail(f"{out.relative_to(REPO)} is linked to Vercel project {link.get('projectName')!r}, not {want['project_name']!r}. "
             'Refusing to build over a folder linked to another project. Unlink it (rm -r .vercel) only after checking which project it is.')
    for k_link, k_pin in (('orgId', 'org_id'), ('projectId', 'project_id')):
        if want.get(k_pin) and link.get(k_link) != want[k_pin]:
            fail(f'{k_link} in {f.relative_to(REPO)} = {link.get(k_link)} differs from the pinned {k_pin} = {want[k_pin]} (src/rc3/vercel_target.json). STOP.')
    return link

def required():
    server = (SRC / 'server.mjs').read_text()
    allow = re.compile(re.search(r"p\.match\(/\^\\/data\\/(\(.+?\))\$/\)", server).group(1).replace('\\/', '/'))
    priv = SRC / 'private_data'
    data = sorted(f.name for f in priv.iterdir() if f.is_file() and allow.fullmatch(f.name))
    js = '\n'.join(p.read_text() for p in (SRC / 'public').rglob('*.js'))
    refs = set(re.findall(r'/data/([\w.-]+\.(?:json|jpg|png))', js))
    missing = sorted(refs - set(data))
    if missing: fail(f'the code references /data files that are not in private_data or not allowed: {missing}')
    clips = sorted(set(re.findall(r"'(gp\d\d)'", re.search(r'CLIP_OK = new Set\(\[([^\]]+)\]\)', server).group(1))))
    return data, clips

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='deploy/second-look-rc3-candidate'); ap.add_argument('--label', default='rc3')
    ap.add_argument('--media-mode', choices=['hardlink', 'copy', 'none'], default='hardlink')
    ap.add_argument('--media-dir', default='deploy/second-look-rc21-study/public/media')
    a = ap.parse_args()
    out = (REPO / a.out).resolve()
    for p in PROTECTED:
        if out == p.resolve() or inside(out, p): fail(f'refusing to write into a protected location: {p.relative_to(REPO)}')
    if not str(out.relative_to(REPO)).startswith('deploy/'): fail('output must live under deploy/')
    data, clips = required()
    if sorted(MEDIA_SHA) != clips: fail(f'clip set changed ({clips}); update MEDIA_SHA from a verified manifest first')
    media = {}
    if a.media_mode != 'none':
        md = (REPO / a.media_dir)
        for c in clips:
            f = md / f'{c}.mp4'
            if not f.is_file(): fail(f'missing web encode {f.relative_to(REPO)} (use --media-mode none for a code-only package)')
            if sha(f) != MEDIA_SHA[c]: fail(f'{c}.mp4 differs from the QA-verified RC2.1 encode')
            media[c] = f
    link = carried_link(out) if out.exists() else None
    stamp = time.strftime('%Y%m%d-%H%M%S')
    tmp = out.parent / f'.{out.name}.tmp-{stamp}'; tmp.mkdir(parents=True)
    try:
        pub = tmp / 'public'; shutil.copytree(SRC / 'public', pub, ignore=lambda d, names: [n for n in names if (Path(d) == SRC / 'public' and n in EXCLUDE_PUBLIC) or n == '.DS_Store'])
        (pub / 'data').mkdir()
        for d in data: shutil.copy2(SRC / 'private_data' / d, pub / 'data' / d)
        (pub / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
        if media:
            (pub / 'media').mkdir()
            for c, f in media.items():
                (os.link if a.media_mode == 'hardlink' else shutil.copy2)(f, pub / 'media' / f'{c}.mp4')
        (tmp / 'api').mkdir(); (tmp / 'api' / 'log.js').write_text(LOG_NOOP); (tmp / 'api' / 'debrief.js').write_text(LOG_NOOP)
        (tmp / 'middleware.js').write_text(MIDDLEWARE)
        (tmp / 'vercel.json').write_text(json.dumps(VERCEL, indent=2) + '\n')
        (tmp / 'package.json').write_text(json.dumps({'name': 'second-look-rc3-candidate', 'private': True, 'type': 'module', 'version': '3.0.0',
            'description': 'SECOND LOOK RC3 preview candidate. NOT DEPLOYED. No study layer.', 'engines': {'node': '>=20'}}, indent=2) + '\n')
        (tmp / '.vercelignore').write_text('DEPLOY.md\nMANIFEST.json\nBUILD_REPORT.json\n.env\n.env.*\n.vercel\n'); (tmp / '.gitignore').write_text('.vercel\nnode_modules\n.env*\n')
        try: commit = subprocess.run(['git', '-C', str(REPO), 'describe', '--always', '--dirty', '--tags'], capture_output=True, text=True).stdout.strip()
        except Exception: commit = 'unknown'
        (tmp / 'DEPLOY.md').write_text(f"""# Second Look RC3 · preview candidate — NOT DEPLOYED

Built {stamp} from `prototype_wave3b/experience_rc3` (git `{commit}`) by `src/rc3/build_rc3_package.py`.

* **Never** deploy with `--prod`, never link this folder to the RC2.1 study project, never set a `DATABASE_URL`.
* No study layer: `/api/log` and `/api/debrief` store nothing (204). Formative RC3 tests use the local server.
* Site gate fails closed: set `SITE_USER` / `SITE_PASSWORD` (Preview scope) or nothing is served.
* Media: {'the five RC2.1 web encodes (SHA-256 verified)' if media else 'NOT INCLUDED (code-only build) — rebuild with --media-mode hardlink on the machine that holds the encodes'}.
* Routes: `/` RC3 product · `/?rc3=0` RC2.1.1 behaviour of the same build · `/?lens=shots|follow|hold` a lens from the hub · `/teaser`.
""")
        # ---- validation ----
        tree = sorted(str(p.relative_to(tmp)) for p in tmp.rglob('*') if p.is_file())
        if any(Path(k).name.startswith('.env') for k in tree): raise RuntimeError('an .env file is in the package')
        for bad in ['study_local', 'sessions/', '/qa/', 'test/', '.study_secret', '.research_password', '.site_password', 'node_modules', 'research/', 'observer.html', '.webm', 'private_data', '.vercel/']:
            hits = [k for k in tree if bad in k]
            if hits: raise RuntimeError(f'forbidden file in package: {hits[:3]}')
        if any(k.startswith('api/') and k not in ('api/log.js', 'api/debrief.js') for k in tree): raise RuntimeError('unexpected API route in package')
        for p in tmp.rglob('*'):
            if p.is_file() and p.suffix in ('.js', '.json', '.html', '.md', '.css', '.txt'):
                t = p.read_text(errors='ignore')
                for pat in SECRET_PATTERNS:
                    if re.search(pat, t): raise RuntimeError(f'possible secret in {p.relative_to(tmp)} ({pat})')
        js = '\n'.join(p.read_text() for p in pub.rglob('*.js'))
        for d in set(re.findall(r'/data/([\w.-]+\.(?:json|jpg|png))', js)):
            if not (pub / 'data' / d).exists(): raise RuntimeError(f'/data/{d} referenced but not packaged')
        for c, f in media.items():
            if sha(pub / 'media' / f'{c}.mp4') != MEDIA_SHA[c]: raise RuntimeError(f'media {c} changed while linking')
        src_files = sorted(p for p in (SRC / 'public').rglob('*') if p.is_file() and p.name != '.DS_Store' and not (p.parent == SRC / 'public' and p.name in EXCLUDE_PUBLIC)) + [SRC / 'private_data' / d for d in data]
        src_sha = hashlib.sha256(''.join(f'{p.relative_to(SRC)}:{sha(p)}\n' for p in src_files).encode()).hexdigest()
        report = dict(built=stamp, label=a.label, source='prototype_wave3b/experience_rc3', git=commit, source_sha256=src_sha, deployed=False, media_mode=a.media_mode,
                      data=data, clips=clips if media else [], study_layer=False, log_sink='no-op',
                      vercel_target=dict(team=VERCEL_TARGET['team_slug'], project=VERCEL_TARGET['project_name']), vercel_link_carried=bool(link))
        (tmp / 'BUILD_REPORT.json').write_text(json.dumps(report, indent=1) + '\n')
        files = {str(p.relative_to(tmp)): dict(sha256=sha(p), bytes=p.stat().st_size) for p in sorted(tmp.rglob('*')) if p.is_file()}
        if link:   # carried AFTER validation/manifest: local link metadata, not package content
            (tmp / '.vercel').mkdir(); (tmp / '.vercel' / 'project.json').write_text(json.dumps(link) + '\n')
        (tmp / 'MANIFEST.json').write_text(json.dumps(dict(built=stamp, label=a.label, source=report['source'], git=commit, deployed=False, files=len(files),
            total_mb=round(sum(f['bytes'] for f in files.values()) / 1e6, 1), sha256=files), indent=1) + '\n')
    except Exception as e:
        print(f'BUILD FAILED during staging: {e}\nThe temporary folder {tmp.name} was left for inspection; nothing else was touched.', file=sys.stderr); sys.exit(3)
    prev = None
    if out.exists():
        prev = out.parent / f'{out.name}.prev-{stamp}'; out.rename(prev)
    tmp.rename(out)
    print(json.dumps(dict(out=str(out.relative_to(REPO)), previous_kept_as=str(prev.relative_to(REPO)) if prev else None, files=len(files),
        total_mb=round(sum(f['bytes'] for f in files.values()) / 1e6, 1), media=a.media_mode, git=commit), indent=1))
    print(f"Vercel link carried: {bool(link)} (target {VERCEL_TARGET['team_slug']}/{VERCEL_TARGET['project_name']})")
    print('Built. NOT deployed.')

if __name__ == '__main__':
    main()
