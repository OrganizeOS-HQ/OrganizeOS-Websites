import { createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { Dialog, TooltipProvider } from "@webstudio-is/design-system";
import { HttpResourceEditor } from "./http-resource-editor";
import { EmailResourceEditor } from "./email-resource-editor";
import type { PanelApi } from "./shared/variable-panel-api";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const renderEditor = async (
  Editor: typeof HttpResourceEditor | typeof EmailResourceEditor
) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const editorRef = createRef<PanelApi>();
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        undefined,
        createElement(
          Dialog,
          { open: true },
          createElement(Editor, {
            ref: editorRef,
            formRef: createRef<HTMLFormElement>(),
            onSubmit: vi.fn(),
            disabled: false,
            commonFields: null,
            title: "New variable",
            titleActions: () => null,
            value: undefined,
            onValueChange: vi.fn(),
            variableType: "resource",
          })
        )
      )
    )
  );
  return editorRef;
};

test("Resource editor exposes its form save handle through its ref", async () => {
  const editorRef = await renderEditor(HttpResourceEditor);
  expect(editorRef.current?.save(new FormData())).toBe(false);
});

// OrganizeOS fork: input validation (docs/ORGANIZEOS-FORK.md section 10)
test.each(["subject", "body", "senderExpression", "recipientsExpression"])(
  "the Email resource editor does not save an email %s that fails input validation",
  async (key) => {
    const editorRef = await renderEditor(EmailResourceEditor);
    const formData = new FormData();
    formData.set("name", "Email");
    formData.set("method", "post");
    formData.set("url", `""`);
    formData.set(
      "email-settings",
      JSON.stringify({ recipientMode: "custom", [key]: `"a".constructor` })
    );
    expect(editorRef.current?.save(formData)).toBe(false);
  }
);
