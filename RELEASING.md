# Releasing

This module is build-free; a release is just the source files zipped and attached to a GitHub Release, with `module.json` as a second asset. Foundry tracks updates via the stable `manifest` URL (`releases/latest/download/module.json`); each version's `download` must point at that version's tagged zip.

For version `X.Y.Z`:

1. **Bump `module.json`** — update **both**:
   - `"version": "X.Y.Z"`
   - `"download": ".../releases/download/vX.Y.Z/pf2e-spellprep.zip"`  ← must match the tag, or installs of this version break.
2. **Anonymity check** — confirm no real name leaked anywhere:
   ```bash
   git grep -ni "richard\|lane" -- . ':!*.md' || echo "clean"
   ```
3. **Commit & push** the version bump (and any changes/docs for this release).
4. **Build the zip** from the committed state (flat layout, tracked files only — excludes `_study-prepper/`, `.git`, etc.):
   ```bash
   git archive --format=zip -o /tmp/pf2e-spellprep.zip HEAD
   ```
5. **Create the release** (creates the `vX.Y.Z` tag on the current commit and uploads both assets):
   ```bash
   gh release create vX.Y.Z /tmp/pf2e-spellprep.zip module.json --title "vX.Y.Z — <summary>" --notes "<notes>"
   ```
6. **Verify** the latest manifest + download resolve and serve the new version:
   ```bash
   curl -sL .../releases/latest/download/module.json | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"
   curl -sL -o /dev/null -w "%{http_code}\n" .../releases/latest/download/pf2e-spellprep.zip
   ```

Foundry/Forge will then offer the update automatically to anyone on a prior version.
