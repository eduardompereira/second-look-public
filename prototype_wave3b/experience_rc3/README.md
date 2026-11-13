# Second Look app

Static web app (no runtime dependencies) + `server.mjs` for local use. From the repository root:

```bash
npm run fixture:setup && npm run dev     # → http://127.0.0.1:5199/
```

* Default: the clarity-first release (evidence beats wait for a tap). `?clarity=0`: earlier pacing. `?rc3=0`: the earlier
  release without the investigations' contextual entry points.
* Data: `private_data/*.json` (installed from `fixtures/payload/`, git-ignored). Video: `CLIPS_DIR` (placeholder clips).
* Architecture: [../../docs/HOW_IT_WORKS.md](../../docs/HOW_IT_WORKS.md).
