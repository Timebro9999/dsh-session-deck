/**
 * dsh-session-deck — host half.
 *
 * The deck is a browser-side surface: the host half carries no state and
 * registers no service. It exists so the profile entry activates (the loader
 * imports this module through `package.json#main`) and so the composition has
 * a live plugin whose client half the web shell loads.
 */
export const name = 'session-deck'

/** No host-side surface: every seat is declared by the client half. */
export function apply() {}
