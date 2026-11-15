/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import fundraisers from "../__fixtures__/fundraisers.json";
import type { Renderer } from "../form/submit";
import {
  GoalProgress,
  GoalProgressFigure,
  formatGoalMoney,
  progressPercent,
  resolveGoalProgress,
} from "./goal-progress";

const SPRING = "b1c2d3e4-0000-4000-8000-000000000001";
const FLOOD = "b1c2d3e4-0000-4000-8000-000000000002";
const DRAFT = "b1c2d3e4-0000-4000-8000-000000000003";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("money", () => {
  expect(formatGoalMoney(2500000, "USD")).toBe("$25,000");
  expect(formatGoalMoney(642050, "USD")).toBe("$6,420.50");
  expect(formatGoalMoney(0, "USD")).toBe("$0");
  expect(formatGoalMoney(1999, "USD")).toBe("$19.99");
  for (const [cents, currency] of [
    [-1, "USD"],
    [1.5, "USD"],
    ["100", "USD"],
    [100, "XX"],
    [100, 7],
  ] as const) {
    expect(formatGoalMoney(cents, currency), `${cents} ${currency}`).toBe(
      undefined
    );
  }
});

test("percent", () => {
  expect(progressPercent(642050, 2500000)).toBe(25);
  expect(progressPercent(0, 100)).toBe(0);
  expect(progressPercent(150, 100)).toBe(100);
  expect(progressPercent(99, 100)).toBe(99);
});

test("resolving a record", () => {
  expect(resolveGoalProgress(fundraisers, SPRING)).toMatchObject({
    status: "ok",
    fundraiser: { title: "Spring Drive" },
  });
  expect(resolveGoalProgress(fundraisers, FLOOD)).toEqual({
    status: "no-goal",
  });
  expect(resolveGoalProgress(fundraisers, DRAFT)).toEqual({ status: "draft" });
  expect(resolveGoalProgress(fundraisers, "unknown")).toEqual({
    status: "not-found",
  });
  expect(resolveGoalProgress(fundraisers, "")).toEqual({ status: "no-record" });
  expect(resolveGoalProgress({}, SPRING)).toEqual({ status: "no-data" });
});

const withRenderer = (renderer: Renderer, children: ReactNode) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer,
    }}
  >
    {children}
  </ReactSdkContext.Provider>
);

const block = (
  props: { record?: string; data?: unknown; showDonors?: boolean } = {},
  renderer: Renderer = undefined
) =>
  withRenderer(
    renderer,
    <GoalProgress
      data-testid="root"
      record={SPRING}
      data={fundraisers}
      showDonors={false}
      {...props}
    >
      <div aria-hidden="true" data-testid="track" />
      <GoalProgressFigure data-testid="raised" figure="raised" />
      <GoalProgressFigure data-testid="goal" figure="goal" />
      <GoalProgressFigure data-testid="donors" figure="donors" />
    </GoalProgress>
  );

test("a published fundraiser shows its figures", () => {
  const { getByTestId, queryByTestId } = render(block());
  const root = getByTestId("root");
  expect(root.style.getPropertyValue("--os-progress")).toBe("25%");
  expect(getByTestId("raised").textContent).toBe("$6,420.50 raised");
  expect(getByTestId("goal").textContent).toBe("of $25,000");
  expect(queryByTestId("donors")).toBeNull();
});

test("donors show only with the switch, counted", () => {
  const { getByTestId } = render(block({ showDonors: true }));
  expect(getByTestId("donors").textContent).toBe("48 donors");
  cleanup();
  const one = {
    data: [{ ...fundraisers.data[0], donor_count: 1 }],
  };
  const single = render(block({ showDonors: true, data: one }));
  expect(single.getByTestId("donors").textContent).toBe("1 donor");
  cleanup();
  const many = { data: [{ ...fundraisers.data[0], donor_count: 12345 }] };
  const lots = render(block({ showDonors: true, data: many }));
  expect(lots.getByTestId("donors").textContent).toBe("12,345 donors");
});

test("an ended fundraiser with a goal still shows", () => {
  const ended = {
    data: [{ ...fundraisers.data[0], ends_at: "2020-01-01T00:00:00+00:00" }],
  };
  const { getByTestId } = render(block({ data: ended }));
  expect(getByTestId("raised").textContent).toBe("$6,420.50 raised");
  expect(getByTestId("goal").textContent).toBe("of $25,000");
});

test.each([
  ["no record", { record: "" }],
  ["an unknown record", { record: "unknown" }],
  ["no goal", { record: FLOOD }],
  ["a draft", { record: DRAFT }],
  ["no data", { data: { error: "x" } }],
])("a published page renders nothing for %s", (_label, props) => {
  const { container } = render(block(props));
  expect(container.innerHTML).toBe("");
});

test.each([
  ["", "Pick a fundraiser"],
  ["unknown", "Fundraiser not found"],
  [FLOOD, "This fundraiser has no goal"],
])("on the canvas the check names %s", (record, line) => {
  const { getByTestId, getByText } = render(block({ record }, "canvas"));
  expect(getByTestId("root")).toBeTruthy();
  expect(getByText(line)).toBeTruthy();
  expect(getByTestId("raised").textContent).toBe("");
});

test("a draft on the canvas shows its figures and a note", () => {
  const { getByTestId, getByText } = render(block({ record: DRAFT }, "canvas"));
  expect(getByText("Shows once the fundraiser is published")).toBeTruthy();
  expect(getByTestId("raised").textContent).toBe("$0 raised");
  expect(getByTestId("goal").textContent).toBe("of $10,000");
});

test("the root keeps its props off the page", () => {
  const { getByTestId } = render(block({ showDonors: true }));
  const root = getByTestId("root");
  for (const name of ["record", "data", "showdonors", "showDonors"]) {
    expect(root.hasAttribute(name), name).toBe(false);
  }
});

test("server and client agree", async () => {
  const tree = block({ showDonors: true });
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  document.body.append(container);
  expect(container.innerHTML).toContain("$6,420.50 raised");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    hydrateRoot(container, tree);
  });
  expect(errors).not.toHaveBeenCalled();
});
