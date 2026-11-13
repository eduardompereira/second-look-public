"""Payload contract test. The public fixture and the restricted payload must have the SAME schema (normalised key paths, leaf
types and array lengths), so code that runs on the fixture runs on the real data and vice versa.

  python3 tests/fixture_contract.py                                   # fixture vs tests/payload_schema.json (public mode)
  python3 tests/fixture_contract.py --restricted <private_data_dir>   # ALSO the real payload vs the same schema (authorised mode)
  python3 tests/fixture_contract.py --write-schema <private_data_dir> # maintainer: regenerate the schema from the real payload
Numeric dict keys (player ids, row ids) are normalised to <id>; values are never stored in the schema.
"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
FILES = ["second_look.json", "story2.json", "w3c_context.json", "look_around.json"]
SCHEMA = ROOT / "tests" / "payload_schema.json"
def shape(o, path, out):
    if isinstance(o, dict):
        ks = sorted(k for k in o if not (path == "" and k == "meta"))
        for k in ks: shape(o[k], path + "." + ("<id>" if re.fullmatch(r"\d{3,}", k) else k), out)   # no backslash inside an f-string: Python 3.10/3.11
    elif isinstance(o, list):
        out.setdefault(path + "[]#len", set()).add(len(o))
        for v in o: shape(v, path + "[]", out)
    else:
        t = "num" if isinstance(o, (int, float)) and not isinstance(o, bool) else type(o).__name__
        out.setdefault(path, set()).add(t)
def schema_of(d):
    out = {}
    for f in FILES:
        s = {}; shape(json.loads((d / f).read_text()), "", s); out[f] = {k: sorted(map(str, v)) for k, v in sorted(s.items())}
    return out
def compare(name, got, want):
    bad = []
    for f in FILES:
        g, w = got[f], want[f]
        for k in sorted(set(g) | set(w)):
            if k not in g: bad.append(f"{f}: missing {k}")
            elif k not in w: bad.append(f"{f}: unexpected {k}")
            elif k.endswith("#len"):
                if g[k] != w[k]: bad.append(f"{f}: length {k} {g[k]} ≠ {w[k]}")
            elif not set(g[k]) <= set(w[k]) | {"NoneType"} and not set(w[k]) <= set(g[k]): bad.append(f"{f}: type {k} {g[k]} ≠ {w[k]}")
    print(f"{name}: {'OK' if not bad else f'{len(bad)} differences'} ({sum(len(v) for v in got.values())} schema entries)")
    for b in bad[:30]: print("  ", b)
    return not bad
if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--write-schema"]:
        SCHEMA.write_text(json.dumps(schema_of(Path(a[1])), indent=0) + "\n"); print("wrote", SCHEMA); sys.exit(0)
    want = json.loads(SCHEMA.read_text()); ok = True
    fx = ROOT / "fixtures" / "payload"
    for f in FILES:
        if json.loads((fx / f).read_text()).get("meta", {}).get("fixture") is not True: print(f"{f}: meta.fixture is not true"); ok = False
    ok &= compare("fixture payload", schema_of(fx), want)
    if a[:1] == ["--restricted"]: ok &= compare("restricted payload", schema_of(Path(a[1])), want)
    sys.exit(0 if ok else 1)
