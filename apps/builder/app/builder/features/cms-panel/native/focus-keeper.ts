/**
 * The CMS screen's one focus keeper: a focus lost to the page goes to the
 * screen's nearest control, unless a placement of its own is under way.
 */

let placing = 0;

/**
 * A focus placement that takes more than a frame (it waits for a row to be
 * drawn): the keeper stands back until the returned release, two seconds
 * at most.
 */
export const holdFocusKeeper = () => {
  placing += 1;
  let released = false;
  const release = () => {
    if (released === false) {
      released = true;
      placing -= 1;
    }
  };
  // a placement that never ends (its view went away) frees the keeper
  setTimeout(release, 2000);
  return release;
};

/** Runs `run` two frames from now; answers its cancel. */
export const afterTwoFrames = (run: () => void) => {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(run);
  });
  return () => cancelAnimationFrame(frame);
};

/** Whether an element is drawn: not hidden and with a box. */
const isDrawn = (element: Element) =>
  element.closest("[hidden]") === null && element.getClientRects().length > 0;

/**
 * Gives a focus lost to the page to the screen's nearest control: the open
 * view's Back, the field or collection row it belongs to, Add field or New
 * item, else the open collection's row.
 */
export const keepFocusInScreen = () => {
  if (placing > 0) {
    return;
  }
  const screen = document.querySelector<HTMLElement>(
    "[data-cms-native-screen]"
  );
  const active = document.activeElement;
  if (
    screen === null ||
    isDrawn(screen) === false ||
    (active !== null && active !== document.body && active.isConnected) ||
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
    ) !== null
  ) {
    return;
  }
  const candidates: Array<HTMLElement | undefined> = [
    ...[
      '[data-cms-structure-header] [aria-label="Back"]',
      "[data-cms-field-row][data-current] button",
      '[aria-label="Add field"]',
    ].map(
      (selector) => screen.querySelector<HTMLElement>(selector) ?? undefined
    ),
    [...screen.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "New item"
    ),
    screen.querySelector<HTMLElement>(
      "[data-cms-collection][data-current] button"
    ) ?? undefined,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && isDrawn(candidate)) {
      candidate.focus();
      return;
    }
  }
};
