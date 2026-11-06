/**
 * The canvas play flag: a selection override the builder sets on an Animate
 * Children or a Convergence Field while it, or an instance inside it, is
 * selected (the metas' `selectionReveal`), which upstream's Navigator also
 * reads to pick an icon. Inlined rather than imported from
 * `@webstudio-is/sdk/runtime`, so the shipped closure gains no package
 * (spec 14.8); `animate-children.test.tsx` pins it to that constant.
 */
export const canPlayOnCanvasProperty = "data-ws-animation-can-play-on-canvas";
