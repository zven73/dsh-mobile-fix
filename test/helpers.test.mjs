// Unit tests for the pure helpers of lib/client.js.
// The file is a browser bundle, so it is loaded through a stub module loader.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'lib', 'client.js'), 'utf8')

/** Load the bundle and return the exports the plugin registers. */
function loadBundle(language = 'en-US', locationOverride = null) {
  let registration = null
  const sandbox = {
    navigator: { language, maxTouchPoints: 0, standalone: false },
    location: locationOverride
      ? { ...locationOverride, origin: new URL(locationOverride.href).origin }
      : { href: 'http://127.0.0.1:8765/', origin: 'http://127.0.0.1:8765', hostname: '127.0.0.1', protocol: 'http:' },
    history: { pushState() {}, back() {}, state: null },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    open: () => null,
    scrollTo() {},
    scrollX: 0,
    scrollY: 0,
    innerHeight: 800,
    innerWidth: 390,
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ overflowY: 'visible' }),
    requestAnimationFrame: (fn) => { setTimeout(fn, 0); return 1 },
    console,
    URL,
    Element: class Element {},
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    cancelAnimationFrame() {},
    TextDecoder,
    TextEncoder,
    Blob,
    Response,
    File,
    setTimeout,
    clearTimeout,
    document: {
      documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener() {},
      removeEventListener() {},
      createElement: () => ({
        style: {},
        dataset: {},
        append() {},
        addEventListener() {},
        setAttribute() {},
        remove() {},
      }),
      head: { append() {} },
      body: { append() {}, children: [] },
      activeElement: null,
    },
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.window.__ModuleLoader__ = {
    load(reg) {
      registration = reg
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)
  assert.ok(registration, 'the bundle registered a module')
  const api = registration.factory()
  // `apply` is where the helpers live; the stub DOM makes it a no-op.
  api.apply({})
  return api.__test
}

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

const helpers = loadBundle()

/** Same loader, but with a chosen page origin. */
function loadBundleAt(href) {
  const url = new URL(href)
  const proto = url.protocol
  return loadBundle('en-US', {
    href,
    hostname: url.hostname,
    protocol: proto,
  })
}

/** Build a minimal ZIP in memory: one stored entry and one deflated entry. */
function buildZip(entries) {
  const chunks = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data)
    const body = entry.deflate ? deflateRawSync(data) : data
    const method = entry.deflate ? 8 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(0x14, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, body)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(0x14, 4)
    dir.writeUInt16LE(0x14, 6)
    dir.writeUInt16LE(0x08, 8) // data descriptor flag free entry
    dir.writeUInt16LE(0, 10) // flags: not encrypted
    dir.writeUInt16LE(method, 10)
    dir.writeUInt32LE(body.length, 20)
    dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(name.length, 28)
    dir.writeUInt32LE(offset, 42)
    central.push(dir, name)
    offset += local.length + name.length + body.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  const buffer = Buffer.concat([...chunks, centralBuffer, end])
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

test('readZipEntries reads names, sizes and flags without inflating', () => {
  const zip = buildZip([
    { name: 'readme.txt', data: 'hello from inside', deflate: false },
    { name: 'assets/card.png', data: 'x'.repeat(400), deflate: true },
  ])
  const entries = helpers.readZipEntries(zip)
  assert.equal(entries.length, 2)
  assert.equal(entries.map((entry) => entry.name).join(','), 'readme.txt,assets/card.png')
  assert.equal(entries[0].size, 17)
  assert.equal(entries[0].method, 0)
  assert.equal(entries[1].method, 8)
  assert.equal(entries[0].encrypted, false)
  assert.equal(entries[0].zip64, false)
  assert.equal(entries[0].directory, false)
})

test('readZipEntries rejects a file that is not a ZIP', () => {
  assert.throws(() => helpers.readZipEntries(new ArrayBuffer(64)))
})

test('isFileUrl accepts only same-origin /api/file addresses', () => {
  assert.equal(helpers.isFileUrl('/api/file?path=%2Ftmp%2Fa.png').pathname, '/api/file')
  assert.equal(helpers.isFileUrl('http://127.0.0.1:8765/api/file?path=x').pathname, '/api/file')
  assert.equal(helpers.isFileUrl('https://example.com/api/file?path=x'), null)
  assert.equal(helpers.isFileUrl('/api/sessions'), null)
  assert.equal(helpers.isFileUrl('not a url'), null)
})

test('collectGallery builds sibling URLs from the opened one', () => {
  const url = new URL('http://127.0.0.1:8765/s/abc/api/file?path=%2Fw%2Fb.png&token=t')
  const found = helpers.collectGallery(url, ['/w/a.png', '/w/notes.txt', '/w/b.png'])
  assert.ok(found, 'a gallery was found')
  assert.equal(found.urls.length, 2)
  assert.equal(found.index, 1)
  const hrefs = found.urls.map((item) => item.href)
  assert.ok(hrefs[0].includes('/s/abc/api/file'), 'keeps the deployment prefix')
  assert.ok(hrefs[0].includes('token=t'), 'keeps the other query params')
})

test('collectGallery returns null when the opened file is not in the group', () => {
  const url = new URL('http://127.0.0.1:8765/api/file?path=%2Fw%2Fdoc.pdf')
  assert.equal(helpers.collectGallery(url, ['/w/a.png', '/w/b.png']), null)
})

test('collectGallery ignores a single image', () => {
  const url = new URL('http://127.0.0.1:8765/api/file?path=%2Fw%2Fa.png')
  assert.equal(helpers.collectGallery(url, ['/w/a.png']), null)
})

test('a loopback page is always the local client', () => {
  const { resolveRemote } = loadBundle()
  assert.equal(resolveRemote({ protocol: 'http:', hostname: '127.0.0.1', userAgent: MAC_UA, override: null }), false)
  assert.equal(resolveRemote({ protocol: 'http:', hostname: 'localhost', userAgent: PHONE_UA, override: null }), false)
})

test('a phone on the network is remote, a desktop on the network is not', () => {
  const { resolveRemote } = loadBundle()
  // the owner's case: the same Mac, opened through its LAN address
  assert.equal(resolveRemote({ protocol: 'http:', hostname: '192.168.0.234', userAgent: MAC_UA, override: null }), false)
  assert.equal(resolveRemote({ protocol: 'http:', hostname: '192.168.0.234', userAgent: PHONE_UA, override: null }), true)
  assert.equal(resolveRemote({ protocol: 'https:', hostname: 'dsh.example.com', userAgent: PHONE_UA, override: null }), true)
})

test('the explicit override wins over detection', () => {
  const { resolveRemote } = loadBundle()
  assert.equal(resolveRemote({ protocol: 'http:', hostname: '192.168.0.234', userAgent: PHONE_UA, override: '1' }), false)
  assert.equal(resolveRemote({ protocol: 'http:', hostname: '127.0.0.1', userAgent: MAC_UA, override: '0' }), true)
})

test('the desktop shell is local', () => {
  const { resolveRemote } = loadBundle()
  assert.equal(resolveRemote({ protocol: 'dsh-app:', hostname: '', userAgent: MAC_UA, override: null }), false)
})

test('humanSize formats bytes for a phone reader', () => {
  assert.equal(helpers.humanSize(0), '0 B')
  assert.equal(helpers.humanSize(999), '999 B')
  assert.equal(helpers.humanSize(2048), '2 KB')
  assert.equal(helpers.humanSize(5 * 1024 * 1024), '5.0 MB')
  const ru = loadBundle('ru-RU')
  assert.equal(ru.humanSize(2048), '2 КБ')
  assert.equal(helpers.humanSize(Number.NaN), '')
})

test('the file counter pluralizes in Russian and English', () => {
  const ru = loadBundle('ru-RU').T
  assert.equal(ru.files(1), 'файл')
  assert.equal(ru.files(3), 'файла')
  assert.equal(ru.files(21), 'файл')
  assert.equal(ru.files(8), 'файлов')
  assert.equal(ru.files(111), 'файлов')
  const en = loadBundle('en-US').T
  assert.equal(en.files(1), 'file')
  assert.equal(en.files(2), 'files')
})
