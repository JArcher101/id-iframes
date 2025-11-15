# Iframe Version Log

Detailed release data now lives in `iframe-version-log.json`, which is generated automatically by `scripts/bump-iframes.ps1`. Each entry contains the UTC timestamp, commit title, UUID, and the exact iframe files that were updated.

## Usage

- Run `powershell -ExecutionPolicy Bypass -File scripts\bump-iframes.ps1 -Title "Your summary"` before committing. The script:
  - Generates a new 7-character UUID
  - Cache-busts every local CSS/JS reference with `?v=<uuid>`
  - Injects the `[iframe-name] version <uuid>` console logger
  - Appends an object to `iframe-version-log.json`
  - Creates the commit `Your summary [uuid]` (and optionally pushes with `-Push`)
- Inspect history with the lightweight viewer `iframe-version-log-viewer.html` (ignored by git so you can customize it). Serve the repo locally (`npx serve`, `python -m http.server`, etc.) and open the viewer to get expandable cards for every entry.

> The legacy Markdown table has been retired in favor of the structured JSON log + viewer combo for easier auditing.
