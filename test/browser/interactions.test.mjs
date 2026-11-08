// Browser regression tests for the interaction paths.
//
// The unit tests cover the pure helpers; these cover what a phone actually does:
// the drawer, a session tap, the file overlay, the ZIP reader and disposal.
// They run against the fixture in `fixture.html` over a real HTTP origin.
//
//   npm run test:browser
//
// Chromium is enough for the DOM behaviour; the iOS-specific timing is emulated
// by dispatching the same events WebKit sends.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { startFixture, lanAddress } from './server.mjs'

let fixture
let browser

before(async () => {
  fixture = await startFixture()
  browser = await chromium.launch({ args: process.env.CI ? ['--no-sandbox'] : [] })
})

after(async () => {
  await browser?.close()
  await fixture?.close()
})

/** Open the fixture in a phone-sized page and apply the plugin. */
async function openPage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(fixture.base, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('[class*="centerCol"]') !== null)
  await page.waitForTimeout(120)
  return { context, page, errors }
}

const tapRow = (page, selector) =>
  page.evaluate((sel) => {
    const row = document.querySelector(sel)
    const rect = row.getBoundingClientRect()
    row.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10, button: 0,
    }))
    row.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10, button: 0,
    }))
  }, selector)

test('an edge swipe opens the drawer and marks the document', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => {
    const touch = (x, y) => ({ clientX: x, clientY: y, identifier: 1 })
    const fire = (type, x, y) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch(x, y)] })
      Object.defineProperty(event, 'changedTouches', { value: [touch(x, y)] })
      document.body.dispatchEvent(event)
    }
    fire('touchstart', 6, 300)
    for (let step = 1; step <= 8; step += 1) fire('touchmove', 6 + step * 18, 300)
    fire('touchend', 150, 300)
  })
  await page.waitForTimeout(120)
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dsh-mf-drawer')), true)
  await context.close()
})

test('a session row opens on pointerup and stays selected', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => document.getElementById('toggle').click())
  await tapRow(page, '#row-b')
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => document.getElementById('current').textContent), 'Session B')
  await context.close()
})

test('a right click does not open a session', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => document.getElementById('toggle').click())
  const box = await page.locator('#row-b').boundingBox()
  await page.mouse.click(box.x + 10, box.y + 10, { button: 'right' })
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => document.getElementById('current').textContent), 'Session A')
  await context.close()
})

test('a file link opens the overlay with the image', async () => {
  const { context, page } = await openPage()
  await page.locator('#file-link').click()
  await page.waitForTimeout(400)
  const state = await page.evaluate(() => {
    const overlay = document.getElementById('dsh-mobile-file-overlay')
    const image = overlay?.querySelector('img')
    return {
      overlay: Boolean(overlay),
      role: overlay?.getAttribute('role'),
      label: overlay?.getAttribute('aria-label'),
      loaded: image ? image.naturalWidth > 0 : false,
    }
  })
  assert.equal(state.overlay, true)
  assert.equal(state.role, 'dialog')
  assert.equal(state.label, 'image.png')
  assert.equal(state.loaded, true)
  await context.close()
})

test('a download link is not intercepted', async () => {
  const { context, page } = await openPage()
  const opened = await page.evaluate(() => {
    let intercepted = false
    const link = document.getElementById('download-link')
    link.addEventListener('click', (event) => {
      intercepted = event.defaultPrevented
      event.preventDefault() // keep the fixture page in place
    })
    link.click()
    return intercepted
  })
  await page.waitForTimeout(200)
  assert.equal(opened, false, 'the plugin must not preventDefault a download link')
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('dsh-mobile-file-overlay'))), false)
  await context.close()
})

test('a gallery pages with the edge zones and the counter', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => {
    window.__dshMobileFileOverlay(
      new URL('/api/file?path=%2Ffake%2Fimage.png', location.href),
      ['/fake/image.png', '/fake/second.png'],
    )
  })
  await page.waitForTimeout(300)
  const readCounter = () =>
    page.evaluate(() => {
      const overlay = document.getElementById('dsh-mobile-file-overlay')
      const span = [...overlay.querySelectorAll('span')].find((node) => /^\d+ \/ \d+$/.test(node.textContent))
      return span ? span.textContent : null
    })
  assert.equal(await readCounter(), '1 / 2')
  await page.evaluate(() => {
    const zone = [...document.querySelectorAll('#dsh-mobile-file-overlay button')]
      .find((node) => /Следующий|Next/.test(node.getAttribute('aria-label') || ''))
    zone.click()
  })
  await page.waitForTimeout(120)
  assert.equal(await readCounter(), '2 / 2')
  await context.close()
})

test('a ZIP lists its files and refuses a bomb', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => window.open('/api/file?path=%2Ffake%2Farchive.zip', '_blank'))
  await page.waitForTimeout(500)
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('#dsh-mobile-file-overlay button')]
      .map((node) => node.textContent.trim())
      .filter((text) => /readme|card/.test(text)),
  )
  assert.equal(rows.length, 2)
  await context.close()
})

test('the bomb archive is refused as too large', async () => {
  const { context, page } = await openPage()
  await page.evaluate(() => window.open('/api/file?path=%2Ffake%2Fbomb.zip', '_blank'))
  await page.waitForTimeout(600)
  // The archive itself is tiny; the 65 MiB member is the bomb, so open it.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#dsh-mobile-file-overlay button')]
      .find((node) => /bomb\.bin/.test(node.textContent))
    row.click()
  })
  await page.waitForTimeout(800)
  const message = await page.evaluate(() => {
    const overlay = document.getElementById('dsh-mobile-file-overlay')
    return overlay ? overlay.innerText : ''
  })
  assert.match(message, /too large|слишком боль/i)
  await context.close()
})

test('a pointer device does not get the phone overlay', async () => {
  // A desktop browser: the hook must decline so the app's own preview is used.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(fixture.base, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('[class*="centerCol"]') !== null)
  await page.waitForTimeout(150)
  const accepted = await page.evaluate(() =>
    window.__dshMobileFileOverlay(new URL('/api/file?path=%2Ffake%2Fimage.png', location.href), []),
  )
  assert.equal(accepted, false)
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('dsh-mobile-file-overlay'))), false)
  await context.close()
})

test('closing the sheet while a save is in flight does not throw', async () => {
  const { context, page, errors } = await openPage()
  await page.evaluate(async () => {
    window.open('/api/file?path=%2Ffake%2Fimage.png', '_blank')
    await new Promise((resolve) => setTimeout(resolve, 300))
    const button = [...document.querySelectorAll('#dsh-mobile-file-overlay button')]
      .find((node) => /Сохранить|Save/.test(node.textContent))
    button.click()
    document.getElementById('dsh-mobile-file-overlay').remove()
  })
  await page.waitForTimeout(600)
  assert.deepEqual(errors, [])
  await context.close()
})

test('a remote client hides the host actions and gets them back on dispose', async (t) => {
  const lan = lanAddress()
  if (!lan) {
    t.skip('no non-loopback address on this machine')
    return
  }
  // Served over the network, the client is remote: host-software buttons go away.
  const remote = await startFixture(lan)
  // A phone user agent: the same page over a LAN address, opened from a phone.
  const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  await page.goto(remote.base, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('[class*="centerCol"]') !== null)
  await page.waitForTimeout(150)

  const hidden = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('host-action')).display,
    remote: document.documentElement.classList.contains('dsh-mf-remote'),
    inline: document.getElementById('host-action').getAttribute('style') || '',
  }))
  assert.equal(hidden.remote, true)
  assert.equal(hidden.display, 'none')
  assert.equal(hidden.inline, '', 'hiding must not write inline styles')

  const restored = await page.evaluate(() => {
    for (const dispose of window.__disposers.reverse()) dispose()
    return {
      display: getComputedStyle(document.getElementById('host-action')).display,
      remote: document.documentElement.classList.contains('dsh-mf-remote'),
    }
  })
  assert.equal(restored.remote, false)
  assert.notEqual(restored.display, 'none')

  await context.close()
  await remote.close()
})

test('a pinch keeps the composer focused', async () => {
  const { context, page } = await openPage()
  const focused = await page.evaluate(async () => {
    const field = document.getElementById('composer')
    field.focus()
    const viewport = window.visualViewport
    const set = (width, height) => {
      Object.defineProperty(viewport, 'width', { configurable: true, value: width })
      Object.defineProperty(viewport, 'height', { configurable: true, value: height })
      viewport.dispatchEvent(new Event('resize'))
    }
    set(viewport.width, viewport.height - 300) // keyboard opens
    await new Promise((resolve) => setTimeout(resolve, 60))
    set(viewport.width - 120, viewport.height - 300) // pinch while it is open
    await new Promise((resolve) => setTimeout(resolve, 60))
    return document.activeElement === field
  })
  assert.equal(focused, true)
  await context.close()
})
