/**
 * The canvas play flag: a memory prop the builder sets on an Animate
 * Children while it is selected in the Navigator, which upstream's Navigator
 * reads to pick an icon. Inlined rather than imported from
 * `@webstudio-is/sdk/runtime`, so the shipped closure gains no package
 * (spec 14.8); `animate-children.test.tsx` pins it to that constant.
 */
export const canPlayOnCanvasProperty = "data-ws-animation-can-play-on-canvas";
