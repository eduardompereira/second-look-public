"""Second Look · PUBLIC EDITION publish gate. Run before every push of the public repository:

    python3 tools/public_gate.py                         # working tree (+ every commit, if this is a git repository)
    SECOND_LOOK_PRIVATE_DENYLIST=/path/to/denylist.json python3 tools/public_gate.py   # maintainers, before publishing

A green gate means: only allow-listed files; no media, data or office files; the fixtures are byte-identical to a fresh
run of the fictional generator (lineage); the generator cannot read any data file; every person in the fixtures and
every player tag in the app is from the fictional roster; the simulation is disclosed; and, with the maintainers'
private denylist, no restricted token appears in any file of any commit. Filenames alone never pass a file.
Exit 0 = publishable. Anything else: do not publish.
"""
import ast, fnmatch, json, os, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ALLOW = ["tools/b1_features.mjs", "tools/lib/reach.mjs", "src/rc3/qa/points_journey.mjs", "README.md", "AUTHORS.md", "LICENSE", "NOTICE.md", "CONTRIBUTING.md", "package.json", ".gitignore",
         ".github/workflows/public-safe.yml", "docs/*.md",
         "fixtures/README.md", "fixtures/setup_fixture.py", "fixtures/payload/*.json",
         "tests/fixture_contract.py", "tests/payload_schema.json",
         "tools/make_fictional_fixtures.py", "tools/public_gate.py", "tools/test_public.sh", "tools/fixture_smoke.mjs",
         "tools/story_clarity_journey.mjs",
         "src/rc3/build_rc3_package.py", "src/rc3/vercel_target.json", "src/rc3/qa/package_gate_check.mjs",
         "src/rc3/qa/rc3_journeys.mjs", "src/rc3/qa/serve_rc3_package.mjs",
         "prototype_wave3b/experience_rc3/.gitignore", "prototype_wave3b/experience_rc3/package.json",
         "prototype_wave3b/experience_rc3/README.md", "prototype_wave3b/experience_rc3/server.mjs",
         "prototype_wave3b/experience_rc3/public/index.html", "prototype_wave3b/experience_rc3/public/css/*.css",
         "prototype_wave3b/experience_rc3/public/js/*.js", "prototype_wave3b/experience_rc3/public/js/*/*.js",
         "prototype_wave3b/experience_rc3/public/fonts/*.woff2", "prototype_wave3b/experience_rc3/public/fonts/OFL-*.txt"]
BINARY_OK = re.compile(r"\.woff2$")
FORBIDDEN_EXT = re.compile(r"\.(mp4|mov|m4v|webm|mkv|jpe?g|png|gif|csv|tsv|xlsx?|pdf|jsonl|zip|tgz|bundle|sqlite|db|pptx?|docx?|key|pem)$", re.I)
NAMING_ALLOWED = {"README.md", "NOTICE.md", "AUTHORS.md", "LICENSE", "docs/DATA_AND_RIGHTS.md", "docs/PUBLIC_EDITION.md", "tools/public_gate.py"}
FACTUAL_NAMES = re.compile(r"\b(Spengler|Davos|Selects|Wisehockey|SRF)\b")
MAX_BYTES = 250_000
fails = []
def fail(msg): fails.append(msg); print("FAIL ", msg)
def ok(msg): print("PASS ", msg)
def tracked():
    try:
        out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
        files = [f for f in out if f]
        if files: return files, True
    except Exception: pass
    skip = {".git", "node_modules", "fixtures/media", "prototype_wave3b/experience_rc3/private_data", "prototype_wave3b/experience_rc3/qa", "deploy"}
    files = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and not any(str(p.relative_to(ROOT)).startswith(s) for s in skip)]
    return files, False
files, in_git = tracked()
# 1 · allow-list, binaries, sizes
bad = [f for f in files if not any(fnmatch.fnmatch(f, a) for a in ALLOW)]
fail(f"{len(bad)} file(s) not on the allow-list: {bad[:10]}") if bad else ok(f"{len(files)} files, all allow-listed")
media = [f for f in files if FORBIDDEN_EXT.search(f)]
fail(f"media/data/office files present: {media}") if media else ok("no media, data or office files")
big = [f for f in files if (ROOT / f).stat().st_size > MAX_BYTES and not BINARY_OK.search(f)]
fail(f"text files over {MAX_BYTES} bytes: {big}") if big else ok("no oversized text file")
nontext = []
for f in files:
    if BINARY_OK.search(f): continue
    try: (ROOT / f).read_text(encoding="utf-8")
    except Exception: nontext.append(f)
fail(f"non-text files: {nontext}") if nontext else ok("every non-font file is UTF-8 text")
# 2 · fixture lineage: fixtures == a fresh, seeded run of the fictional generator
r = subprocess.run([sys.executable, "tools/make_fictional_fixtures.py", "--check"], cwd=ROOT, capture_output=True, text=True)
fail("fixtures differ from a fresh run of tools/make_fictional_fixtures.py: " + r.stdout.strip()) if r.returncode else ok("fixtures are byte-identical to the seeded fictional generator")
# 3 · the generator cannot read data: stdlib-only imports, no data paths, file reads only of its own outputs (--check)
gen = (ROOT / "tools/make_fictional_fixtures.py").read_text()
tree = ast.parse(gen)
imports = {n.names[0].name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import)} | {n.module.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
extra = imports - {"argparse", "json", "math", "random", "sys", "pathlib"}
fail(f"generator imports non-stdlib/IO modules: {extra}") if extra else ok("generator imports only argparse/json/math/random/sys/pathlib")
reads = [ast.unparse(n) for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in ("read_text", "read_bytes", "open", "load") ]
if any("OUT" not in x and not x.startswith("p.read_text") for x in reads) or re.search(r"\bopen\(", gen): fail(f"generator reads files other than its own outputs: {reads}")
else: ok("generator reads no input file (only compares its own outputs in --check)")
if re.search(r"support/|full_data|private_data|\.csv|Match_Events|Wisehockey", gen): fail("generator mentions a data path or source")
else: ok("generator mentions no data path or source")
# 4 · fictional roster: every person in the fixtures, every player tag in the app
roster = set(re.search(r"SURNAMES = \[(.*?)\]", gen, re.S).group(1).replace('"', "").replace("\n", "").replace(" ", "").split(","))
fx = {f: json.loads((ROOT / "fixtures/payload" / f).read_text()) for f in ("second_look.json", "story2.json", "w3c_context.json", "look_around.json")}
people = fx["look_around.json"]["people"].values()
outsiders = sorted({p["name"] for p in people if p["name"] not in roster})
fail(f"fixture people not in the fictional roster: {outsiders}") if outsiders else ok(f"{len(roster)} fictional surnames; every fixture person is from the roster")
tags = set()
for f in files:
    if f.endswith((".js", ".mjs", ".json")):
        tags |= set(re.findall(r"#\d{1,2} ([A-Z][a-z]+)", (ROOT / f).read_text(encoding="utf-8", errors="replace")))
odd = sorted(t for t in tags - roster if t not in {"Player"})
fail(f"player tags not in the roster: {odd}") if odd else ok("every '#NN Name' tag in code and data uses a fictional name")
# 5 · disclosure + no real-world names outside the factual-reference documents
if not all(v["meta"].get("simulated") is True for v in fx.values()): fail("a fixture lacks meta.simulated = true")
else: ok("every payload is labelled simulated")
if "fictional" not in (ROOT / "README.md").read_text().lower(): fail("README does not disclose the fictional data")
else: ok("README discloses the fictional match")
named = [f for f in files if f not in NAMING_ALLOWED and not BINARY_OK.search(f) and FACTUAL_NAMES.search((ROOT / f).read_text(encoding="utf-8", errors="replace"))]
fail(f"real competition/team/provider names outside the factual-reference docs: {named}") if named else ok("real competition, team and provider names appear only in the factual-reference documents")
# 6 · maintainers' private denylist (never committed): names + phrases everywhere (except the factual-reference documents
#     for names), numbers in prose and in string literals (fixture JSON is covered by its lineage proof above)
den = os.environ.get("SECOND_LOOK_PRIVATE_DENYLIST")
D = json.loads(Path(den).read_text()) if den else None
STR = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")
def deny_hits(path, text):
    if D is None or path == "tools/public_gate.py": return []
    out = []
    if path not in NAMING_ALLOWED: out += [t for t in D["names"] if re.search(r"\b" + re.escape(t) + r"\b", text)]
    out += [t for t in D["phrases"] if re.search(r"(?<![\d:])" + re.escape(t) + r"(?![\d])", text)]
    if not path.startswith("fixtures/payload/"):
        prose = text if path.endswith((".md", "LICENSE")) else " ".join(STR.findall(text)) if path.endswith((".js", ".mjs", ".py", ".html")) else ""
        out += [t for t in D["numbers"] if re.search(r"(?<![\d.:#])" + re.escape(t.strip()) + r"(?![\d])", prose)]
    return out
if D:
    hits = {f: h[:6] for f in files if not BINARY_OK.search(f) and (h := deny_hits(f, (ROOT / f).read_text(encoding="utf-8", errors="replace")))}
    fail(f"private denylist tokens found: {hits}") if hits else ok(f"private denylist ({sum(len(v) for k, v in D.items() if k != '_PRIVATE')} tokens): no hit in the working tree")
else:
    print("SKIP  private denylist (set SECOND_LOOK_PRIVATE_DENYLIST; maintainers only)")
if in_git:
    revs = subprocess.run(["git", "rev-list", "--all"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    hist_bad = []
    for rev in revs:
        for line in subprocess.run(["git", "ls-tree", "-r", "--name-only", rev], cwd=ROOT, capture_output=True, text=True).stdout.split("\n"):
            if line and (FORBIDDEN_EXT.search(line) or not any(fnmatch.fnmatch(line, a) for a in ALLOW)): hist_bad.append((rev[:7], line))
            elif line and D and not BINARY_OK.search(line):
                blob = subprocess.run(["git", "show", f"{rev}:{line}"], cwd=ROOT, capture_output=True, text=True).stdout
                if deny_hits(line, blob): hist_bad.append((rev[:7], line + " (denylist)"))
    fail(f"history contains non-allow-listed or restricted content: {hist_bad[:10]}") if hist_bad else ok(f"history: {len(revs)} commit(s), every file allow-listed" + (" and denylist-clean" if D else ""))
print("PUBLISH GATE: " + ("PASSED" if not fails else f"FAILED ({len(fails)})"))
sys.exit(1 if fails else 0)
