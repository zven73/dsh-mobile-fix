/**
 * Browser half of `dsh-mobile-fix`.
 *
 * Scope: narrow viewports (<= 1023px). Desktop composition is untouched.
 *
 * 1. iOS Safari zooms the page whenever a focused editable field computes to
 *    less than 16px. The composer ships 14px, so opening a session (which
 *    focuses the composer) zooms in and pans the sidebar off-screen. Raising
 *    editable fields to 16px removes the trigger.
 * 2. The app frame is a three-column grid. On a phone the open sidebar keeps
 *    its desktop column width, which collapses the conversation to a sliver.
 *    Here the sidebar column always keeps the 56px rail width and the open
 *    panel is promoted to a fixed overlay drawer with a dimmed backdrop, so
 *    the conversation always gets the full remaining width.
 * 3. Choosing a session, or tapping the dimmed area, closes the drawer.
 * 4. A left-to-right swipe from the screen edge opens the drawer and a
 *    right-to-left swipe closes it, mirroring the native gesture. Vertical
 *    drags stay with the scroller underneath.
 *
 * The click handling is deliberately defensive: one registered listener per
 * page (a repeated apply replaces the previous one), a close lock so a second
 * copy of the handler can never toggle the drawer back open, and a blanket
 * opt-out for any interactive control so the app's own buttons — including its
 * close button — are never fought over.
 *
 * Selectors use the stable local halves of the CSS-module class names
 * (`sidebarCol`, `centerCol`, `rightbarCol`, `sessionRow`, `_root`,
 * `_collapsed`, `toggle`) plus the public `data-slot` names, so a rebuild that
 * changes the module hash keeps working.
 */
window.__ModuleLoader__.load({
	id: 'dsh-mobile-fix',
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports

		const VERSION = '0.6.2'
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
		const OPEN_PANEL =
			'[class*="sidebarCol"] > div > [class*="_root"]:not([class*="_collapsed"])'
		const TOGGLE = '[class*="sidebarCol"] button[class*="toggle"]'
		const INTERACTIVE =
			'button, a, select, input, textarea, summary, ' +
			'[role="button"], [role="menuitem"], [role="menu"], [role="tab"], ' +
			'[role="switch"], [role="checkbox"], [role="option"], ' +
			'[contenteditable]:not([contenteditable="false"])'

		const CSS = `
/* iOS zooms the page whenever a focused editable computes to less than 16px.
   The trigger is the device (a finger), not the viewport: a phone mirroring a
   wide Mac screen reports a desktop-width viewport and would zoom again, so
   this rule cannot live inside the layout media query. */
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
  [class*="frame"]:has([class*="sidebarCol"] > div > [class*="_root"]:not([class*="_collapsed"])) {
    grid-template-columns: 56px minmax(0, 1fr) 0 !important;
  }

  [class*="frame"]:has([class*="sidebarCol"] > div > [class*="_root"]:not([class*="_collapsed"]))::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 79;
    background: rgba(0, 0, 0, .55);
    backdrop-filter: blur(3px);
    pointer-events: auto;
  }

  [class*="sidebarCol"]:has(> div > [class*="_root"]:not([class*="_collapsed"])) {
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

		function apply(ctx) {
			const style = installStyles()
			const mobile = window.matchMedia(MOBILE_QUERY)
			// A wide desktop layout does not make the device a desktop: the phone
			// still autozooms a sub-16px field on focus. Mark the input device, not
			// the viewport, so the 16px rule applies at any width.
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
				const onViewportResize = () => {
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

			// Width, not a class path: the rail is 56px, an open panel is much
			// wider. Survives React re-renders that replace the panel subtree.
			const drawerIsOpen = () => {
				const column = drawerColumn()
				if (!column) return false
				return column.getBoundingClientRect().width > 80
			}

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

			// --- temporary diagnostics for the Settings modal on iOS ---------
			// It renders but the owner reports it never appears on the phone.
			// This records the outcome of a Settings tap and, when the panel
			// exists outside the visual viewport (page zoom), scrolls it in.
			let lastError = ''
			window.addEventListener('error', (e) => {
				lastError = String(e.message || e.error || '')
			})
			window.addEventListener('unhandledrejection', (e) => {
				lastError = String(e.reason || '')
			})
			// The red banner is a debugging aid, off unless asked for:
			// localStorage.setItem('dsh-mobile-fix-debug', '1') or
			// window.__DSH_MF_DEBUG__ = true. The scroll-into-view rescue above
			// stays on: it is harmless and can recover a panel opened off-screen.
			const debugEnabled = () => {
				try {
					return (
						window.__DSH_MF_DEBUG__ === true ||
						window.localStorage.getItem('dsh-mobile-fix-debug') === '1'
					)
				} catch (_error) {
					return window.__DSH_MF_DEBUG__ === true
				}
			}
			const banner = (text) => {
				if (!debugEnabled()) return
				let el = document.getElementById('dsh-mobile-fix-diag')
				if (!el) {
					el = document.createElement('div')
					el.id = 'dsh-mobile-fix-diag'
					document.body.append(el)
				}
				el.textContent = text
				el.style.cssText =
					'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;background:#b3261e;color:#fff;font:13px/18px -apple-system,system-ui,sans-serif;padding:10px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:pre-wrap'
				clearTimeout(el.__timer)
				el.__timer = setTimeout(() => el.remove(), 25000)
			}
			const checkSettings = () => {
				const dialog = document.querySelector('[data-shortcut-modal="settings"]')
				const vv = window.visualViewport
				const top = vv ? vv.offsetTop : 0
				const left = vv ? vv.offsetLeft : 0
				const height = vv ? vv.height : window.innerHeight
				const width = vv ? vv.width : window.innerWidth
				if (!dialog) {
					banner('Settings: панель не создана. ' + (lastError ? 'Ошибка: ' + lastError : 'Ошибок в консоли нет.'))
					return
				}
				const r = dialog.getBoundingClientRect()
				const visible =
					r.width > 0 && r.height > 0 &&
					r.bottom > top && r.top < top + height &&
					r.right > left && r.left < left + width
				if (visible) return
				dialog.scrollIntoView({ block: 'center' })
				banner('Settings: панель вне видимой области, прокрутил. scale=' +
					(vv ? vv.scale.toFixed(2) : '?') + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) +
					' ' + Math.round(r.width) + 'x' + Math.round(r.height))
			}
			const onSettingsTap = (event) => {
				const target = event.target
				if (!(target instanceof Element)) return
				const item = target.closest('[role="menuitem"], button')
				if (!item || !/settings/i.test(item.textContent || '')) return
				setTimeout(checkSettings, 900)
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
				['click', onSettingsTap, true],
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
