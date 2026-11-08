<div align="center">

# DSH Mobile UI

[![DSH 0.2.x](https://img.shields.io/badge/dsh-0.2.x-blue)](#compatibility)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Host code: none](https://img.shields.io/badge/host%20code-none-8a2be2)](#how-it-works)
[![iOS PWA](https://img.shields.io/badge/iOS-PWA-black?logo=apple&logoColor=white)](#what-it-fixes)
[![Client plugin](https://img.shields.io/badge/dsh--plugin-client%20bundle-0b7285)](#install)

</div>

<picture><source media="(max-width: 760px)" srcset="docs/pixel.png"><img src="docs/demo.gif" alt="Drawer, session, settings and Files on a phone" align="left"></picture><picture><source media="(max-width: 760px)" srcset="docs/pixel.png"><img src="docs/spacer.png" alt="" align="left"></picture>

<p><strong>A phone-first fix for the DeepSeek Harness Web UI — a real drawer, edge swipes, readable settings and a working right panel, without touching the core.</strong></p>
<p>DSH 0.2.x is desktop-first: a three-column grid, a 188px settings nav, a 0px right panel and a 14px composer that makes iOS zoom the page. On a phone that leaves a sliver of chat, unreadable settings and no way to reach Files or the code viewer.</p>
<ul>
<li><strong>No more iOS auto-zoom</strong> — 16px fields on any touch device, even under a wide desktop layout</li>
<li><strong>The chat keeps the width</strong> — a 56px rail plus an overlay drawer, with edge swipes</li>
<li><strong>Everything else fits</strong> — settings, Files, terminal and the code viewer</li>
</ul>
<p>No build step, no host code — one client module, MIT licensed.</p>

<picture><source media="(min-width: 761px)" srcset="docs/pixel.png"><img src="docs/demo.gif" alt="Drawer, session, settings and Files on a phone"></picture>

<br clear="all">


---

## What it fixes

| Sidebar drawer | Settings | Files and code |
| --- | --- | --- |
| ![Drawer](docs/drawer.png) | ![Settings](docs/settings.png) | ![Files](docs/right-panel.png) |

1. **iOS auto-zoom.** Safari zooms a focused field under 16px. All `input` / `textarea` / `contenteditable` become 16px on touch devices; the check is the *device* (`html.dsh-mf-touch`), not the viewport width, so a phone showing a stretched desktop layout does not zoom either. `touch-action: manipulation` keeps double taps from moving the next tap off its target.
2. **The chat keeps the full width.** The sidebar column stays a 56px rail; the open panel becomes a fixed overlay drawer with a dimmed, blurred scrim.
3. **The drawer closes** when you pick a session, when you tap outside it, and by its own close button. The bottom safe area is respected.
4. **Session rows open on the first tap.** iOS treats a plain `<div role="treeitem">` with a React handler as "not clickable" and holds its click for the double-tap window (~300ms). Closing the drawer first unmounted the row, so the tap only closed the menu. The row's click is now dispatched synchronously from `pointerup`, and the late native click of the same tap is swallowed.
5. **Edge swipes.** Swipe from the left edge to open, swipe left to close. Vertical drags stay with the scroller (36px threshold, 34px vertical drift, 24px edge zone).
6. **Settings fit the phone.** The desktop dialog keeps a 188px nav column next to the content — on a 390px screen that left ~150px. On narrow screens the section list becomes a horizontal, scrollable strip above the content, and the Account card stacks its identity above the "More account information" link instead of squeezing the name into a narrow column.
7. **The right panel works.** DSH already full-screens it below 768px; between 768 and 1023px the column kept a narrow track, so while the panel is open (`data-sidebar-right-open`) the plugin promotes it to a full-screen sheet.
8. **Code and tables stay inside the message** and scroll on their own; code in the file viewer is 12px instead of 11px.
9. **The iOS keyboard accessory bar no longer sticks.** In a standalone PWA iOS can leave the previous/next/Done bar pinned at the bottom after the keyboard is dismissed; the plugin drops the field's focus when the keyboard closes.
10. **File links open inside the app.** A raw `/api/file` URL opened from the installed app hands the resource to iOS, which shows it in a native Quick Look sheet with no way back — the only escape was killing the app. The plugin catches those links (and `window.open` calls) and shows the file in an overlay: image inline, PDF in a frame, audio and video in players, text and JSON as a preview, and a ZIP as its file list — tap an entry to see the picture or text inside. A group of images pages like a story: swipe, or tap the left/right edge, with a counter and a save button for the current one. Closing an overlay restores the chat scroll position. Close with the button, a tap outside, Escape, or the back gesture.
11. **Host-software actions only where they work.** "Open in Finder / VS Code / QuickTime" acts on the machine that runs DSH, so it is hidden for a remote client. Locality is decided in three steps: loopback and the desktop shell are local; a phone is remote; a desktop on a LAN address is assumed local until a WebRTC probe shows its address is not one of the machine's own. Force the answer with `localStorage['dsh-mobile-fix-local'] = '1'` (local) or `'0'` (remote).

## Install

```sh
git clone https://github.com/zven73/dsh-mobile-fix.git ~/.dsh/local-plugins/dsh-mobile-fix
dsh plugin --profile web add ~/.dsh/local-plugins/dsh-mobile-fix
```

`dsh plugin` needs `pnpm` on `PATH`. Restart `dsh web` (or let the profile re-compose) and reload the page on the phone. Client bundles are served from disk with a content revision, so later updates only need a page reload.

> The package id stays `dsh-mobile-fix` (the repository was renamed); that is the name you will see in `~/.dsh/profiles/web/package.json`.

### Uninstall

```sh
dsh plugin --profile web remove dsh-mobile-fix
```

## How it works

```mermaid
flowchart LR
  A[DSH web client<br/>0.2.x] --> B[client module<br/>lib/client.js]
  B --> C[stylesheet<br/>narrow + touch rules]
  B --> D[DOM hooks<br/>pointer · touch · click]
  C --> E[56px rail + overlay drawer]
  C --> F[settings strip · right sheet]
  D --> E
```

The package is a plain DSH client plugin: `cordis.patch.yml` inserts one empty Host row, and `lib/client.js` is the browser bundle DSH serves through `dsh.client`. Everything it does is CSS and DOM events:

- selectors use the stable halves of the CSS-module names (`sidebarCol`, `centerCol`, `rightbarCol`, `sessionRow`, `_root`, `_collapsed`, `toggle`) and the public `data-slot` names;
- the phone layout is behind `@media (max-width: 1023px)`, the 16px field rule is behind a touch-device class;
- one registered listener set per page — a second `apply` (HMR, live composition) replaces the previous one instead of stacking.

## Compatibility

| DSH | Profile | Checked on | Status |
| --- | --- | --- | --- |
| `0.2.1-rc.5` | `web` | Chromium fixture at 390×844 in CI, plus a real iPhone PWA by hand | tested |
| other `0.2.x` | `web` | — | expected to work; a large layout redesign may need selector updates |
| desktop ≥ 1024px | `web` | macOS Chrome / Safari | untouched by design |

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Page still looks desktop on the phone | Reload the page; check the plugin is in the `web` profile (`~/.dsh/profiles/web/package.json` → `bundles`) |
| Settings does not open, or opens off-screen | Reload the page; if the panel is missing entirely, open an issue with the phone model and the DSH version |
| iOS still zooms on a field | Make sure the build is 0.6.1+ — the rule keys off the touch device, not the width |
| Drawer does not close on a tap | Try a real phone: desktop browser emulation fires `click` differently |
| Right panel is blank | Open it from the session header; the sheet is per session, not global |
| Session tap selects but does not open | Check the console for a JS error; the fix dispatches `click` from `pointerup` |

## Limitations

- Selectors rely on CSS-module local names; a major redesign will need an update.
- The right panel is presented as a sheet on phones, not resizable.
- No service worker, no Host code: this is a client module only.
- Checked on iOS; Android Chrome should work (the layout rules are width-based) but is not tested.

## Development

| Path | What it is |
| --- | --- |
| `lib/client.js` | the whole browser bundle: stylesheet, drawer logic, swipes, settings sheet |
| `lib/index.js` | empty Host half (a valid Loader entry) |
| `cordis.patch.yml` | inserts the plugin row into the profile |
| `docs/` | screenshots and the demo GIF used by the READMEs |

Edit `lib/client.js`, bump `VERSION` and `package.json`, reload the page — the Host recomposes the bundle per request and the URL carries a content revision. There is no build step.

## Contributing

Issues and PRs are welcome. Please describe the device, the DSH version and what exactly you saw; a screenshot of the phone helps more than a paragraph. For a fix, keep the desktop layout untouched and test at 390×844 before sending.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).

---

English · [Русский](README.ru.md) · [中文](README.zh.md)
