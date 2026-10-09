# Sidecar contracts (original FAS 3C)

Source plan: [original web phase plan](original-web-phase-plan.md).

Python response models are authoritative for public JSON results. FastAPI exports
them through OpenAPI; `npm run contracts:sidecar` writes
`docs/sidecar-openapi.json` and `app/lib/generated/sidecar-contracts.ts`.
The handwritten `sidecar-bridge.ts` imports those types. It continues to own
authentication, lifecycle, errors, polling, blob responses and binary headers.

`npm run check:sidecar-contracts` checks both generated files against the current
Python app, without starting a server or loading inference models. Python's
normal test suite checks the snapshot against FastAPI; Vitest checks the generated
types against that snapshot and checks that the bridge consumes them. Thus the
existing full CI gate detects drift in either direction.

The generated component schemas cover existing Pydantic request/response models,
health/device/capability details, public generation jobs, ACE presets, vocal model
status, alignment, OpenVPI export and maintainer capabilities. Extensible vocal
plan dictionaries remain dictionaries. Binary audio/image responses and headers
remain explicit bridge code; native Tauri management status is not a Python API.
Internal artifact paths remain outside the public job response schema.

Workflow after changing a Python contract:

1. Update the Python response model and its regression test.
2. Run `npm run contracts:sidecar`.
3. Inspect the generated diff and fix affected consumers.
4. Run `npm run check:ci` and `npm run check:sidecar-contracts`.
5. Build, install and exercise the installed app before closing the phase.

No network client is generated, and no additional dependency is required.
