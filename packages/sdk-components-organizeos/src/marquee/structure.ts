/** The package's canvas-check boxes are builder chrome, never parts. */
const isCanvasBox = (element: Element) =>
  element.hasAttribute("data-organizeos-canvas-check") ||
  element.hasAttribute("data-organizeos-canvas-note");

/**
 * The structure the Marquee needs (spec 4.3, 12.7): exactly one registered
 * Pause Button and one registered Track, both direct children of the root,
 * the button first among the root's children and so before the track. The
 * canvas-check boxes the root renders beside its parts on the canvas do not
 * count.
 */
export const checkMarqueeStructure = (
  root: Element | null,
  buttons: readonly Element[],
  tracks: readonly Element[]
): boolean => {
  if (root === null || buttons.length !== 1 || tracks.length !== 1) {
    return false;
  }
  const [button] = buttons;
  const [track] = tracks;
  if (button.parentElement !== root || track.parentElement !== root) {
    return false;
  }
  const children = Array.from(root.children).filter(
    (child) => isCanvasBox(child) === false
  );
  return (
    children[0] === button &&
    (button.compareDocumentPosition(track) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
  );
};
