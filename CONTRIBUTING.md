# Contributing

1. Work on a branch; open a pull request.
2. Run `npm run test:public` before you push. It must end with *ALL PUBLIC CHECKS PASSED*.
3. Data: never add real match data, footage, stills, screenshots of footage, or anything derived from them. Change the
   fictional match only through `tools/make_fictional_fixtures.py` (then `npm run fixture:build`); the publish gate
   rejects hand-edited fixtures.
4. Copy: keep the claim rules in [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) (one match, association not cause, model
   ratings named as such, every finding with its limit). Reads are never timed or graded.
5. UI changes go behind a URL flag until reviewed, so the default experience stays stable.
