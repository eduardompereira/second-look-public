"""Second Look · PUBLIC EDITION setup. Installs the FICTIONAL fixture (tools/make_fictional_fixtures.py) so the app runs
from a fresh clone. No real match data, no match footage: stills are labelled placeholders and clips are generated test
patterns.

  python3 fixtures/setup_fixture.py            # payload + placeholder stills + generated clips (needs ffmpeg and Pillow)
  python3 fixtures/setup_fixture.py --check    # only verify what is installed
Then:  npm run dev   → http://127.0.0.1:5199/
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
FX = ROOT / "fixtures" / "payload"
APP = ROOT / "prototype_wave3b" / "experience_rc3"
PRIV, QA, MEDIA = APP / "private_data", APP / "qa", ROOT / "fixtures" / "media"
STILLS = ["card_follow.jpg", "card_hold.jpg", "hook_b.jpg", "hook_b_m.jpg", "poster_gp01.jpg", "poster_gp02.jpg", "poster_gp03.jpg",
          "poster_gp04.jpg", "twin_s1.jpg", "twin_win.jpg"]
def is_fixture(p):
    try: return json.loads(p.read_text()).get("meta", {}).get("fixture") is True
    except Exception: return False
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); ap.add_argument("--no-video", action="store_true"); a = ap.parse_args()
    payloads = sorted(FX.glob("*.json"))
    if a.check:
        bad = [p.name for p in payloads if not (PRIV / p.name).is_file() or not is_fixture(PRIV / p.name)]
        clips = [c for c in ("gp02", "gp03", "gp04", "gp08", "gp09") if not (MEDIA / f"{c}.mp4").is_file()]
        print("fixture payloads installed:", not bad, bad, "| synthetic clips present:", not clips, clips); sys.exit(1 if bad or clips else 0)
    PRIV.mkdir(parents=True, exist_ok=True)
    for f in PRIV.glob("*.json"):
        if not is_fixture(f):
            sys.exit(f"STOP — {f.relative_to(ROOT)} is not a fixture file; nothing was changed.")
    for p in payloads: shutil.copy2(p, PRIV / p.name)
    from PIL import Image, ImageDraw
    for i, name in enumerate(STILLS):
        im = Image.new("RGB", (1280, 720), (18 + 9 * i, 28, 44)); d = ImageDraw.Draw(im)
        for x in range(0, 1280, 80): d.line([(x, 0), (x, 720)], fill=(40, 52, 70))
        for y in range(0, 720, 80): d.line([(0, y), (1280, y)], fill=(40, 52, 70))
        d.rectangle([40, 300, 1240, 420], fill=(0, 0, 0)); d.text((60, 330), f"SIMULATED · {name} · placeholder, not match footage", fill=(255, 210, 0))
        im.save(PRIV / name, quality=80)
    if not a.no_video:
        if not shutil.which("ffmpeg"): sys.exit("ffmpeg not found: install it (brew install ffmpeg) or use --no-video (the stories will not play).")
        sl, s2 = json.loads((FX / "second_look.json").read_text()), json.loads((FX / "story2.json").read_text())
        durs = {**{k: v["dur"] for k, v in sl["clips"].items()}, **{k: v["dur"] for k, v in s2["clips"].items()}}
        MEDIA.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
        for c, dur in sorted(durs.items()):
            no_timer = "drawbox=x=0:y=0:w=260:h=80:color=black:t=fill"   # testsrc2 burns a running timecode into the top-left corner; cover it
            label = f"{no_timer},drawtext=text='SIMULATED {c} · placeholder video':fontcolor=yellow:fontsize=48:box=1:boxcolor=black@0.7:x=(w-tw)/2:y=h*0.8"
            base = ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size=1920x1080:rate=25:duration={dur}"]
            for vf in ([label, no_timer]):   # drawtext needs libfreetype; fall back to the bare pattern if this ffmpeg lacks it
                r = subprocess.run(base + ["-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "35", "-g", "5", "-movflags", "+faststart", str(MEDIA / f"{c}.mp4")])
                if r.returncode == 0: break
            else: sys.exit(f"ffmpeg could not create {c}.mp4")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(MEDIA / f"{c}.mp4"), "-c:v", "libvpx-vp9", "-b:v", "300k", "-deadline", "realtime", "-cpu-used", "8", "-g", "5", str(QA / f"{c}.webm")], check=True)
    print(f"Fixture installed: {len(payloads)} payloads, {len(STILLS)} stills" + ("" if a.no_video else f", clips in {MEDIA.relative_to(ROOT)}"))
    print("Run:  cd prototype_wave3b/experience_rc3 && CLIPS_DIR=../../fixtures/media PORT=5199 npm run dev   → http://127.0.0.1:5199/")
if __name__ == "__main__":
    main()
