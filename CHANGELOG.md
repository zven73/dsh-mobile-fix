# Changelog

All notable changes to this plugin. The version lives in `lib/client.js`
(`VERSION`) and in `package.json`; both must match.

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
