# How Second Look works

## The fan's path

1. **Score page.** The result comes first. One question under it ("You saw the goal that won the final. Did you see what
   was in front of it?") and one button: *Watch the winning goal again*.
2. **Story 1.** WATCH the goal at full speed → **your read** on the frozen frame ("Where were you looking?" — a tap, never
   timed, never graded) → LOOK AGAIN: the same seconds, slower, with light guiding the eye → REVEAL: the data names and
   measures what was there. A stop card says what comes next; a second moment applies the same cue; a "twin" compares two
   shots from almost the same spot.
3. **Story 2.** A spoiler-free next card → *Goal or save?* → a new cue (*look one second back*) → **your turn** with no help.
4. **Carry.** Three cues to take to the next game.
5. **Look around.** Three investigations, each opened from the story moment it belongs to and returning to it:
   *The last pass*, *Who was on the ice*, *Every attempt*. Each states its finding, its denominator and its limit, with
   *More detail* and *How we know* on demand.

Evidence beats wait for the fan's tap; reads are never timed. `?clarity=0` restores the earlier automatic pacing.

## From match data to screen (private pipeline, described)

```
match event export + broadcast video
  → event table (one row per event; shots, passes, possessions, on-ice snapshots, shift reconstruction)
  → candidate detectors (records, contrasts, twins, sequences) and a story-worthiness score
  → narrative evidence: each number with its definition, denominator, label (measured / model / derived) and limits
  → video sync: event time → clip time (one constant offset fitted on reference events; ±0.3 s tolerance)
  → editor picks 0–2 stories; overlay positions are set by hand on the frames
  → payload builders (four JSON files) with assertions on every number
  → verification: bindings re-derived from the raw export, negative controls, claim scan of every visible string
  → app (this repository) → password-protected package
```

The public repository contains the app, the payload contract, the package builder and its security gate, and a
fictional-match generator that produces payloads of the same shape. The pipeline itself stays private because it embeds
match-specific constants (see [PUBLIC_EDITION.md](PUBLIC_EDITION.md)).

## Claim discipline

* One match: no tendencies, no rankings beyond "in this final".
* Model ratings are named as model ratings and never used as a reason.
* Association, never cause: words such as *caused*, *because*, *unsighted*, *should have* are banned from the fan layer.
* Every finding shows its limit next to it (e.g. "A last pass shows who had the puck last, not who made it happen";
  "It doesn't show whether anyone was tired").

## App architecture

* `public/js/app.js` — entry, modes, score page, navigation and resume checkpoints.
* `public/js/engine/` — `stage.js` (video, freeze, light, rings, tags), `ui.js` (captions, reads, evidence sheets, pacing),
  `runner.js` (beat sequencing), `log.js` (local event log).
* `public/js/stories/` — `w3c_story1.js`, `w3c_story2.js` (the release stories); `second_look.js`, `pass_across.js`
  (earlier versions kept for the rollback modes).
* `public/js/look/look.js` — the investigations (rink rendering, line-ups, shot map, details).
* `server.mjs` — static server for local use; the deployable package is built by `src/rc3/build_rc3_package.py`.
