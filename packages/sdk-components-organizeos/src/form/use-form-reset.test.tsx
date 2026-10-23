/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFormReset } from "./use-form-reset";

afterEach(cleanup);

const Probe = ({ onReset }: { onReset: () => void }) => {
  const ref = useFormReset(onReset);
  return <div ref={ref} data-testid="probe" />;
};

describe("useFormReset", () => {
  test("calls back when the form around the element is reset", () => {
    const onReset = vi.fn();
    render(
      <form>
        <Probe onReset={onReset} />
        <button type="reset">Reset</button>
      </form>
    );
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  test("calls the latest callback, not the one the element mounted with", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(
      <form>
        <Probe onReset={first} />
        <button type="reset">Reset</button>
      </form>
    );
    view.rerender(
      <form>
        <Probe onReset={second} />
        <button type="reset">Reset</button>
      </form>
    );
    fireEvent.click(screen.getByText("Reset"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("ignores another form's reset", () => {
    const onReset = vi.fn();
    render(
      <>
        <form>
          <Probe onReset={onReset} />
        </form>
        <form>
          <button type="reset">Reset other</button>
        </form>
      </>
    );
    fireEvent.click(screen.getByText("Reset other"));
    expect(onReset).not.toHaveBeenCalled();
  });

  test("stops listening when the element unmounts", () => {
    const onReset = vi.fn();
    const view = render(
      <form data-testid="form">
        <Probe onReset={onReset} />
        <button type="reset">Reset</button>
      </form>
    );
    const form = screen.getByTestId("form");
    view.rerender(
      <form data-testid="form">
        <button type="reset">Reset</button>
      </form>
    );
    fireEvent.click(screen.getByText("Reset"));
    // the same form is still there: only the listener is gone
    expect(screen.getByTestId("form")).toBe(form);
    expect(onReset).not.toHaveBeenCalled();
  });

  test("listens again when the element mounts again", () => {
    const onReset = vi.fn();
    const tree = (shown: boolean) => (
      <form>
        {shown && <Probe onReset={onReset} />}
        <button type="reset">Reset</button>
      </form>
    );
    const view = render(tree(true));
    view.rerender(tree(false));
    view.rerender(tree(true));
    fireEvent.click(screen.getByText("Reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  test("does nothing outside a form", () => {
    const onReset = vi.fn();
    render(<Probe onReset={onReset} />);
    expect(screen.getByTestId("probe")).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();
  });
});
