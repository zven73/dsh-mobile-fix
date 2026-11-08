// Static + fake-API server for the browser regression tests.
//
// The bundle needs a real HTTP origin: `/api/file` must fetch, the overlay
// compares `location.origin`, and `history.pushState` has to behave. So the
// tests serve the fixture, the bundle and a handful of fake files from memory.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { networkInterfaces } from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Minimal ZIP writer: one stored and one deflated entry, same as the unit test. */
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
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    chunks.push(local, name, body)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(0x14, 4)
    dir.writeUInt16LE(0x14, 6)
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
  return Buffer.concat([...chunks, centralBuffer, end])
}

const FILES = {
  '/fake/image.png': { body: PNG_1X1, type: 'image/png' },
  '/fake/second.png': { body: PNG_1X1, type: 'image/png' },
  '/fake/notes.txt': { body: Buffer.from('hello from the fixture\n'), type: 'text/plain' },
  '/fake/page.html': { body: Buffer.from('<!doctype html><title>fixture</title><p>page</p>'), type: 'text/html' },
  '/fake/archive.zip': {
    body: buildZip([
      { name: 'readme.txt', data: 'inside the archive', deflate: false },
      { name: 'assets/card.png', data: Buffer.alloc(64, 1), deflate: true },
    ]),
    type: 'application/zip',
  },
  // 65 MiB of zeros compresses to a few KiB: the inflate cap must refuse it.
  '/fake/bomb.zip': {
    body: buildZip([{ name: 'bomb.bin', data: Buffer.alloc(65 * 1024 * 1024), deflate: true }]),
    type: 'application/zip',
  },
}

/**
 * Start the fixture server on a free port.
 * @returns the base URL and a close function.
 */
export async function startFixture(host = '127.0.0.1') {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/' || url.pathname === '/fixture.html') {
      const html = await readFile(path.join(here, 'fixture.html'))
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(html)
      return
    }
    if (url.pathname === '/lib/client.js') {
      const source = await readFile(path.join(here, '..', '..', 'lib', 'client.js'))
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      response.end(source)
      return
    }
    if (url.pathname === '/api/file') {
      const file = FILES[url.searchParams.get('path')]
      if (!file) {
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('not found')
        return
      }
      response.writeHead(200, { 'content-type': file.type, 'content-length': file.body.length })
      response.end(file.body)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise((resolve) => server.listen(0, host, resolve))
  const { port } = server.address()
  return {
    base: `http://${host}:${port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

/**
 * Pick a non-loopback IPv4 the machine can be reached on, so a test can act as
 * a remote client. Returns null when the machine has only loopback.
 */
export function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  return null
}
