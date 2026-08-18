---
name: serve-mobile
description: Starts the meter-reader Angular/Ionic dev server bound to the LAN over HTTPS so it can be opened on a phone connected to the same Wi-Fi, then reports the URL to visit. Use whenever the user runs /serve-mobile, asks to test/preview the meter-reader app on their phone or a mobile device, wants to try it "on wifi", or asks to serve/spin up the app for mobile testing.
---

# Serve meter-reader for mobile testing

The meter-reader app needs to be reachable from a real phone (not just the local
Browser pane) to test camera capture, the file picker, and the native share
sheet — none of which behave the same in an automated browser. This skill
starts the dev server on the machine's LAN address over HTTPS.

HTTPS matters here, not just HTTP: the Web Share API and service worker
registration only run in a "secure context", and a plain `http://<lan-ip>` URL
doesn't qualify. `https://` with a self-signed cert does, which is why the
launch config passes `--ssl`.

## Steps

1. Confirm `.claude/launch.json` in the project root has a `meter-reader` entry
   with `--host 0.0.0.0 --ssl --disable-host-check` in `runtimeArgs`. If the
   file is missing or that entry doesn't exist, create/restore it:

   ```json
   {
     "version": "0.0.1",
     "configurations": [
       {
         "name": "meter-reader",
         "runtimeExecutable": "npm",
         "runtimeArgs": ["run", "start", "--", "--host", "0.0.0.0", "--ssl", "--disable-host-check"],
         "port": 4200,
         "url": "https://localhost:4200"
       }
     ]
   }
   ```

2. Call `mcp__Claude_Browser__preview_start` with `name: "meter-reader"`.
   - If the result has `reused: true`, the server was already running — don't
     restart it, just move on to reporting the URL (a live phone session may
     depend on it staying up).

3. Get the LAN address the server actually bound to. Call
   `mcp__Claude_Browser__preview_logs` with `search: "Network"` on the
   returned `serverId` — it will contain a line like
   `Network: https://192.168.x.x:4200/`. Extract that URL.
   - If the log search comes back empty (e.g. the server had already been
     running a while and that line scrolled out, or logs aren't retained),
     fall back to reading the IP directly: run `ipconfig` (this is a Windows
     machine) and take the IPv4 Address under the active Wi-Fi/Wireless LAN
     adapter, then build the URL as `https://<that-ip>:4200`.

4. Report to the user, plainly:
   - The URL to open on their phone.
   - That their phone must be on the **same Wi-Fi network** as this machine.
   - That the browser will show a certificate warning (it's a self-signed
     dev cert) — tap through it: **Advanced → Proceed** on Chrome/Android,
     **Show Details → visit this website** on Safari/iOS.
   - That if the page won't load at all, Windows Firewall may be blocking the
     inbound connection — the user needs to allow it themselves (don't try to
     change firewall/security settings directly; that's not something to do
     without the user doing it via their own prompt/settings).
   - Optionally: they can "Add to Home Screen" to install it as a PWA.

Don't run `npm run start` directly via Bash/PowerShell — always go through
`preview_start` so the harness tracks the process and `/stop-serve-mobile`
(and this session's own Browser pane) can find and manage the same server.
