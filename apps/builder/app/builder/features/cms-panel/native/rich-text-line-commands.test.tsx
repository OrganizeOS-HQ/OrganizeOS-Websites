import { afterEach, describe, expect, test, vi } from "vitest";
import {
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  createEditor,
  type LexicalCommand,
  type LexicalEditor,
} from "lexical";
import {
  COMMAND_ORDER,
  FIELD_HANDLER_IDS,
  fieldHandlersOf,
} from "./rich-text-line-commands";
import { mount } from "./rich-text-line-test-kit";
import { editorOf } from "./rich-text-test-harness";

const PRIORITY = {
  CRITICAL: COMMAND_PRIORITY_CRITICAL,
  HIGH: COMMAND_PRIORITY_HIGH,
  NORMAL: COMMAND_PRIORITY_NORMAL,
  LOW: COMMAND_PRIORITY_LOW,
} as const;

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("the one registration at runtime", () => {
  test("each command and priority of COMMAND_ORDER has exactly one registration", async () => {
    // the prototype every editor shares: lexical exports the class as a type only
    const proto = Object.getPrototypeOf(createEditor()) as LexicalEditor;
    const spy = vi.spyOn(proto, "registerCommand");
    restore = () => spy.mockRestore();
    await mount("<p>Aw</p>");
    const editor = editorOf()!;
    const calls: Array<[string | undefined, number]> = [];
    spy.mock.calls.forEach((call, index) => {
      if (spy.mock.contexts[index] === editor) {
        calls.push([
          (call[0] as LexicalCommand<unknown>).type,
          call[2] as number,
        ]);
      }
    });
    for (const row of COMMAND_ORDER) {
      const count = calls.filter(
        ([type, priority]) =>
          type === row.command && priority === PRIORITY[row.priority]
      ).length;
      expect(count, `${row.command} at ${row.priority}`).toBe(1);
    }
  });

  test("after mount every field handler has a provider", async () => {
    await mount("<p>Aw</p>");
    expect(fieldHandlersOf(editorOf()!)).toEqual(new Set(FIELD_HANDLER_IDS));
  });
});
