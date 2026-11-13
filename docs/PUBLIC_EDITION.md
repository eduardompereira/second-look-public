# Public edition — what differs from the private build

The public edition is produced from our private release by a deterministic, allow-list-only build (the build tool and
its redaction table stay private because they list the real values they replace). This page states every category of
difference so the relationship between the two is explicit.

## Same in both

* Every app module: the story engine, the video stage, the two stories, the three investigations, navigation and
  return-to-story, pacing (`?clarity=0` rollback), accessibility and keyboard handling.
* The four features of the final build, on by default: discovery points, the two-rink Follow the Play, the other side's
  shot map (*And the other side?*, offered only after the story moment it would spoil) and player match cards.
* The final design layer (`css/b1.css`): type scale bounded by width and height, scrollable sheets and story screen on
  short phones with the primary action pinned above the browser bar, themed scrollbars, high-contrast player labels.
* The payload contract: the app reads the same six JSON files with the same structure (`tests/fixture_contract.py`),
  apart from the renamed keys below.
* The package builder and its security gate (password middleware that fails closed, file allow-list, manifest hashes).

## Changed for the public edition

| Category | Private build | Public edition |
|---|---|---|
| Match data | Payload built from the competition's match export | Fictional match from `tools/make_fictional_fixtures.py` (seed 20261112): all events, times, positions, outcomes, model ratings, ranks, players and numbers are generated; it reads no file |
| Video and stills | Clips and stills cut from the match broadcast | Generated placeholder clips and labelled placeholder stills (`fixtures/setup_fixture.py`) |
| Teams, players, tournament | Real names in the story copy | Fictional teams (Harbour HC, Ridge Academy), fictional players, "Winter Cup" |
| Hand-typed story copy | A few lines quote match chronology and numbers (e.g. time between two moments, a period clock, a "next" value in an evidence panel) | Replaced by fictional values consistent with the fictional match, or by neutral wording ("Moments later", "Earlier in the 3rd period") |
| Data-source labels | Name the data provider and its shot model | "Simulated data", "the shot model" |
| Overlay geometry | Pixel positions of rings, lights and tap regions measured on real broadcast frames | Redrawn from a seeded random generator (the placeholder video has nothing to align to) |
| Clip-relative edit timings | Offsets inside our own clip cuts | Rescaled by one seeded factor per clip (order preserved) |
| Code comments | Design notes, many of which quote match facts | Removed from every app and test module |
| Identifiers and payload keys | A few contain player surnames | Renamed to roles (e.g. `passerA`, `shooterB`, `goalie_pool`, `f_passer`) |
| Test expectations | Journey assertions check the real match's values | The same assertions check the fictional match's values |
| Data pipeline (`src/` builders, verifiers, evidence engine) | Present | Not included: it embeds match-specific constants. Described in [HOW_IT_WORKS.md](HOW_IT_WORKS.md); the private repository can be shared with the organisers |
| Research pages (`observer.html`, `teaser.html`) | Present | Not included |
| Feature lab (`?lab=1`, a QA switch for the four features) | Present | Not included (all four features are always on) |
| Other side's shot map and match cards | Built from the match export | Generated: 47 Ridge attempts on the Harbour goalie; per-period counts that add up to the match; goalies have no counts |

## What the public edition can and cannot show

* It **can** show the full interaction: score page → watch → your read → look again → reveal → carry → the second story
  → the investigations, on any device, from a fresh clone.
* It **cannot** show that any finding is true of a real match. The stories' numbers and the investigations' findings
  describe the fictional match only. Claims about the real final are checked in the private build (657 binding checks
  against the raw export, negative controls, a claim scan) and are not reproducible from this repository.
