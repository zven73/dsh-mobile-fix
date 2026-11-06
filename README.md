# DSH Mobile UI

A small browser-side plugin that makes the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
Web UI usable on a phone. Built for the installed iOS PWA, works on any narrow
screen, and leaves the desktop layout untouched.

| Sidebar drawer | Settings | Files / code panel |
| --- | --- | --- |
| ![Drawer](docs/drawer.png) | ![Settings](docs/settings.png) | ![Files](docs/right-panel.png) |

DSH 0.2.x is desktop-first: a three-column grid, a 188px settings nav, a right
panel that collapses to a 0px track, a 14px composer that makes iOS zoom. On a
390px phone that leaves a sliver of chat and a settings dialog you cannot read.
This plugin patches the client bundle from the outside — the Host half is empty,
no core files are copied or modified.

## What it fixes

1. **No more iOS auto-zoom.** Safari zooms a focused field under 16px. All
   `input` / `textarea` / `contenteditable` become 16px on touch devices — and
   the check is the *device* (`html.dsh-mf-touch`), not the viewport width, so
   it still works when the phone shows a wide desktop layout (a mirrored and
   stretched Mac screen). `touch-action: manipulation` keeps double taps from
   moving the next tap off its target.
2. **The chat keeps the full width.** The sidebar column stays a 56px rail; the
   open panel becomes a fixed overlay drawer with a dimmed, blurred scrim.
3. **The drawer closes when you pick a session**, when you tap outside it, or
   when you tap its own close button. The bottom safe area is respected.
4. **Session rows open on the first tap.** iOS treats a plain
   `<div role="treeitem">` with a React handler as "not clickable" and holds its
   click for the double-tap window (~300ms). Closing the drawer first unmounted
   the row, so the tap only closed the menu. The row's click is now dispatched
   synchronously from `pointerup`, before anything moves, and the late native
   click of the same tap is swallowed.
5. **Edge swipes.** Swipe from the left edge to open, swipe left to close.
   Vertical drags stay with the scroller (threshold 36px, vertical drift up to
   34px, 24px edge zone).
6. **Settings fit the phone.** The desktop dialog keeps a 188px nav column next
   to the content — on a 390px screen that left ~150px. On narrow screens the
   section list becomes a horizontal, scrollable strip above the content.
7. **The right panel works.** Its grid track is 0px on a phone, so Files,
   Terminal and the file/code previews opened into nothing. While open
   (`data-sidebar-right-open`) it becomes a full-screen sheet.
8. **Code and tables stay inside the message** and scroll on their own; code in
   the file viewer is 12px instead of 11px.
9. **The iOS keyboard accessory bar no longer sticks.** In a standalone PWA iOS
   can leave the previous/next/Done bar pinned at the bottom after the keyboard
   is dismissed; the plugin drops the field's focus when the keyboard closes,
   which removes the bar.

## Install

Clone it next to your other local plugins and add it to the `web` profile:

```sh
git clone https://github.com/zven73/dsh-mobile-ui.git ~/.dsh/local-plugins/dsh-mobile-ui
dsh plugin --profile web add ~/.dsh/local-plugins/dsh-mobile-ui
```

`dsh plugin` needs `pnpm` on `PATH`. Restart `dsh web` (or let the profile
re-compose) and reload the page on the phone. Client bundles are served from disk with a content revision, so a page
reload is enough for later updates.

> The package id stays `dsh-mobile-fix` (the repository was renamed); do not be
> surprised by that name in `~/.dsh/profiles/web/package.json`.

## Uninstall

```sh
dsh plugin --profile web remove dsh-mobile-fix
```

## Debug

If the Settings panel ever fails to appear (or opens off-screen), set

```js
localStorage.setItem('dsh-mobile-fix-debug', '1')
```

and reload: a red banner reports what happened, and an off-screen panel is
scrolled back into view. Without the flag the plugin stays silent.

## Compatibility

- DSH `0.2.x` (verified on `0.2.1-rc.5`), `web` profile only.
- Phone layout applies up to 1023px; the 16px field rule applies on any touch
  device. Desktop composition is not changed.
- Checked in WebKit with an iPhone 14 viewport (390×844, touch) and on a real
  iPhone PWA.

## Limitations

- Selectors use the stable halves of the CSS-module class names (`sidebarCol`,
  `centerCol`, `rightbarCol`, `sessionRow`, `_root`, `_collapsed`, `toggle`) and
  the public `data-slot` names. A large layout redesign will need an update.
- The right panel is presented as a sheet on phones, not resizable.
- No service worker, no Host code: it is only a client module.

## Changelog

- `0.6.2` — blur the field when the keyboard closes (stuck iOS accessory bar).
- `0.6.1` — the 16px rule follows the touch device, not the viewport width; adds
  `touch-action: manipulation`.
- `0.6.0` — touch-target fixes; debug diagnostics behind a flag.
- `0.5.x` — settings sheet, full-screen right panel, code reader at 12px.
- `0.4.x` — edge swipes (open/close), earlier trigger (36px).
- `0.3.5` — session rows open on the first tap on iOS.
- `0.3.0`–`0.3.4` — drawer close rules: outside tap, row tap, protected
  handlers.
- `0.1.0`–`0.2.0` — 16px fields, sidebar drawer, auto-close.

## License

MIT — see [LICENSE](LICENSE).

---

English · [Русский](README.ru.md) · [中文](README.zh.md)
