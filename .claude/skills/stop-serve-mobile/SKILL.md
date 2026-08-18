---
name: stop-serve-mobile
description: Stops the meter-reader mobile dev server started by /serve-mobile. Use whenever the user runs /stop-serve-mobile, says they're done testing on their phone, or asks to shut down/stop the mobile preview server for meter-reader.
---

# Stop the meter-reader mobile dev server

## Steps

1. Call `mcp__Claude_Browser__preview_list` to see running servers.
2. Find the entry with `name: "meter-reader"`.
   - If none is running, tell the user there's nothing to stop and stop here.
3. Call `mcp__Claude_Browser__preview_stop` with that server's `serverId`.
4. Confirm to the user that the server is stopped and the URL from
   `/serve-mobile` will no longer load on their phone.

Don't try to kill the process via `Bash`/`PowerShell` (e.g. hunting for
`node`/`ng` processes on port 4200) — the server was started through
`preview_start`, so `preview_stop` is the correct way to tear it down
cleanly; killing it out-of-band can leave the harness thinking it's still
running.
