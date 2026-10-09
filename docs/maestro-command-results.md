# Maestro command results — original phase 3D

`runMaestroCommands` dispatches the existing seven whitelisted commands. Each
action publishes a `CommandResult`: `command`, `status`, optional `message`,
`jobId`, audio artifact summary and `error`. The four UI statuses are `started`,
`completed`, `failed` and `cancelled`.

Synchronous navigation completes immediately. Asynchronous actions first report
started, then their actual outcome. MusicGen reports the queued sidecar job ID
through the analyzer callback; the analyzer and sidecar still own execution,
polling, cancellation and bytes. The result stays on the originating assistant
turn even when later messages arrive.

Commands are independent. A failure does not prevent another command from
running; there is no transaction or rollback. Unknown commands fail without
running a handler. An asynchronous action returning no outcome fails rather
than claiming completion.

Cancelled means the analyzer observed a cancelled sidecar job. A cancellation
request alone is not a terminal result. Running request-only model jobs can
finish normally, retaining their artifact.

The installed UI also exposes the existing local ACE-Step startup endpoint.
Readiness is refreshed from sidecar health after startup; the button never sets
model availability optimistically.
