/**
 * Whether the visitor caused an event, as opposed to a script. Its own module
 * so tests, which can only dispatch untrusted events, can stand in for it.
 */
export const isTrusted = (event: Event) => event.isTrusted;
