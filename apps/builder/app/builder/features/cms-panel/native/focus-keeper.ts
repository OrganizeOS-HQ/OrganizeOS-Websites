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

/**
 * A write started from the focused control: the keeper stands back while it
 * runs, and the returned done gives that control the focus again, a frame
 * later, when the focus was lost meanwhile and the control is still drawn
 * and enabled.
 */
export const keepFocusThrough = () => {
  const control = document.activeElement;
  const release = holdFocusKeeper();
  return () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const lost =
        active === null ||
        active === document.body ||
        active.isConnected === false ||
        active.matches(":disabled");
      if (
        lost &&
        control instanceof HTMLElement &&
        control !== document.body &&
        control.isConnected &&
        control.matches(":disabled") === false
      ) {
        control.focus();
      }
      release();
    });
  };
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
 * view's Back, the item editor's Back, the field or collection row it
 * belongs to, Add field or New item, the open collection's row, a refusal
 * line's first button, "+", the first collection's row, else the selected
 * tab. A disabled control is passed over.
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
  const first = (selector: string) =>
    screen.querySelector<HTMLElement>(selector) ?? undefined;
  const candidates: Array<HTMLElement | undefined> = [
    first('[data-cms-structure-header] [aria-label="Back"]'),
    first('[data-cms-editor-header] [aria-label="Back"]'),
    first("[data-cms-field-row][data-current] button"),
    first('[aria-label="Add field"]'),
    [...screen.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "New item"
    ),
    first("[data-cms-collection][data-current] button"),
    first("[data-cms-refusal] button"),
    first('[aria-label="New collection"]'),
    first("[data-cms-collection] button"),
    first('[role="tab"][aria-selected="true"]'),
  ];
  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      isDrawn(candidate) &&
      candidate.matches(":disabled") === false
    ) {
      candidate.focus();
      if (document.activeElement === candidate) {
        return;
      }
    }
  }
};
