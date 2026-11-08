/**
 * Browser half of `dsh-mobile-fix`.
 *
 * Scope: the phone layout (<= 1023px) plus a few rules that key off the input
 * device instead of the width. Desktop composition is untouched.
 *
 * 1. iOS autozooms a focused field under 16px; every editable becomes 16px on a
 *    touch device (`html.dsh-mf-touch`), at any viewport width.
 * 2. The sidebar keeps its 56px rail and the open panel is promoted to a fixed
 *    overlay drawer with a dimmed, blurred scrim.
 * 3. The drawer closes on a session pick, on an outside tap and on its own
 *    close button; the bottom safe area is respected.
 * 4. Edge swipes: left edge opens, swipe left closes.
 * 5. Session rows open on the first tap — the row's `click` is dispatched from
 *    `pointerup`, because iOS holds it for the double-tap window and the drawer
 *    may unmount the row first.
 * 6. Settings get a horizontal section strip and the account card stacks.
 * 7. The right panel opens as a full-screen sheet instead of a 0px track.
 * 8. Code and tables scroll inside the message; the code reader is 12px.
 * 9. A raw `/api/file` URL is kept inside the app: links and `window.open`
 *    calls that target it open an overlay instead of iOS Quick Look.
 * 10. That overlay previews images, PDF, audio, video, text and ZIP, pages a
 *     group of images like a story, and saves the current file through the
 *     share sheet — with the chat scroll position restored on close.
 *
 * The click handling is deliberately defensive: one registered listener per
 * page (a repeated apply replaces the previous one), a close lock so a second
 * copy of the handler can never toggle the drawer back open, and a blanket
 * opt-out for any interactive control so the app's own buttons — including its
 * close button — are never fought over.
 *
 * Shape of the file: `createFileViewer()` owns the overlay and the `/api/file`
 * interception, `apply()` owns the phone layout, the drawer, the keyboard guard
 * and the remote-client rules. They share only a stylesheet and a few helpers.
 *
 * Selectors use the stable local halves of the CSS-module class names
 * (`sidebarCol`, `centerCol`, `rightbarCol`, `sessionRow`, `_root`,
 * `_collapsed`, `toggle`) plus the public `data-slot` names, so a rebuild that
 * changes the module hash keeps working.
 */
window.__ModuleLoader__.load({
	id: 'dsh-mobile-fix',
	factory: () => {
		var module = { exports: {} }
		var exports = module.exports

		const VERSION = '0.12.1'
		const STYLE_ID = 'dsh-mobile-fix'
		const HANDLERS_KEY = '__dshMobileFixClickHandlers'
		const MOBILE_QUERY = '(max-width: 1023px)'
		/** Horizontal travel (px) that turns a finger drag into a drawer swipe. */
		const SWIPE_DISTANCE = 36
		/** Vertical drift (px) that still counts as a horizontal swipe. */
		const SWIPE_SLOP = 34
		/** How far from the left screen edge an opening swipe may start. */
		const SWIPE_EDGE = 24
		/** Minimum gap (ms) between two swipe-driven toggles. */
		const SWIPE_LOCK_MS = 350
		const TOGGLE = '[class*="sidebarCol"] button[class*="toggle"]'
		const INTERACTIVE =
			'button, a, select, input, textarea, summary, ' +
			'[role="button"], [role="menuitem"], [role="menu"], [role="tab"], ' +
			'[role="switch"], [role="checkbox"], [role="option"], ' +
			'[contenteditable]:not([contenteditable="false"])'

		const CSS = `
/* iOS zooms the page whenever a focused editable computes to less than 16px.
   The trigger is the finger, not the viewport width: a phone that shows a wide
   desktop layout (mirrored / stretched Mac screen) still zooms, and a zoomed
   page puts later taps off their targets. 'html.dsh-mf-touch' is set by the
   script below from navigator.maxTouchPoints, so this survives any width. */
html.dsh-mf-touch input,
html.dsh-mf-touch textarea,
html.dsh-mf-touch [contenteditable]:not([contenteditable="false"]) {
  font-size: 16px !important;
}

/* Host-side "open in <app>" controls act on the machine that runs DSH. A
   client that reached the Host over the network — a phone, or another desktop —
   has no use for them: the app opens on the server, not in front of the user.
   The markup comes from the open-in-app plugin and carries stable data hooks. */
html.dsh-mf-remote [data-open-target],
html.dsh-mf-remote [data-open-path-open],
html.dsh-mf-remote [data-open-path-more],
html.dsh-mf-remote .dsh-mf-hidden {
  display: none !important;
}

/* Double-tap zoom on a tap target moves the next tap off the item. */
html.dsh-mf-touch button,
html.dsh-mf-touch [role="button"],
html.dsh-mf-touch a,
html.dsh-mf-touch [role="menuitem"],
html.dsh-mf-touch [role="option"],
html.dsh-mf-touch [role="tab"] {
  touch-action: manipulation;
}

@media (max-width: 1023px) {
  html.dsh-mf-drawer [class*="frame"] {
    grid-template-columns: 56px minmax(0, 1fr) 0 !important;
  }

  html.dsh-mf-drawer [class*="frame"]::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 79;
    background: rgba(0, 0, 0, .55);
    backdrop-filter: blur(3px);
    pointer-events: auto;
  }

  html.dsh-mf-drawer [class*="sidebarCol"] {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: auto !important;
    max-width: 86vw;
    z-index: 80;
    box-shadow: 8px 0 28px rgba(0, 0, 0, .45);
  }

  [class*="centerCol"] {
    grid-column: 2 !important;
    min-width: 0 !important;
  }

  [class*="rightbarCol"] {
    grid-column: 3 !important;
  }

  [class*="frame"] > [class*="handle"] {
    display: none !important;
  }

  [data-slot="conversation.composer.dock"] {
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }

  /* The right panel is a real column on desktop and a 0px grid track on a
     phone. Promote it to a full-screen sheet while it is open, so Files,
     Terminal and the file/code previews are reachable instead of invisible. */
  [class*="rightbarCol"]:has([data-sidebar-right-open="true"]) {
    position: fixed !important;
    inset: 0 !important;
    display: block !important;
    width: 100vw !important;
    height: 100dvh !important;
    z-index: 90 !important;
    background: var(--dsw-alias-bg-base, #fff);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Settings on a phone: keep the app's own panel size and centering, but
     stack the section list above the content instead of keeping the desktop's
     188px nav column, which left ~150px for the content on a 390px screen. */
  [data-shortcut-modal="settings"] {
    flex-direction: column !important;
  }

  [data-shortcut-modal="settings"] > nav {
    box-sizing: border-box;
    width: 100% !important;
    flex: none !important;
    gap: 2px !important;
    padding: 10px 10px 0 !important;
    border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, .18));
  }

  [data-shortcut-modal="settings"] > nav > div:last-child {
    flex-direction: row !important;
    gap: 4px !important;
    padding-bottom: 8px !important;
    overflow-x: auto !important;
    scrollbar-width: none;
  }

  [data-shortcut-modal="settings"] > nav > div:last-child::-webkit-scrollbar {
    display: none;
  }

  [data-shortcut-modal="settings"] > nav button {
    flex: none !important;
    height: 32px !important;
    padding: 5px 10px !important;
    white-space: nowrap;
  }

  [data-shortcut-modal="settings"] > nav button > span {
    overflow: visible !important;
    text-overflow: clip !important;
  }

  [data-shortcut-modal="settings"] > div {
    min-height: 0;
  }

  /* Account card inside Settings: on desktop the identity text and the
     "More account information" link share one row, and on a phone the link
     takes the width while the title collapses into a 90px column. Stack them. */
  [data-shortcut-modal="settings"] [class*="_card"] {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  [data-shortcut-modal="settings"] [class*="_accountInfo"] {
    align-self: flex-start;
    text-align: left;
    white-space: normal;
  }

  /* Balance rows: wrap the buttons under the label instead of squeezing it. */
  [data-shortcut-modal="settings"] [class*="_balanceCard"] [class*="_row"] {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  [data-shortcut-modal="settings"] [class*="_balanceCard"] [class*="_links"] {
    justify-content: flex-start;
  }

  /* Code and tables stay inside the bubble: they scroll on their own instead
     of widening the message column. */
  [class*="centerCol"] :where(pre, table) {
    max-width: 100%;
  }

  [class*="centerCol"] :where(pre) {
    -webkit-overflow-scrolling: touch;
  }

  /* The file viewer renders code at 11px, which is tiny on a phone. */
  [class*="rightbarCol"] :where(pre) {
    font-size: 12px !important;
  }
}
`

		function installStyles() {
			let style = document.getElementById(STYLE_ID)
			if (!style) {
				style = document.createElement('style')
				style.id = STYLE_ID
				document.head.append(style)
			}
			style.dataset.dshMobileFixVersion = VERSION
			style.textContent = CSS
			return style
		}

		/**
		 * The in-app file viewer: catches `/api/file` links and `window.open`, renders
		 * the overlay (image, PDF, HTML, audio, video, text, ZIP), pages a group of
		 * images like a story and saves the current file. Independent of the drawer
		 * and the keyboard guard, so it is reasoned about and disposed on its own.
		 * @param deps - `interceptFileLinks` decides whether a tap is taken over;
		 *   `pointerTarget` returns the element of the last pointerdown.
		 * @returns open/close handles, the window hook and the pure internals.
		 */
		function createFileViewer(deps) {
			// A raw /api/file URL opened from the PWA hands the resource to iOS,
			// which shows it in a native Quick Look sheet with no way back to DSH.
			// Catch those links and window.open calls and show the file in an
			// in-app overlay with a close button instead.
			const OVERLAY_ID = 'dsh-mobile-file-overlay'
			const isFileUrl = (value) => {
				try {
					const url = new URL(String(value || ''), location.href)
					if (url.origin !== location.origin) return null
					if (!url.pathname.endsWith('/api/file')) return null
					return url
				} catch (_error) {
					return null
				}
			}

			let overlay = null
			let overlayPushed = false
			let pendingPop = 0
			let gallery = []
			let galleryIndex = 0
			let savedScroll = null
			let stage = null
			let counter = null
			let saveButton = null

			/** The surfaces that actually scroll the conversation, not the whole DOM. */
			const scrollables = () => {
				const found = []
				const seen = new Set()
				const add = (node) => {
					if (!node || seen.has(node) || !(node instanceof Element)) return
					const computed = getComputedStyle(node)
					if (/(auto|scroll)/.test(computed.overflowY) && node.scrollHeight > node.clientHeight + 4) {
						seen.add(node)
						found.push(node)
					}
				}
				const roots = document.querySelectorAll('[class*="centerCol"], [data-slot="conversation"]')
				for (const root of roots) {
					add(root)
					// Bounded walk: a virtualised list can be deep, but the scroller is
					// always one of the first few levels.
					let budget = 400
					const queue = [...root.children]
					while (queue.length > 0 && budget > 0) {
						const node = queue.shift()
						budget -= 1
						add(node)
						queue.push(...node.children)
					}
				}
				return found
			}

			const rememberScroll = () => {
				savedScroll = scrollables().map((node) => ({ node, top: node.scrollTop, left: node.scrollLeft }))
				savedScroll.windowY = window.scrollY
			}

			const restoreScroll = () => {
				if (!savedScroll) return
				const entries = savedScroll
				savedScroll = null
				const put = () => {
					for (const entry of entries) {
						if (entry.node.isConnected) {
							entry.node.scrollTop = entry.top
							entry.node.scrollLeft = entry.left
						}
					}
					window.scrollTo(window.scrollX, entries.windowY ?? window.scrollY)
				}
				requestAnimationFrame(put)
				setTimeout(put, 60)
				setTimeout(put, 240)
			}

			/** Shared teardown: the button, the backdrop, Escape and the back gesture. */
			let closeFileOverlayFocus = null

			const teardownOverlay = ({ restoreScroll: putBack = true } = {}) => {
				if (!overlay) return
				if (closeFileOverlayFocus) {
					closeFileOverlayFocus()
					closeFileOverlayFocus = null
				}
				overlay.remove()
				overlay = null
				stage = null
				counter = null
				saveButton = null
				if (putBack) restoreScroll()
			}

			const closeFileOverlay = () => {
				if (!overlay) return
				teardownOverlay({ restoreScroll: true })
				if (overlayPushed) {
					overlayPushed = false
					pendingPop += 1
					history.back()
				}
			}

			const STRINGS = {
				ru: {
					close: 'Закрыть',
					save: 'Сохранить в «Файлы»',
					saving: 'Готовлю файл…',
					saveFailed: 'Не получилось, попробуй ещё раз',
					loading: 'Загружаю…',
					loadFailed: 'Не удалось прочитать файл.',
					truncated: '… файл обрезан для просмотра',
					backToArchive: '‹ Все файлы архива',
					archiveLoading: 'загружаю…',
					archiveEmpty: 'В архиве нет файлов.',
					archiveFailed: 'Не удалось прочитать архив.',
					unsupportedInside: 'Этот файл внутри архива нельзя показать — сохрани архив и открой его в «Файлах».',
					unsupportedInflate: 'Не удалось распаковать этот файл (сжатие не поддерживается).',
					encrypted: 'Архив защищён паролем — содержимое не показать.',
					zip64: 'Архив слишком большой для просмотра на телефоне.',
					tooLarge: 'Файл внутри архива слишком большой для просмотра.',
					notShown: 'Файл не показывается в приложении: ',
					previous: 'Предыдущий файл',
					next: 'Следующий файл',
					counter: (index, total) => `${index} / ${total}`,
					files: (count) => {
						const mod10 = count % 10
						const mod100 = count % 100
						if (mod10 === 1 && mod100 !== 11) return 'файл'
						if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'файла'
						return 'файлов'
					},
				},
				en: {
					close: 'Close',
					save: 'Save to Files',
					saving: 'Preparing…',
					saveFailed: 'Failed, try again',
					loading: 'Loading…',
					loadFailed: 'Could not read the file.',
					truncated: '… file truncated for preview',
					backToArchive: '‹ All archive files',
					archiveLoading: 'loading…',
					archiveEmpty: 'The archive has no files.',
					archiveFailed: 'Could not read the archive.',
					unsupportedInside: 'This file cannot be shown here — save the archive and open it in Files.',
					unsupportedInflate: 'Could not unpack this file (unsupported compression).',
					encrypted: 'The archive is password-protected.',
					zip64: 'The archive is too large to preview on a phone.',
					tooLarge: 'The file inside the archive is too large to preview.',
					notShown: 'Not previewable here: ',
					previous: 'Previous file',
					next: 'Next file',
					counter: (index, total) => `${index} / ${total}`,
					files: (count) => (count === 1 ? 'file' : 'files'),
				},
			}
			const T = ((navigator.language || '').toLowerCase().startsWith('ru')
				? STRINGS.ru
				: STRINGS.en)

			const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']
			const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac']
			const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v', 'ogv']
			const ARCHIVE_EXT = ['zip']
			const TEXT_EXT = ['txt', 'md', 'json', 'csv', 'tsv', 'log', 'yaml', 'yml', 'toml', 'ini', 'xml', 'css', 'js', 'mjs', 'ts', 'py', 'sh', 'sql']

			const textStyle = 'color:#fff;font:14px/20px -apple-system, system-ui, sans-serif'
			const panelStyle = [
				'width:min(760px,100%)',
				'max-height:100%',
				'box-sizing:border-box',
				'background:#15161a',
				'border:1px solid rgba(255,255,255,.12)',
				'border-radius:12px',
				'overflow:hidden',
				'display:flex',
				'flex-direction:column',
			].join(';')

			/** Read a workspace file as text; the overlay only ever shows local files. */
			const fetchChecked = async (url) => {
				const response = await fetch(url.href)
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				return response
			}

			const readText = (url) => fetchChecked(url).then((response) => response.text())

			const buildTextView = (url, name) => {
				const panel = document.createElement('div')
				panel.style.cssText = panelStyle
				const head = document.createElement('div')
				head.style.cssText = 'flex:none;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);font:600 13px/18px -apple-system, system-ui, sans-serif;color:#9aa4b2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
				head.textContent = name
				const pre = document.createElement('pre')
				pre.style.cssText = 'margin:0;padding:12px 14px;overflow:auto;color:#e8ecf2;font:12px/18px ui-monospace, Menlo, monospace;white-space:pre-wrap;word-break:break-word'
				pre.textContent = T.loading
				panel.append(head, pre)
				readText(url)
					.then((text) => {
						pre.textContent = text.length > 400000 ? `${text.slice(0, 400000)}\n\n${T.truncated}` : text
					})
					.catch(() => {
						pre.textContent = T.loadFailed
					})
				return panel
			}

			/** Parse the ZIP central directory: names and sizes without inflating. */
			const readZipEntries = (buffer) => {
				const view = new DataView(buffer)
				const bytes = new Uint8Array(buffer)
				const eocd = (() => {
					for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65558); i -= 1) {
						if (view.getUint32(i, true) === 0x06054b50) return i
					}
					return -1
				})()
				if (eocd < 0) throw new Error('not a zip')
				const count = view.getUint16(eocd + 10, true)
				let offset = view.getUint32(eocd + 16, true)
				const decoder = new TextDecoder()
				const entries = []
				for (let index = 0; index < count; index += 1) {
					if (view.getUint32(offset, true) !== 0x02014b50) break
					const flags = view.getUint16(offset + 8, true)
					const method = view.getUint16(offset + 10, true)
					const compressed = view.getUint32(offset + 20, true)
					const size = view.getUint32(offset + 24, true)
					const nameLength = view.getUint16(offset + 28, true)
					const extraLength = view.getUint16(offset + 30, true)
					const commentLength = view.getUint16(offset + 32, true)
					const localOffset = view.getUint32(offset + 42, true)
					const entryName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
					entries.push({
						name: entryName,
						size,
						compressed,
						method,
						localOffset,
						directory: entryName.endsWith('/'),
						encrypted: (flags & 0x1) === 0x1,
						zip64: size === 0xffffffff || compressed === 0xffffffff,
					})
					offset += 46 + nameLength + extraLength + commentLength
				}
				return entries
			}

			/** Far past anything a phone should inflate from one tap. */
			const MAX_INFLATED_BYTES = 64 * 1024 * 1024

			const inflateEntry = async (buffer, entry) => {
				if (entry.encrypted) throw new Error('encrypted')
				if (entry.zip64) throw new Error('zip64')
				if (entry.size > MAX_INFLATED_BYTES) throw new Error('too large')
				const view = new DataView(buffer)
				const bytes = new Uint8Array(buffer)
				if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error('bad local header')
				const nameLength = view.getUint16(entry.localOffset + 26, true)
				const extraLength = view.getUint16(entry.localOffset + 28, true)
				const start = entry.localOffset + 30 + nameLength + extraLength
				const raw = bytes.subarray(start, start + entry.compressed)
				if (entry.method === 0) {
					if (raw.byteLength > MAX_INFLATED_BYTES) throw new Error('too large')
					return raw
				}
				if (entry.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('unsupported compression')
				const stream = new Blob([raw])
					.stream()
					.pipeThrough(new DecompressionStream('deflate-raw'))
					.getReader()
				// Read chunk by chunk: a zip bomb can expand far past its header, and
				// buffering it whole is what exhausts memory on a phone.
				const chunks = []
				let total = 0
				for (;;) {
					const { done, value } = await stream.read()
					if (done) break
					total += value.byteLength
					if (total > MAX_INFLATED_BYTES) {
						stream.cancel().catch(() => {})
						throw new Error('too large')
					}
					chunks.push(value)
				}
				const inflated = new Uint8Array(total)
				let offset = 0
				for (const chunk of chunks) {
					inflated.set(chunk, offset)
					offset += chunk.byteLength
				}
				return inflated
			}

			const buildArchiveView = (url, name) => {
				const panel = document.createElement('div')
				panel.style.cssText = panelStyle
				const head = document.createElement('div')
				head.style.cssText = 'flex:none;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);font:600 13px/18px -apple-system, system-ui, sans-serif;color:#9aa4b2;display:flex;justify-content:space-between;gap:10px'
				const title = document.createElement('span')
				title.textContent = name
				title.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
				const countLabel = document.createElement('span')
				countLabel.style.cssText = 'flex:none;color:#6b7686'
				countLabel.textContent = T.archiveLoading
				head.append(title, countLabel)
				const list = document.createElement('div')
				list.style.cssText = 'overflow:auto;padding:4px 0'
				panel.append(head, list)

				const showFile = async (entry, buffer) => {
					list.textContent = ''
					const back = document.createElement('button')
					back.type = 'button'
					back.textContent = T.backToArchive
					back.style.cssText = `flex:none;align-self:flex-start;margin:8px 12px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#cfe0ff;font:13px/18px -apple-system, system-ui, sans-serif;cursor:pointer`
					back.addEventListener('click', () => renderList(buffer, entries))
					const body = document.createElement('div')
					body.style.cssText = 'padding:0 12px 12px;overflow:auto'
					list.append(back, body)
					try {
						const bytes = await inflateEntry(buffer, entry)
						const ext = (entry.name.split('.').pop() || '').toLowerCase()
						if (IMAGE_EXT.includes(ext)) {
							const blob = new Blob([bytes])
							const objectUrl = URL.createObjectURL(blob)
							const img = document.createElement('img')
							img.src = objectUrl
							img.style.cssText = 'max-width:100%;border-radius:8px'
							img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true })
							body.append(img)
						} else if (TEXT_EXT.includes(ext)) {
							const pre = document.createElement('pre')
							pre.style.cssText = 'margin:0;color:#e8ecf2;font:12px/18px ui-monospace, Menlo, monospace;white-space:pre-wrap;word-break:break-word'
							pre.textContent = new TextDecoder().decode(bytes).slice(0, 200000)
							body.append(pre)
						} else {
							const note = document.createElement('div')
							note.style.cssText = textStyle
							note.textContent = T.unsupportedInside
							body.append(note)
						}
					} catch (error) {
						const note = document.createElement('div')
						note.style.cssText = textStyle
						const reason = error && error.message
						note.textContent =
							reason === 'encrypted'
								? T.encrypted
								: reason === 'zip64'
									? T.zip64
									: reason === 'too large'
										? T.tooLarge
										: T.unsupportedInflate
						body.append(note)
					}
				}

				let entries = []
				const renderList = (buffer) => {
					list.textContent = ''
					entries
						.filter((entry) => !entry.directory)
						.forEach((entry) => {
							const row = document.createElement('button')
							row.type = 'button'
							row.style.cssText = 'display:flex;width:100%;gap:10px;align-items:baseline;justify-content:space-between;padding:10px 14px;border:0;background:transparent;color:#fff;font:14px/20px -apple-system, system-ui, sans-serif;text-align:left;cursor:pointer'
							const label = document.createElement('span')
							label.textContent = entry.name
							label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
							const size = document.createElement('span')
							size.textContent = humanSize(entry.size)
							size.style.cssText = 'flex:none;color:#6b7686;font:12px/20px ui-monospace, Menlo, monospace'
							row.append(label, size)
							row.addEventListener('click', () => showFile(entry, buffer))
							list.append(row)
						})
					if (entries.filter((entry) => !entry.directory).length === 0) {
						const empty = document.createElement('div')
						empty.style.cssText = `${textStyle};padding:14px`
						empty.textContent = T.archiveEmpty
						list.append(empty)
					}
				}

				fetchChecked(url)
					.then((response) => response.arrayBuffer())
					.then((buffer) => {
						entries = readZipEntries(buffer)
						const files = entries.filter((entry) => !entry.directory)
						countLabel.textContent = `${files.length} ${T.files(files.length)}`
						renderList(buffer)
					})
					.catch(() => {
						countLabel.textContent = ''
						const error = document.createElement('div')
						error.style.cssText = `${textStyle};padding:14px`
						error.textContent = T.archiveFailed
						list.append(error)
					})
				return panel
			}

			const humanSize = (bytes) => {
				if (!Number.isFinite(bytes) || bytes < 0) return ''
				if (bytes < 1024) return `${bytes} Б`
				if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
				return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
			}

			/** Sibling images around the opened one: the gallery. */
			const collectGallery = (url, anchorNode, siblingPaths) => {
				const target = url.searchParams.get('path') || ''
				const urls = []
				const push = (path) => {
					if (!path) return
					if (!IMAGE_EXT.includes((path.split('.').pop() || '').toLowerCase())) return
					const candidate = new URL(url.href)
					candidate.searchParams.set('path', path)
					if (!urls.some((known) => known.href === candidate.href)) urls.push(candidate)
				}
				// The card list is virtualised, so the logical group comes from React
				// props; the DOM scan is only a fallback for plain markdown links.
				if (Array.isArray(siblingPaths)) {
					for (const path of siblingPaths) push(path)
				}
				const card = anchorNode instanceof Element ? anchorNode.closest('[data-presented-file]') : null
				const scope = card && card.parentElement ? card.parentElement : null
				if (scope) {
					for (const button of scope.querySelectorAll('[data-presented-file] button[aria-label]')) {
						const match = (button.getAttribute('aria-label') || '').match(/^Preview (.+) in sidebar$/)
						if (match) push(match[1])
					}
				}
				if (urls.length <= 1 && anchorNode instanceof Element && anchorNode.parentElement) {
					for (const link of anchorNode.parentElement.querySelectorAll('a[href*="api/file"]')) {
						const candidate = isFileUrl(link.getAttribute('href'))
						if (candidate) push(candidate.searchParams.get('path') || '')
					}
				}
				if (urls.length <= 1) return null
				const index = urls.findIndex((candidate) => (candidate.searchParams.get('path') || '') === target)
				// The opened file is not part of this image group (a PDF next to
				// pictures): no gallery, otherwise paging would show another file.
				if (index < 0) return null
				return { urls, index }
			}

			const fileUrlOf = (url) => {
				const path = url.searchParams.get('path') || ''
				const name = path.split('/').filter(Boolean).pop() || 'file'
				return { path, name, ext: (name.split('.').pop() || '').toLowerCase() }
			}

			/** Body for one file: the same renderer for a card, a link and a gallery page. */
			const buildFileBody = (url, name, ext) => {
				if (IMAGE_EXT.includes(ext)) {
					const img = document.createElement('img')
					img.src = url.href
					img.alt = name
					img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px'
					return img
				}
				if (ext === 'pdf') {
					const frame = document.createElement('iframe')
					frame.src = url.href
					frame.title = name
					frame.style.cssText = 'width:100%;height:100%;border:0;border-radius:8px;background:#fff'
					return frame
				}
				if (AUDIO_EXT.includes(ext)) {
					const player = document.createElement('audio')
					player.src = url.href
					player.controls = true
					player.autoplay = true
					player.style.cssText = 'width:min(420px,100%)'
					return player
				}
				if (VIDEO_EXT.includes(ext)) {
					const player = document.createElement('video')
					player.src = url.href
					player.controls = true
					player.playsInline = true
					player.autoplay = true
					player.style.cssText = 'max-width:100%;max-height:100%;border-radius:8px;background:#000'
					return player
				}
				if (ARCHIVE_EXT.includes(ext)) return buildArchiveView(url, name)
				if (ext === 'html' || ext === 'htm') {
					// An HTML file is a page, not a text dump: render it in a sandboxed
					// frame, the same way the sidebar preview does.
					const frame = document.createElement('iframe')
					frame.src = url.href
					frame.title = name
					frame.setAttribute('sandbox', 'allow-scripts')
					frame.style.cssText = 'width:100%;height:100%;border:0;border-radius:8px;background:#fff'
					return frame
				}
				if (TEXT_EXT.includes(ext)) return buildTextView(url, name)
				const box = document.createElement('div')
				box.style.cssText = `${textStyle};text-align:center`
				const link = document.createElement('a')
				link.href = url.href
				link.download = name
				link.textContent = name
				link.style.cssText = 'color:#7ab7ff;text-decoration:underline;word-break:break-all'
				box.append(T.notShown, link)
				return box
			}

			const paintGalleryPage = () => {
				if (!stage) return
				const url = gallery[galleryIndex]
				const { name, ext } = fileUrlOf(url)
				stage.textContent = ''
				stage.append(buildFileBody(url, name, ext))
				if (counter) {
					counter.textContent = gallery.length > 1 ? T.counter(galleryIndex + 1, gallery.length) : ''
				}
				if (saveButton) {
					saveButton.textContent = T.save
					saveButton.disabled = false
				}
			}

			const stepGallery = (delta) => {
				if (gallery.length < 2) return
				galleryIndex = (galleryIndex + delta + gallery.length) % gallery.length
				paintGalleryPage()
			}

			/** Tap left third / right third to page, like a story; the middle does nothing. */
			const addEdgeZones = (host) => {
				if (gallery.length < 2) return
				for (const [side, delta, glyph] of [['left', -1, '‹'], ['right', 1, '›']]) {
					const zone = document.createElement('button')
					zone.type = 'button'
					zone.setAttribute('aria-label', side === 'left' ? T.previous : T.next)
					zone.style.cssText = [
						'position:fixed',
						'top:calc(env(safe-area-inset-top) + 56px)',
						'bottom:calc(env(safe-area-inset-bottom) + 76px)',
						side === 'left' ? 'left:0' : 'right:0',
						'width:30vw',
						'max-width:160px',
						'border:0',
						'background:transparent',
						'color:rgba(255,255,255,.55)',
						'font:32px/1 -apple-system, system-ui, sans-serif',
						'cursor:pointer',
						'z-index:2',
						'display:flex',
						'align-items:center',
						'justify-content:' + (side === 'left' ? 'flex-start' : 'flex-end'),
						'padding:0 10px',
					].join(';')
					zone.textContent = glyph
					zone.addEventListener('click', (event) => {
						event.stopPropagation()
						stepGallery(delta)
					})
					host.append(zone)
				}
			}

			const openFileOverlay = (url, anchorNode, siblingPaths) => {
				const wasOpen = overlay !== null
				if (!wasOpen) rememberScroll()
				teardownOverlay({ restoreScroll: false })
				const found = collectGallery(url, anchorNode, siblingPaths)
				gallery = found ? found.urls : [url]
				galleryIndex = found ? found.index : 0
				const opened = fileUrlOf(gallery[galleryIndex])

				const root = document.createElement('div')
				root.id = OVERLAY_ID
				root.setAttribute('role', 'dialog')
				root.setAttribute('aria-modal', 'true')
				root.setAttribute('aria-label', opened.name)
				root.style.cssText = [
					'position:fixed',
					'inset:0',
					'z-index:2147483000',
					'background:rgba(0,0,0,.94)',
					'display:flex',
					'align-items:center',
					'justify-content:center',
					'padding:calc(env(safe-area-inset-top) + 56px) 12px calc(env(safe-area-inset-bottom) + 76px)',
					'box-sizing:border-box',
				].join(';')

				const closeButton = document.createElement('button')
				closeButton.type = 'button'
				closeButton.setAttribute('aria-label', T.close)
				closeButton.textContent = '×'
				closeButton.style.cssText = [
					'position:fixed',
					'top:calc(env(safe-area-inset-top) + 8px)',
					'right:12px',
					'width:40px',
					'height:40px',
					'border-radius:50%',
					'border:1px solid rgba(255,255,255,.35)',
					'background:rgba(0,0,0,.55)',
					'color:#fff',
					'font:24px/1 -apple-system, system-ui, sans-serif',
					'cursor:pointer',
					'z-index:3',
				].join(';')
				closeButton.addEventListener('click', closeFileOverlay)

				counter = document.createElement('span')
				counter.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 18px);left:16px;color:rgba(255,255,255,.7);font:600 13px/20px -apple-system, system-ui, sans-serif;z-index:3'

				stage = document.createElement('div')
				stage.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-width:0;min-height:0'

				// Swipe left/right pages the gallery; a vertical drag is left alone.
				// The listeners sit on the root, so a swipe that starts on an edge zone
				// still pages.
				let touchStart = null
				root.addEventListener('touchstart', (event) => {
					const touch = event.touches[0]
					touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null
				}, { passive: true })
				root.addEventListener('touchend', (event) => {
					const start = touchStart
					touchStart = null
					if (!start || gallery.length < 2) return
					const touch = event.changedTouches[0]
					if (!touch) return
					const dx = touch.clientX - start.x
					const dy = touch.clientY - start.y
					if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
					stepGallery(dx < 0 ? 1 : -1)
				})

				const footer = document.createElement('div')
				footer.style.cssText = [
					'position:fixed',
					'left:0',
					'right:0',
					'bottom:0',
					'display:flex',
					'justify-content:center',
					'padding:12px 12px calc(env(safe-area-inset-bottom) + 12px)',
					'background:linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.72))',
					'z-index:3',
				].join(';')
				saveButton = document.createElement('button')
				saveButton.type = 'button'
				saveButton.textContent = T.save
				saveButton.style.cssText = [
					'height:40px',
					'padding:0 18px',
					'border-radius:20px',
					'border:1px solid rgba(255,255,255,.35)',
					'background:rgba(255,255,255,.14)',
					'color:#fff',
					'font:15px/1 -apple-system, system-ui, sans-serif',
					'cursor:pointer',
				].join(';')
				saveButton.addEventListener('click', async () => {
					// The sheet can be closed while the file is being prepared; hold the
					// button we started with and stop if it is gone.
					const button = saveButton
					const current = gallery[galleryIndex]
					const { name } = fileUrlOf(current)
					button.disabled = true
					button.textContent = T.saving
					try {
						const response = await fetchChecked(current)
						const blob = await response.blob()
						const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
						if (navigator.canShare && navigator.canShare({ files: [file] })) {
							await navigator.share({ files: [file], title: name })
							if (button.isConnected) button.textContent = T.save
						} else {
							const objectUrl = URL.createObjectURL(blob)
							const anchor = document.createElement('a')
							anchor.href = objectUrl
							anchor.download = name
							anchor.click()
							setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
							if (button.isConnected) button.textContent = T.save
						}
					} catch (_error) {
						if (button.isConnected) button.textContent = T.saveFailed
					} finally {
						if (button.isConnected) button.disabled = false
					}
				})
				footer.append(saveButton)

				root.append(stage, closeButton, counter, footer)
				addEdgeZones(root)
				paintGalleryPage()

				root.addEventListener('click', (event) => {
					if (event.target === root) closeFileOverlay()
				})
				document.body.append(root)
				overlay = root
				// Move focus into the sheet and give it back on close, so a screen
				// reader and the keyboard both stay oriented.
				const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null
				closeFileOverlayFocus = () => {
					if (focusReturn && focusReturn.isConnected) focusReturn.focus({ preventScroll: true })
				}
				closeButton.focus({ preventScroll: true })
				if (overlayPushed) return
				try {
					history.pushState({ ...(history.state || {}), 'dsh-mobile-file-overlay': true }, '')
					overlayPushed = true
				} catch (_error) {
					overlayPushed = false
				}
			}

			// The deliverables card in chat opens the same overlay: it asks for this
			// hook first, so a tapped card and a tapped file link look identical.
			const fileOverlayHook = (value, siblings) => {
				const url = value instanceof URL ? value : isFileUrl(value)
				if (!url) return false
				openFileOverlay(url, deps.pointerTarget(), siblings)
				return true
			}

			const onFileLinkClick = (event) => {
				if (!deps.interceptFileLinks()) return
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return
				const target = event.target
				if (!(target instanceof Element)) return
				const link = target.closest('a[href]')
				if (!link) return
				// The overlay's own fallback link carries `download`; hijacking it
				// would reopen the viewer instead of saving the file.
				if (link.hasAttribute('download')) return
				const url = isFileUrl(link.getAttribute('href'))
				if (!url) return
				event.preventDefault()
				event.stopPropagation()
				openFileOverlay(url, link)
			}

			const originalOpen = window.__dshMobileOpenOriginal || window.open.bind(window)
			window.__dshMobileOpenOriginal = originalOpen
			const openGuard = (...args) => {
				const url = deps.interceptFileLinks() ? isFileUrl(args[0]) : null
				if (url) {
					openFileOverlay(url, deps.pointerTarget())
					return null
				}
				return originalOpen(...args)
			}
			window.open = openGuard

			const onOverlayKeyDown = (event) => {
				if (!overlay || event.key !== 'Escape') return
				event.preventDefault()
				event.stopPropagation()
				closeFileOverlay()
			}

			const onPopState = () => {
				// A pop we caused ourselves (the close path calls history.back()).
				if (pendingPop > 0) {
					pendingPop -= 1
					return
				}
				if (!overlay) return
				overlayPushed = false
				teardownOverlay({ restoreScroll: true })
			}
			window.addEventListener('popstate', onPopState)
			document.addEventListener('click', onFileLinkClick, true)
			document.addEventListener('keydown', onOverlayKeyDown, true)

			const dispose = () => {
				teardownOverlay({ restoreScroll: false })
				window.removeEventListener('popstate', onPopState)
				document.removeEventListener('click', onFileLinkClick, true)
				document.removeEventListener('keydown', onOverlayKeyDown, true)
				if (window.open === openGuard) window.open = originalOpen
				if (window.__dshMobileFileOverlay === fileOverlayHook) {
					delete window.__dshMobileFileOverlay
				}
			}

			return {
				open: openFileOverlay,
				hook: fileOverlayHook,
				dispose,
				internals: { isFileUrl, readZipEntries, humanSize, collectGallery, T },
			}
		}

		function apply(ctx) {
			const style = installStyles()
			const mobile = window.matchMedia(MOBILE_QUERY)
			// A wide desktop layout does not make the device a desktop: the phone
			// still autozooms a sub-16px field on focus. Mark the input device, not
			// the viewport, so the 16px rule applies at any width.
			let lastPointerTarget = null

			// The trap is the installed standalone app, not a narrow window: an iPad
			// in landscape is wider than 1023px and still hands /api/file to iOS.
			const interceptFileLinks = () =>
				window.matchMedia('(display-mode: standalone)').matches ||
				window.navigator.standalone === true ||
				touchDevice

			const fileViewer = createFileViewer({
				interceptFileLinks,
				pointerTarget: () => lastPointerTarget,
			})
			window.__dshMobileFileOverlay = fileViewer.hook

			// A client is "local" only when it runs on the Host machine: loopback, the
			// desktop shell, or a file. Anything else reached DSH over the network.
			const isLocalClient = () => {
				const { protocol, hostname } = location
				if (protocol === 'dsh-app:' || protocol === 'file:') return true
				const host = (hostname || '').toLowerCase()
				return (
					host === 'localhost' ||
					host === '127.0.0.1' ||
					host === '::1' ||
					host === '[::1]' ||
					host.endsWith('.localhost')
				)
			}
			const remoteClient = !isLocalClient()
			if (remoteClient) {
				document.documentElement.classList.add('dsh-mf-remote')
			}

			const touchDevice =
				(navigator.maxTouchPoints || 0) > 0 ||
				window.matchMedia('(pointer: coarse)').matches ||
				'ontouchstart' in window
			if (touchDevice) {
				document.documentElement.classList.add('dsh-mf-touch')
			}

			// iOS keeps the keyboard accessory bar (previous/next field + Done)
			// pinned to the bottom of a standalone web app after the keyboard has
			// been dismissed, as long as a text field still owns focus. Dropping
			// that focus when the keyboard closes removes the bar.
			const viewport = window.visualViewport
			if (touchDevice && viewport) {
				let keyboardOpen = false
				let baseWidth = viewport.width
				const onViewportResize = () => {
					// A pinch changes the visual width; the keyboard only changes the
					// height. Treat width movement as a zoom and leave focus alone.
					if (Math.abs(viewport.width - baseWidth) > 40) {
						baseWidth = viewport.width
						return
					}
					const open = window.innerHeight - viewport.height > 120
					if (keyboardOpen && !open) {
						const active = document.activeElement
						if (
							active instanceof HTMLElement &&
							active.closest(
								'input, textarea, [contenteditable]:not([contenteditable="false"])',
							)
						) {
							active.blur()
						}
					}
					keyboardOpen = open
				}
				viewport.addEventListener('resize', onViewportResize)
				if (ctx && typeof ctx.effect === 'function') {
					ctx.effect(() => () => viewport.removeEventListener('resize', onViewportResize))
				}
			}

			const drawerColumn = () => document.querySelector('[class*="sidebarCol"]')

			// The panel's own class decides, not the measured width: a CSS animation
			// keeps the column at 56px for a moment, and a re-mounted panel may never
			// fire an attribute mutation. The width stays as a fallback.
			const drawerIsOpen = () => {
				const column = drawerColumn()
				if (!column) return false
				const panel = column.querySelector('[class*="_root"]')
				if (panel && !String(panel.className).includes('_collapsed')) return true
				return column.getBoundingClientRect().width > 80
			}

			// The stylesheet needs to know whether the panel is open; measuring the
			// column and toggling one class on <html> is cheaper than a `:has()`
			// selector that the engine re-evaluates after every mutation.
			// The open-in-app control renders an anchor with a main button and a
			// chevron; only the main button carries a data hook, so the wrapper is
			// located through it and hidden as a whole.
			const hideHostActions = () => {
				if (!remoteClient) return
				for (const marker of document.querySelectorAll('[data-open-target]')) {
					const slot = marker.closest('[data-slot]')
					const wrapper = slot
						? [...slot.children].find((child) => child.contains(marker))
						: marker.parentElement
					const target = wrapper || marker
					// A class, not an inline style: disposing the plugin removes the
					// class from <html> and the buttons come back on their own.
					if (target && !target.classList.contains('dsh-mf-hidden')) {
						target.classList.add('dsh-mf-hidden')
					}
				}
			}

			let drawerSyncFrame = 0
			const syncDrawerClass = () => {
				drawerSyncFrame = 0
				document.documentElement.classList.toggle('dsh-mf-drawer', drawerIsOpen())
				hideHostActions()
			}
			const scheduleDrawerSync = () => {
				if (drawerSyncFrame !== 0) return
				drawerSyncFrame = requestAnimationFrame(syncDrawerClass)
			}
			const drawerObserver = new MutationObserver(scheduleDrawerSync)
			drawerObserver.observe(document.body, {
				subtree: true,
				attributes: true,
				childList: true,
				attributeFilter: ['class', 'style'],
			})
			// A resize can come from an animation or a panel swap without any
			// attribute mutation, so the column is measured directly as well.
			const drawerResize = new ResizeObserver(scheduleDrawerSync)
			const watchDrawerColumn = () => {
				const column = drawerColumn()
				if (column) drawerResize.observe(column)
			}
			watchDrawerColumn()
			scheduleDrawerSync()

			let closeLockUntil = 0
			const closeDrawer = () => {
				const now = Date.now()
				if (now < closeLockUntil) return
				const toggle = document.querySelector(TOGGLE)
				if (!toggle) return
				closeLockUntil = now + 700
				toggle.click()
			}

			const scheduleClose = (delay = 0) => {
				setTimeout(() => {
					if (drawerIsOpen()) closeDrawer()
				}, delay)
			}

			let openLockUntil = 0
			const openDrawer = () => {
				const now = Date.now()
				if (now < openLockUntil) return
				if (drawerIsOpen()) return
				const toggle = document.querySelector(TOGGLE)
				if (!toggle) return
				openLockUntil = now + SWIPE_LOCK_MS
				toggle.click()
			}

			// A tap belongs to the drawer when the DOM says so *or* when its
			// coordinates fall inside the drawer box. The geometry check keeps
			// workspace rows, session rows and anything else inside the panel
			// from being mistaken for an outside tap, even if a re-render
			// detaches the clicked node from the sidebar subtree mid-gesture.
			const isInsideDrawer = (event, target) => {
				if (target.closest('[class*="sidebarCol"]')) return true
				const column = drawerColumn()
				if (!column) return false
				const rect = column.getBoundingClientRect()
				if (rect.width === 0 || rect.height === 0) return false
				const { clientX, clientY } = event
				return (
					clientX >= rect.left &&
					clientX <= rect.right &&
					clientY >= rect.top &&
					clientY <= rect.bottom
				)
			}

			const ROW = '[class*="sessionRow"], [class*="newSession"]'
			const SESSION_ROW = '[class*="sessionRow"]'
			const rowOf = (target) => target.closest(ROW)

			// A tap on a session row is opened from `pointerup` (see there); the
			// native click iOS eventually delivers for that same tap is then a
			// stray click over the conversation, so it is swallowed for a short
			// window instead of landing on whatever now sits under the finger.
			// Only a click at the same spot (the same finger) is swallowed: the
			// next deliberate tap somewhere else — the drawer toggle, the
			// composer — must go through untouched.
			const SWALLOW_MS = 600
			const SWALLOW_RADIUS = 40
			let swallow = null
			const armClickSwallow = (x, y) => {
				swallow = { until: Date.now() + SWALLOW_MS, x, y }
			}
			const isSwallowed = (event) => {
				if (!swallow) return false
				if (Date.now() > swallow.until) {
					swallow = null
					return false
				}
				const dx = event.clientX - swallow.x
				const dy = event.clientY - swallow.y
				if (dx * dx + dy * dy > SWALLOW_RADIUS * SWALLOW_RADIUS) return false
				swallow = null
				return true
			}
			const isTypingTarget = (target) =>
				target.closest(
					'input, textarea, [contenteditable]:not([contenteditable="false"])',
				) !== null

			// A row's own small controls (actions menu, pin, archive) must keep
			// their behavior instead of dismissing the drawer.
			const isRowAction = (target, row) => {
				const control = target.closest(INTERACTIVE)
				if (!control || !row.contains(control)) return false
				const rowRect = row.getBoundingClientRect()
				const controlRect = control.getBoundingClientRect()
				return controlRect.width < rowRect.width * 0.6
			}

			const onClick = (event) => {
				if (!mobile.matches) return
				const target = event.target
				if (!(target instanceof Element)) return

				// The delayed native click of a row tap we already handled on
				// pointerup: let it go nowhere. Programmatic clicks (ours, the
				// drawer toggle's) are untrusted and never reach this branch.
				if (
					event.isTrusted &&
					!isTypingTarget(target) &&
					isSwallowed(event)
				) {
					event.preventDefault()
					event.stopPropagation()
					return
				}

				// Keyboard-generated clicks carry no pointer position; they are
				// not "taps outside" and must not close the drawer.
				if (event.detail === 0) return

				// Rows are handled on pointerup, which iOS still delivers when a
				// pointer-driven selection suppresses the click.
				if (rowOf(target)) return

				// Never fight the app's own controls, including the close button.
				if (target.closest(INTERACTIVE)) return

				if (isInsideDrawer(event, target)) return
				if (drawerIsOpen()) scheduleClose()
			}

			// Picking a session (or starting a new one) hands the screen back to
			// the conversation. Workspace folders do not: expanding a project is
			// a navigation step inside the drawer.
			let press = null
			const onPointerDown = (event) => {
				press = null
				if (event.button !== 0) return
				if (event.target instanceof Element) lastPointerTarget = event.target
				if (!mobile.matches) return
				const target = event.target
				if (!(target instanceof Element)) return
				const row = rowOf(target)
				if (!row) return
				press = {
					x: event.clientX,
					y: event.clientY,
					at: Date.now(),
					action: isRowAction(target, row),
					row,
					session: row.matches(SESSION_ROW),
				}
			}

			const onPointerUp = (event) => {
				const current = press
				press = null
				if (event.button !== 0) return
				if (!current || !mobile.matches) return
				if (current.action) return
				if (Date.now() - current.at > 1500) return
				if (Math.abs(event.clientX - current.x) > 12) return
				if (Math.abs(event.clientY - current.y) > 12) return

				// iOS treats a plain <div role="treeitem"> that only carries a
				// React onClick as "not clickable" and holds its click back for
				// the double-tap-zoom window (~300 ms). Closing the drawer first
				// unmounts the row, so that click never reaches the row handler:
				// the tap merely closed the drawer and the previous session
				// stayed selected. So the row's click is dispatched right here,
				// synchronously, and only then is the drawer dismissed.
				if (current.session && current.row.isConnected) {
					current.row.click()
					armClickSwallow(current.x, current.y)
					scheduleClose(60)
					return
				}
				scheduleClose(120)
			}

			const onPointerCancel = () => {
				press = null
			}

			// Edge swipe: a left-to-right drag that starts at the screen's left
			// edge opens the drawer, and a right-to-left drag while it is open
			// closes it again. Vertical drags stay scrolling: they drop the
			// gesture, so the session list and the conversation scroll as usual.
			let swipe = null
			const finishSwipe = (action, x, y) => {
				swipe = null
				// The finger leaves where the layout just changed; whatever click
				// the browser delivers for this drag must not land on the rows
				// (opening) or on the conversation (closing) now under it.
				armClickSwallow(x, y)
				action()
			}

			const onTouchStart = (event) => {
				swipe = null
				if (!mobile.matches) return
				if (event.touches.length !== 1) return
				const touch = event.touches[0]
				const open = drawerIsOpen()
				if (!open && touch.clientX > SWIPE_EDGE) return
				swipe = { open, x: touch.clientX, y: touch.clientY }
			}

			const onTouchMove = (event) => {
				const gesture = swipe
				if (!gesture || event.touches.length !== 1) return
				const touch = event.touches[0]
				const dx = touch.clientX - gesture.x
				const dy = touch.clientY - gesture.y
				const vertical = Math.abs(dy)
				// A mostly vertical drag is a scroll, not a swipe.
				if (vertical > SWIPE_SLOP && vertical > Math.abs(dx)) {
					swipe = null
					return
				}
				if (vertical > SWIPE_SLOP) return
				if (!gesture.open && dx >= SWIPE_DISTANCE) {
					finishSwipe(openDrawer, touch.clientX, touch.clientY)
				} else if (gesture.open && dx <= -SWIPE_DISTANCE) {
					finishSwipe(closeDrawer, touch.clientX, touch.clientY)
				}
			}

			const onTouchEnd = () => {
				swipe = null
			}

			// Pure helpers exposed for `node --test`; nothing in the plugin reads this.
			exports.__test = {
				isLocalClient,
				isFileUrl: fileViewer.internals.isFileUrl,
				readZipEntries: fileViewer.internals.readZipEntries,
				humanSize: fileViewer.internals.humanSize,
				collectGallery: (url, siblingPaths) =>
					fileViewer.internals.collectGallery(url, null, siblingPaths),
				T: fileViewer.internals.T,
			}

			const bindings = [
				['click', onClick, true],
				['pointerdown', onPointerDown, true],
				['pointerup', onPointerUp, true],
				['pointercancel', onPointerCancel, true],
				['touchstart', onTouchStart, { capture: true, passive: true }],
				['touchmove', onTouchMove, { capture: true, passive: true }],
				['touchend', onTouchEnd, { capture: true, passive: true }],
				['touchcancel', onTouchEnd, { capture: true, passive: true }],
			]

			// A repeated apply (HMR, live composition) replaces the previous
			// listeners instead of stacking a second set that would toggle the
			// drawer twice and leave it open.
			const previous = Array.isArray(window[HANDLERS_KEY])
				? window[HANDLERS_KEY]
				: []
			for (const binding of previous) {
				if (Array.isArray(binding) && binding.length >= 2) {
					document.removeEventListener(binding[0], binding[1], true)
				}
			}
			window[HANDLERS_KEY] = bindings
			for (const [type, handler, options] of bindings) {
				document.addEventListener(type, handler, options)
			}

			if (ctx && typeof ctx.effect === 'function') {
				ctx.effect(() => () => {
					for (const [type, handler] of bindings) {
						document.removeEventListener(type, handler, true)
					}
					fileViewer.dispose()
					drawerObserver.disconnect()
					drawerResize.disconnect()
					if (drawerSyncFrame !== 0) cancelAnimationFrame(drawerSyncFrame)
					document.documentElement.classList.remove('dsh-mf-drawer')
					document.documentElement.classList.remove('dsh-mf-touch')
					document.documentElement.classList.remove('dsh-mf-remote')
					for (const node of document.querySelectorAll('.dsh-mf-hidden')) {
						node.classList.remove('dsh-mf-hidden')
					}
					if (window[HANDLERS_KEY] === bindings) {
						window[HANDLERS_KEY] = []
					}
					style.remove()
				})
			}
		}

		exports.apply = apply
		exports.inject = []
		return module.exports
	},
})
