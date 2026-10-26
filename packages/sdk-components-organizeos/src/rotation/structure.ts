/**
 * What the Rotation Control reads from the DOM it is part of (spec 4.3, 5.4).
 * Its root is its button's parent element, upstream's Tabs root. A Tabs
 * nested in one of the root's panels has its own tab list, tabs and panels,
 * which are not the root's.
 */

const isOwn = (element: Element, root: Element) => {
  for (
    let parent = element.parentElement;
    parent !== null && parent !== root;
    parent = parent.parentElement
  ) {
    if (parent.getAttribute("role") === "tabpanel") {
      return false;
    }
  }
  return true;
};

const getOwn = (root: Element, role: "tablist" | "tabpanel") =>
  Array.from(root.querySelectorAll(`[role="${role}"]`)).filter((element) =>
    isOwn(element, root)
  );

/** The root's own tab lists: not those of a Tabs nested in its panels. */
export const getOwnTabLists = (root: Element): Element[] =>
  getOwn(root, "tablist");

/** The root's tabs: those whose nearest tab list is one of the root's own. */
export const getOwnTabs = (root: Element): Element[] => {
  const lists = getOwnTabLists(root);
  return Array.from(root.querySelectorAll('[role="tab"]')).filter((tab) => {
    const list = tab.closest('[role="tablist"]');
    return list !== null && lists.includes(list);
  });
};

/** The root's own panels: not those of a Tabs nested in its panels. */
export const getOwnPanels = (root: Element): HTMLElement[] =>
  getOwn(root, "tabpanel").filter(
    (panel): panel is HTMLElement => panel instanceof HTMLElement
  );

/** The index of the selected tab, or -1 when none is selected. */
export const getSelectedIndex = (tabs: readonly Element[]) =>
  tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");

const isRendered = (element: Element) =>
  element instanceof HTMLElement && element.offsetParent !== null;

/**
 * The structure rotation needs (spec 5.4): the root holds exactly one tab list
 * of its own, the control's button comes before it in document order, and at
 * most one of the root's own panels is rendered, so inactive panels are
 * hidden. Anything else the root holds, such as the canvas check beside the
 * button, is not a tab list and does not count.
 */
export const checkRotationStructure = (
  root: Element | null,
  button: Element | null
): boolean => {
  if (root === null || button === null || button.parentElement !== root) {
    return false;
  }
  const lists = getOwnTabLists(root);
  if (lists.length !== 1) {
    return false;
  }
  if (
    (button.compareDocumentPosition(lists[0]) &
      Node.DOCUMENT_POSITION_FOLLOWING) ===
    0
  ) {
    return false;
  }
  return getOwn(root, "tabpanel").filter(isRendered).length <= 1;
};
