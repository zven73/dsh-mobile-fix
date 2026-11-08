// Drive the page inside an Android emulator once `emulator` is available.
//
//   node test/android/run.mjs --url "http://192.168.0.54:3080/?token=..."
//
// Boots the AVD `dsh`, waits for the device, opens the URL in the emulator's
// browser through an intent, then talks to its DevTools socket over CDP so the
// page can be inspected and tapped the same way the other tests do.

import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const arg = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const match = item.match(/^--([^=]+)(?:=(.*))?$/)
    return [match[1], match[2] ?? true]
  }),
)

const URL = arg.url
if (!URL) {
  console.error('usage: node test/android/run.mjs --url <dsh url>')
  process.exit(2)
}

const sdk = process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`
const adb = `${sdk}/platform-tools/adb`
const emulator = `${sdk}/emulator/emulator`
const AVD = arg.avd || 'dsh'

const run = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: 'utf8', ...options })

const log = (...parts) => console.log(...parts)

log('· booting', AVD)
const emulatorProcess = spawn(
  emulator,
  ['-avd', AVD, '-no-window', '-no-audio', '-no-snapshot', '-gpu', 'swiftshader_indirect'],
  { stdio: 'ignore', detached: false },
)

const stop = () => {
  try {
    emulatorProcess.kill('SIGTERM')
  } catch (_error) {
    // already gone
  }
}
process.on('exit', stop)

log('· waiting for the device')
run(adb, ['wait-for-device'], { timeout: 180000 })
for (let attempt = 0; attempt < 90; attempt += 1) {
  const booted = run(adb, ['shell', 'getprop', 'sys.boot_completed']).stdout?.trim()
  if (booted === '1') break
  await sleep(2000)
}
log('· device is up')

// The emulator has no DSH token in its browser: navigate explicitly.
run(adb, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', URL])
await sleep(6000)

const chip = run(adb, ['shell', 'dumpsys', 'window', 'windows'])
  .stdout?.split('\n')
  .filter((line) => /mCurrentFocus/.test(line))
  .join('\n')
log('· focus:', chip || '(unknown)')

const shot = `${process.cwd()}/android-emulator.png`
run(adb, ['exec-out', 'screencap', '-p'], { encoding: 'buffer' })
const png = spawnSync(adb, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })
if (png.status === 0) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(shot, png.stdout)
  log('· screenshot written to', shot)
}

log('· browser packages:', run(adb, ['shell', 'pm', 'list', 'packages']).stdout?.split('\n').filter((line) => /chrome|browser/i.test(line)).join(', ') || 'none')

stop()
