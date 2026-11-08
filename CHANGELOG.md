# Changelog

All notable changes to this plugin. The version lives in `lib/client.js`
(`VERSION`) and in `package.json`; both must match.

## 0.14.0

One preview, one component.

- **Pictures inside an answer open the same sheet as attached files.** Tapping an
  inline image in the transcript no longer hands off to the shell's own lightbox:
  the phone sheet opens, the message's pictures form one gallery, and the arrows,
  arrow keys and counter all work the same way. Desktop keeps the app's lightbox.
- **The close button follows the shell's icon button.** `border-radius:999px;
  corner-shape:round`, a 16px stroked cross instead of a text glyph, and
  `display:grid; place-items:center` — the same recipe the app uses for its
  28px action buttons, so the glyph is dead-centre at any font.
- **Backdrop taps close, zones still page.** The left/right zones keep their
  generous size, but a tap that lands inside a zone yet outside the picture's own
  rectangle is read as "outside" and closes the sheet. With a single file open the
  zones close instead of paging nowhere.
- Taps inside the open sheet no longer try to open another one.

## 0.13.3

- **Arrow keys page a gallery.** With more than one image open, `←` and `→` move
  through the group, matching the arrows the overlay paints at the edges. Escape
  still closes. Covered by a browser test.

## 0.13.2

- **Android written down.** A Chromium run with a Pixel 7 profile (Chrome 158,
  412×839) passes: the drawer opens from the hamburger, the overlay and the
  remote-client rules behave the same, and the page reports `secureContext:
  false`, `share: false` over a LAN HTTP address — so the save button reads
  "Download file". The READMEs gain an Android section: the left edge belongs to
  the system Back gesture, installing the app needs HTTPS, the Share API is
  missing over plain HTTP, and the keyboard guard simply never fires on Android
  (it resizes the layout viewport, not the visual one).

## 0.13.1

- **The prerequisite is now documented.** `dsh --profile web` binds `127.0.0.1`
  by default, so a phone on the same network cannot reach it. All three READMEs
  gain a "Before you install" section: bind the LAN literal (wildcards are
  rejected by design), allow the port on the firewall, open the tokenized URL
  from the phone and re-add the shortcut after a restart (the token is per
  process; `~/.dsh/link.txt` holds the current one), and the TLS flags with
  `--public-url`/`--trusted-host` for a proxy.
- **Secure-context reality.** Over plain HTTP on a LAN address the page is not a
  secure context: `navigator.share` is missing, so the preview's bottom button
  now says "Download file" instead of "Save to Files", and Chrome refuses to
  install the app (iOS Safari still adds it to the home screen).
- `__dshMobileFixWhere()` also reports `secureContext`, `standalone` and whether
  the Share API is available.

## 0.13.0

Fixes from a two-model review (DeepSeek V4.1 Flash on the OpenCode Go
subscription and a local Qwen 3.8 27B), before promotion.

- **Desktop stays desktop.** The `__dshMobileFileOverlay` hook now declines on a
  pointer device, so a card on a desktop opens the app's own preview instead of
  the phone overlay.
- **One viewer per page.** A repeated `apply()` (HMR, live composition) disposes
  the previous viewer first; two of them used to open two overlays and push two
  history entries.
- **Transfers are bounded.** The archive is read through a byte-capped stream
  (256 MiB) instead of `arrayBuffer()`, text previews keep their own cap, and
  closing the sheet aborts whatever is still downloading.
- **Zip64** archives report "too large" instead of a generic read failure.
- **Share sheet cancellation** no longer shows "Failed, try again".
- **Right click** on a file link no longer opens the overlay.
- **Size units follow the UI language** (`2 KB` vs `2 КБ`).
- The locality probe only demotes when the page host is an IP literal (a
  `macbook.local` name is not an address), ignores results after disposal, and
  re-attaches its observer when the column is re-mounted; a media-query change at
  1023px now re-syncs the drawer class.
- Disposal cancels the pending drawer-close timer and drops a leftover history
  entry.
- **Packaging:** `private` removed so the package can be published, `docs/` added
  to `files` (the README images were broken in the tarball), and `engines.dsh`
  no longer admits 0.3 prereleases.
- **Docs:** stale debug-banner instructions replaced with
  `__dshMobileFixWhere()`, the zh diagram node removed, issue-template version
  and troubleshooting versions corrected, changelog claim about the resolver
  fixed.
- **Tests:** the browser suite now opens the 65 MiB bomb member and asserts the
  refusal, and checks that a pointer device does not get the overlay (12 tests).

## 0.12.4

- The `dsh-mf-drawer` class is only applied on narrow screens; on a desktop the
  drawer rules are inside a media query and the class was pure noise.

## 0.12.3

- `__dshMobileFixWhere()` in the page console reports what the plugin thinks of
  this client: version, address it was opened on, user agent, stored override,
  whether it ended up remote and what the WebRTC probe returned. The first thing
  to ask for when the host actions look wrong on someone's machine.

## 0.12.2

- **Locality no longer keys off the address alone.** The owner opens
  `http://192.168.x.x:3080` from the very Mac that runs DSH, and the previous
  rule hid the host actions there. Now: loopback and the desktop shell are
  local; a phone user agent is remote; a desktop on a LAN address is local until
  a WebRTC probe (skipped under automation) shows the page's address is not one
  of the machine's own interfaces. `localStorage['dsh-mobile-fix-local']`
  ('1' / '0') overrides everything.
- Four unit tests cover that resolver; the browser suite keeps both cases.

## 0.12.1

- The file viewer is its own factory now: `createFileViewer()` holds the overlay,
  the `/api/file` interception, the gallery, the ZIP reader and their disposal,
  while `apply()` keeps the drawer, the keyboard guard, the settings layout and
  the remote-client rules. No behaviour change; both suites cover the split.

## 0.12.0

- **Browser regression suite.** `npm run test:browser` boots the real bundle in
  Chromium against a fixture shell (a fake sidebar, a chat column, a fake
  `/api/file` route) and covers the interaction paths that unit tests cannot:
  the edge swipe and the drawer class, a session row opening on `pointerup`, a
  right click staying inert, a file link opening the overlay with a loaded image,
  a `download` link left alone, gallery paging, the ZIP listing and the inflate
  cap on a 65 MiB bomb, closing the sheet mid-save, the remote-client hiding and
  its restoration on dispose, and a pinch that keeps the composer focused.
- CI runs that suite in a second job (Chromium installed there).

## 0.11.2

Six interaction defects found in review, all fixed:

- **ZIP memory.** Inflation now reads the decompression stream chunk by chunk and
  aborts at 64 MiB, instead of buffering the whole entry and checking afterwards.
  A 66 KB archive that expands to 65 MiB is refused as "too large" in ~2 s.
- **Download links.** A link carrying `download` is skipped by the click
  interceptor again: the overlay's own fallback link was reopening the viewer
  instead of saving the file.
- **Closing during a save.** The handler holds the button it started with and
  checks that it is still in the document, so closing the sheet mid-share no
  longer throws.
- **Pinch with the keyboard open.** A width change is treated as a zoom and
  returns early; only a height-only change is a keyboard dismissal. Focus is no
  longer dropped by a pinch.
- **Disposal restores the host buttons.** They are hidden by a class the
  stylesheet owns (`html.dsh-mf-remote .dsh-mf-hidden`), not by an inline
  `display: none`, and disposal removes the class.
- **Right and middle click.** Row activation requires the primary button, so a
  right click no longer selects a session and closes the drawer.

Also: the ZIP error text now distinguishes a password-protected archive, a ZIP64
archive and an oversized entry instead of always saying "unsupported
compression"; the stale "red debug banner" instructions are gone from the three
READMs and the issue template.

## 0.11.1

- An HTML file opened from a link renders as a page in a sandboxed iframe
  instead of a text dump. For a `.html` card the card itself now routes to the
  shell's own preview, which also inlines the page's relative assets.

## 0.11.0

- **Host-software actions are hidden for remote clients.** "Open in Finder / VS
  Code / Ghostty / QuickTime", "Show file location" and the chevron next to them
  act on the machine that runs DSH, so on a phone — or any browser that reached
  the Host over the network — they only take space and open nothing the user can
  see. The client now marks itself `html.dsh-mf-remote` when the page origin is
  not loopback (and not the desktop shell), and the open-in-app control is hidden
  by a CSS rule plus a small DOM pass that removes the whole split control,
  chevron included. A browser on `127.0.0.1`/`localhost` keeps everything.
- `resolveRemote()` is covered by unit tests over loopback, a phone and a desktop on the LAN.

## 0.10.2

- The repository is renamed `zven73/dsh-mobile-fix` to match the package id and
  the free npm name (an unrelated `dsh-mobile-ui` package already exists on
  npm). GitHub redirects the old URL; the plugin id does not change, so an
  installed profile keeps working.
- `screenshots.json` next to `package.json` declares three storefront images for
  the catalog detail view.

## 0.10.1

Second review pass.

- **Fixed** an empty `aria-label` on the file dialog: it referenced a `name`
  that was not in scope, so the browser silently used the global `window.name`.
  The label now comes from the opened file.
- The drawer class is derived from the panel's own `_collapsed` class instead of
  the measured width, and a `ResizeObserver` watches the column — an animated
  open or a re-mounted panel can no longer leave the drawer stuck.
- `scrollables()` walks deeper into the conversation column (bounded to 400
  nodes) instead of only its direct children.
- The ZIP inflate cap also checks the bytes that actually came out, not only the
  size the archive declares.
- `test/` is no longer shipped in the npm package.
- ESLint now runs with a real config (`eslint:recommended` plus
  `no-restricted-globals` for `name`, `event`, `status`, `top`, `self`), so the
  class of bug above is caught in CI.

## 0.10.0

Review pass over the file overlay (all items verified against the code):

- **Fixed** a double `decodeURIComponent`: `searchParams.get()` already decodes,
  so a file named `100%.png` threw and the tap did nothing.
- **Fixed** gallery URLs built from `location.href`: they now clone the opened
  URL, keeping a deployment prefix (`/s/abc`) and the other query params.
- **Fixed** a gallery opened on a non-image (a PDF next to pictures) showing the
  first picture; it now falls back to a plain single-file preview.
- **Fixed** the back gesture closing the sheet without restoring the scroll; one
  teardown now serves the button, the backdrop, Escape and `popstate`.
- **Fixed** reopening the overlay over itself consuming its own saved scroll and
  racing the `history.back()`; the pop we cause is now ignored by handler.
- **Fixed** `fetch` results being rendered without checking `response.ok`, so a
  404 became "file content" and a save would write an error page.
- **Fixed** incomplete disposal: `window.open` is restored, the
  `__dshMobileFileOverlay` hook and the `dsh-mf-touch` class are removed, an open
  sheet is closed, the drawer observer is disconnected.
- Link interception now keys off the standalone/touch device instead of
  `max-width: 1023px`, so an iPad in landscape is covered too; modified clicks
  and `download` links are left alone.
- ZIP: password-protected and ZIP64 entries are reported instead of failing
  silently, and an entry larger than 64 MB is refused before inflating.
- Scroll memory reads only the conversation containers instead of walking the
  whole DOM.
- The story gestures listen on the overlay root, so a swipe that starts on an
  edge zone still pages.
- Object URLs minted for archive images are revoked.
- A pinch-zoom no longer looks like a closed keyboard and drops focus.
- The temporary Settings diagnostics (red banner, `scrollIntoView`) are gone.
- `:has()` on the app frame is replaced by one class on `<html>` kept in sync by
  a throttled observer.
- Overlay is a real dialog: `role="dialog"`, `aria-modal`, focus moves to the
  close button and returns on close.
- Strings come from a small ru/en dictionary with proper plurals («2 файла»),
  chosen by `navigator.language`.
- Housekeeping: unused `OPEN_PANEL` removed, shadowed names renamed, header
  comment rewritten, duplicated CSS comment dropped.
- **Tests and CI**: `node --test` covers the ZIP reader, `isFileUrl`,
  `collectGallery`, `humanSize` and the plural rule; GitHub Actions runs syntax,
  the version/`package.json` sync check, the tests and ESLint.

## 0.9.0

- **Gallery.** When the opened file sits in a group of images, the overlay pages
  through them: swipe left/right, tap the left or right third like a story, or
  use the arrows painted at the edges. A counter (`3 / 8`) shows the position and
  the save button always saves the file you are looking at. The group comes from
  the card's React props, so it includes images the virtualised list has not
  rendered yet.
- **Scroll is kept.** Opening an overlay remembers every scrollable surface of
  the app and restores it on close, so the chat no longer jumps to the top after
  a preview.
- The preview now opens by tapping the card itself; the separate "open" and
  "download" buttons are gone.

## 0.8.0

- The file overlay previews more than pictures: audio plays in a player, video
  plays inline with `playsinline`, text and JSON render as a scrollable preview,
  and a ZIP is unpacked in place — the archive's file list with sizes, and a tap
  on an entry shows the picture or the text inside it (stored and deflated
  entries, via `DecompressionStream`).

## 0.7.0

- File links open inside the app. A raw `/api/file` URL opened from a
  standalone PWA hands the resource to iOS, which shows it in a native Quick
  Look sheet with no way back — the only escape was killing the app. The
  plugin now intercepts both `a[href]` clicks and `window.open` calls that
  target a same-origin `/api/file` and renders the file in a full-screen
  overlay: images inline, PDFs in a frame, anything else as a download link.
  Close with the button, a tap outside, Escape, or the phone's back gesture
  (the overlay pushes one history entry).

## 0.6.3

- Settings → Account: the identity text and the "More account information"
  link no longer share one row on a phone. The link won the width and the name
  collapsed into a ~90px column ("Signed / in to / DeepSeek"); the card now
  stacks the identity above the link.
- Balance rows wrap their buttons under the label instead of squeezing it.

## 0.6.2

- Drop the field's focus when the iOS keyboard closes. In a standalone PWA iOS
  can leave the keyboard accessory bar (previous / next field / Done) pinned to
  the bottom of the screen while a text field keeps focus.

## 0.6.1

- The 16px field rule now follows the touch device (`html.dsh-mf-touch`), not
  `max-width: 1023px`. A phone showing a wide desktop layout (mirrored and
  stretched Mac screen) no longer autozooms on the composer.
- `touch-action: manipulation` on buttons, menu rows and tabs, so a double tap
  does not shift the next tap off its target.
- Settings diagnostics moved behind `localStorage['dsh-mobile-fix-debug']`; the
  off-screen rescue stays on.

## 0.6.0

- Touch-device detection and tap-target fixes.

## 0.5.1

- Settings keep the app's own panel size and centering; only the section list
  becomes a horizontal strip. The full-screen sheet of 0.5.0 is gone.

## 0.5.0

- Settings on a phone: horizontal section strip, full-width content.
- Right panel (Files, Terminal, file/code previews) opens as a full-screen sheet
  while it is open, instead of a 0px grid track.
- Code and tables stay inside the message and scroll on their own; code in the
  file viewer is 12px.

## 0.4.1

- Earlier swipe trigger: 36px instead of 60px, vertical drift 34px instead of
  45px.

## 0.4.0

- Edge swipes: from the left edge to open, swipe left to close. Vertical drags
  cancel the gesture and stay with the scroller.

## 0.3.5

- Session rows open on the first tap on iOS. The row's `click` is dispatched
  synchronously from `pointerup`, before the drawer unmounts the row; the late
  native click of the same tap is swallowed in a 40px / 600ms window.

## 0.3.4

- Drawer close moved from `click` to `pointerup`, with a 12px movement threshold
  and a 120ms delay so the session opens first.
- Open/closed is measured by the column width, not by a CSS class.

## 0.3.3

- "New session" closes the drawer too; the row action buttons do not.
- The scrim owns outside taps: they close the drawer and do not reach the chat.

## 0.3.1

- Tapping a session row and "New session" closes the drawer again; workspace
  folders only expand.

## 0.3.0

- Closing only from the outside: the inside test uses both the DOM and the tap
  coordinates, interactive controls are ignored, keyboard clicks do not close.

## 0.2.0

- Protected close: one click handler per page (a repeated apply replaces the
  previous one), a 600ms toggle lock, and a blanket opt-out for interactive
  controls.

## 0.1.0

- First version: 16px fields, the sidebar drawer, auto-close.
