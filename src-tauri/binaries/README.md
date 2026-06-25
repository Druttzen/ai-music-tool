# Bundled AI sidecar binaries

Tauri `externalBin` artifacts land here at **packaging time** (not committed).

Build for the current host triple:

```bash
npm run build:sidecar
```

Expected filenames (examples):

- `ai-sidecar-x86_64-pc-windows-msvc.exe`
- `ai-sidecar-x86_64-apple-darwin`
- `ai-sidecar-aarch64-apple-darwin`
- `ai-sidecar-x86_64-unknown-linux-gnu`

Then `npm run tauri:build` bundles the matching binary into the installer.
