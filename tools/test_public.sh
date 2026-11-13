#!/usr/bin/env bash
# Second Look · PUBLIC EDITION test suite. Runs from a fresh clone; needs Python 3.10+, Node 20+, ffmpeg + Pillow for the
# placeholder media, and (optional) Playwright for the browser journeys. Everything here runs on the FICTIONAL match.
#   1 syntax · 2 fixture lineage + payload contract · 3 publish gate · 4 code-only package + security gate · 5 browser journeys
set -euo pipefail
cd "$(dirname "$0")/.."
ok() { echo "PASS  $*"; }
echo "== 1 · syntax"
python3 -m compileall -q tools fixtures tests src >/dev/null && ok "python compiles"
n=0; for f in $(find prototype_wave3b/experience_rc3 src tools -name '*.js' -o -name '*.mjs' | grep -v node_modules); do node --check "$f" >/dev/null || { echo "FAIL  node --check $f"; exit 1; }; n=$((n+1)); done; ok "node --check on $n files"
echo "== 2 · fictional fixture"
python3 tools/make_fictional_fixtures.py --check && ok "fixtures = fresh seeded build"
python3 tests/fixture_contract.py
echo "== 3 · publish gate"
python3 tools/public_gate.py
echo "== 4 · package (code-only) + security gate"
python3 fixtures/setup_fixture.py --no-video >/dev/null && ok "fixture payload + placeholder stills installed"
python3 src/rc3/build_rc3_package.py --out deploy/second-look-public-check --media-mode none --label public-check >/dev/null && ok "package builds"
node src/rc3/qa/package_gate_check.mjs deploy/second-look-public-check | tail -n 1
echo "== 5 · browser journeys on the fictional match (optional)"
if node -e "import('playwright').then(()=>process.exit(0),()=>process.exit(1))" 2>/dev/null; then
  python3 fixtures/setup_fixture.py >/dev/null && ok "placeholder clips generated"
  FP=${FIXTURE_PORT:-5299}
  ( cd prototype_wave3b/experience_rc3 && CLIPS_DIR=../../fixtures/media PORT=$FP exec node server.mjs >/dev/null 2>&1 ) & SRV=$!
  trap 'kill $SRV 2>/dev/null || true' EXIT
  for i in $(seq 1 50); do (exec 3<>/dev/tcp/127.0.0.1/$FP) 2>/dev/null && break; sleep 0.2; done
  node tools/fixture_smoke.mjs "http://127.0.0.1:$FP/"
  echo "== 6 · the four features and the fan-first detail layer (phone)"
  for seg in a b; do node tools/b1_features.mjs "http://127.0.0.1:$FP/" "$(mktemp -d)" $seg phone | tail -n 1; done
else echo "SKIP  Playwright not installed (npm run qa:install)"; fi
echo "ALL PUBLIC CHECKS PASSED (fictional match; not match evidence)"
