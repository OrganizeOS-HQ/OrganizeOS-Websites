import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  readSelectedCollection,
  writeSelectedCollection,
} from "./collection-memory";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("writes and reads the selection per project", () => {
  writeSelectedCollection("project-1", "c1");
  expect(readSelectedCollection("project-1")).toBe("c1");
  expect(readSelectedCollection("project-2")).toBeUndefined();
  writeSelectedCollection("project-2", "site");
  expect(readSelectedCollection("project-1")).toBe("c1");
  expect(readSelectedCollection("project-2")).toBe("site");
});

test("a throwing localStorage reads undefined and writes nothing, never throwing", () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  setItem.mockImplementation(() => {
    throw new Error("denied");
  });
  expect(readSelectedCollection("project-1")).toBeUndefined();
  expect(() => writeSelectedCollection("project-1", "c1")).not.toThrow();
  vi.restoreAllMocks();
  expect(readSelectedCollection("project-1")).toBeUndefined();
});
