/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  FormRootContext,
  usePartRegistry,
  useRegisterPart,
  type FormPart,
} from "./context";

afterEach(() => {
  cleanup();
});

/** A root that keeps the parts it knows where the test can read them. */
const Root = ({
  seen,
  children,
}: {
  seen: { parts: readonly FormPart[] };
  children: ReactNode;
}) => {
  const { parts, register } = usePartRegistry();
  seen.parts = parts;
  return (
    <FormRootContext.Provider
      value={{
        register,
        fields: undefined,
        fieldErrors: new Map(),
        state: "initial",
      }}
    >
      {children}
    </FormRootContext.Provider>
  );
};

const Part = ({ part }: { part: FormPart | undefined }) => {
  useRegisterPart(part);
  return null;
};

test.each(["guests", "shifts", "questions", "consent"] as const)(
  "a %s part registers with the value it collects",
  (kind) => {
    const seen = { parts: [] as readonly FormPart[] };
    const collect = () => ({ [kind]: true });
    render(
      <Root seen={seen}>
        <Part part={{ kind, collect }} />
      </Root>
    );
    expect(seen.parts).toHaveLength(1);
    expect(seen.parts[0].kind).toBe(kind);
    expect(seen.parts[0].collect).toBe(collect);
    expect(seen.parts[0].collect?.()).toEqual({ [kind]: true });
    // composite parts have no single string to read
    expect(seen.parts[0].read).toBeUndefined();
  }
);

test("collect may return any value, and a consent part's is a boolean", () => {
  const seen = { parts: [] as readonly FormPart[] };
  render(
    <Root seen={seen}>
      <Part part={{ kind: "consent", collect: () => false }} />
    </Root>
  );
  expect(seen.parts[0].collect?.()).toBe(false);
});

test("the field, input and submit parts register as before, with no collect", () => {
  const seen = { parts: [] as readonly FormPart[] };
  const read = () => "ada@example.org";
  render(
    <Root seen={seen}>
      <Part part={{ kind: "field", name: "email" }} />
      <Part part={{ kind: "input", name: "email", read }} />
      <Part part={{ kind: "submit" }} />
    </Root>
  );
  expect(seen.parts).toEqual([
    { kind: "field", name: "email" },
    { kind: "input", name: "email", read },
    { kind: "submit" },
  ]);
  expect(seen.parts.every((part) => part.collect === undefined)).toBe(true);
  expect(seen.parts[1].read?.()).toBe("ada@example.org");
});

test("a part whose collect changes replaces its entry, and leaving removes it", () => {
  const seen = { parts: [] as readonly FormPart[] };
  const first = () => 1;
  const second = () => 2;
  const view = render(
    <Root seen={seen}>
      <Part part={{ kind: "questions", collect: first }} />
    </Root>
  );
  expect(seen.parts.map((part) => part.collect)).toEqual([first]);
  view.rerender(
    <Root seen={seen}>
      <Part part={{ kind: "questions", collect: second }} />
    </Root>
  );
  expect(seen.parts.map((part) => part.collect)).toEqual([second]);
  view.rerender(
    <Root seen={seen}>
      <Part part={undefined} />
    </Root>
  );
  expect(seen.parts).toEqual([]);
});

test("a part outside any root registers nowhere and does not throw", () => {
  expect(() =>
    render(<Part part={{ kind: "guests", collect: () => [] }} />)
  ).not.toThrow();
});
