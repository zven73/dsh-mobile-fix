# Contributing

Thanks for taking a look. This is a small client-only patch, so the rules are
short.

## Reporting a bug

Open an issue with:

- the device and browser (for example: iPhone 15, iOS 18, installed PWA);
- the DSH version (`dsh --version`) and this plugin's version (the style tag
  carries it: `document.getElementById('dsh-mobile-fix').dataset.dshMobileFixVersion`);
- what you did, what you expected, what happened — a phone screenshot beats a
  paragraph;
- for anything about the drawer, the host-software buttons or the file preview,
  the output of `__dshMobileFixWhere()` from the page console (it prints the
  version, the address, the user agent and the locality decision).

## Sending a fix

1. Edit `lib/client.js`; there is no build step.
2. Bump `VERSION` in `lib/client.js` and `version` in `package.json` together.
3. Add a line to `CHANGELOG.md`.
4. Check that the desktop layout is untouched at ≥ 1024px and that the phone
   layout still works at 390×844.
5. Run `npm run check` (syntax, lint, unit tests) and `npm run test:browser`
   (Chromium against the fixture shell, `npx playwright install chromium` once).
6. In the PR, say what you changed and how you checked it (a screenshot or a
   short recording is welcome).

## Scope

The plugin fixes the *presentation* of the DSH web client. It does not ship Host
code, does not patch DSH files on disk, and does not add features to the
conversation itself. If a change needs the core, it belongs upstream in
`deepseek-ai/deepseek-harness`.
