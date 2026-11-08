# Draft: GitHub Discussion for deepseek-ai/deepseek-harness

Title: `[web] The tokenized URL lands on "authentication required" on Android Chrome; a reload fixes it`

## What happens

1. `dsh --profile web --host 192.168.0.54 --port 3080` prints
   `http://192.168.0.54:3080/?token=…`.
2. Open that URL on Android (Chrome 138+, Pixel 7 / API 34 emulator and a real
   device; also reproducible when the link is opened from a QR scanner or another
   app).
3. The server answers `303` with `Location: ./` and

   ```
   set-cookie: dsh-auth-<hash>=v1.<payload>.<sig>; Max-Age=2592000; Path=/;
               Expires=…; HttpOnly; SameSite=Strict
   ```

4. Chrome follows the redirect to `/` and renders
   `dsh web authentication required; reopen the URL printed by dsh web.`
5. **Pressing reload once opens the app normally.** The cookie is there; the
   request that follows the redirect simply did not carry it.

The same flow works first time in desktop Chromium (macOS) and in WebKit.

## Why it looks like the redirect rather than the cookie

On the Android emulator I ran two probes against a throw-away server:

- a page that set a cookie **from JavaScript** and reloaded it under the same
  origin — the cookie was stored and sent back (`server saw="jsprobe=2"`);
- a page that answered `302` with `Set-Cookie` and redirected to `/check` — the
  follow-up request had no `Cookie` header (`server saw=(none)`).

So the cookie is accepted, but not attached to the request that follows the
redirect. `SameSite=Strict` is the obvious suspect, though on desktop Chromium a
cross-site redirect to the token URL still worked, so I could not prove that part.

## What would make this robust

Any of these removes the dependency on a browser quirk:

- `SameSite=Lax` (or unset) on the auth cookie — the session is a top-level
  navigation, `Strict` buys little here;
- set the cookie on a `200` page that then redirects with `location.replace()`
  instead of a `303`;
- keep `?token=` working as an idempotent entry point: if the request carries a
  valid token, treat it as authenticated even when the cookie is missing on that
  same request.

## Environment

- dsh 0.2.1-rc.5, profile `web`, `--host <LAN IP>`
- Android 14, Chrome 138 (emulator, google_apis arm64) and a real Android phone
- macOS host on the same LAN

Happy to run more probes if useful — the plugin I maintain documents the reload
workaround for now.
