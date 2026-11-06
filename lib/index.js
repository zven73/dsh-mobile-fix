/**
 * Host half of `dsh-mobile-fix`.
 *
 * The whole fix is browser-side: `lib/client.js` injects the stylesheet and
 * the drawer behavior. The Host row exists only so the package is a valid
 * Loader entry whose `dsh.client` declaration joins the browser roster.
 */

export const name = 'dsh-mobile-fix'

export function apply() {}
