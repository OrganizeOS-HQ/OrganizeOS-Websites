import { afterEach, describe, expect, test, vi } from "vitest";
import { clientSettingsStorageKey } from "~/shared/color-scheme";
import { dropUnknownPanelWidths } from "./organizeos-panel-widths";

// The OrganizeOS data tab was a sidebar panel named "organizeos". Its stored
// width must not fail the settings' parse, which falls back to every default.

// settings.ts reads the store once, as it loads; a query makes each read a
// fresh instance of the module (browser mode does not reset modules).
let instance = 0;
const readStoredSettings = async (stored: unknown) => {
  localStorage.setItem(clientSettingsStorageKey, JSON.stringify(stored));
  instance += 1;
  const { getSetting } = (await import(
    /* @vite-ignore */ `./settings.ts?instance=${instance}`
  )) as typeof import("./settings");
  return getSetting;
};

afterEach(() => {
  localStorage.removeItem(clientSettingsStorageKey);
  vi.restoreAllMocks();
});

describe("stored settings after the OrganizeOS data tab", () => {
  test("a stored organizeos width is dropped and every other setting kept", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const getSetting = await readStoredSettings({
      navigatorLayout: "docked",
      sidebarPanelWidths: { organizeos: 320, pages: 280 },
    });
    expect(getSetting("navigatorLayout")).toBe("docked");
    expect(getSetting("sidebarPanelWidths")).toEqual({ pages: 280 });
    expect(
      error.mock.calls.some(([entry]) =>
        JSON.stringify(entry).includes("Bad user settings")
      )
    ).toBe(false);
  });

  test("a width that is not a number still fails the parse, as upstream's does", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const getSetting = await readStoredSettings({
      navigatorLayout: "docked",
      sidebarPanelWidths: { pages: "wide" },
    });
    expect(getSetting("navigatorLayout")).toBe("undocked");
    expect(error).toHaveBeenCalled();
  });
});

describe("dropUnknownPanelWidths", () => {
  test("keeps the panel names' widths and drops the rest", () => {
    expect(
      dropUnknownPanelWidths({
        stylePanelMode: "focus",
        sidebarPanelWidths: { organizeos: 320, cms: 600, assets: 300 },
      })
    ).toEqual({
      stylePanelMode: "focus",
      sidebarPanelWidths: { assets: 300 },
    });
  });

  test("leaves anything else as it is, for the parse to judge", () => {
    for (const value of [
      null,
      "text",
      [],
      {},
      { sidebarPanelWidths: null },
      { sidebarPanelWidths: [320] },
    ]) {
      expect(dropUnknownPanelWidths(value)).toEqual(value);
    }
  });
});
