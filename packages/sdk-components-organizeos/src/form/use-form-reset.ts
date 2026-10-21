import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ForwardedRef,
  type RefCallback,
} from "react";
import { assignRef } from "./merge-ref";

/**
 * A ref callback that calls `onReset` when the form around the element is
 * reset (a Button of type "reset" inside the form, say), and passes the element
 * on to `ref` (the one a part receives, which the canvas relies on).
 *
 * A browser's reset puts every control back to its default without an
 * `onChange`, so a part that keeps what the visitor entered in React state has
 * to start over itself, or what it sends no longer matches what its controls
 * show. The closest `form` is listened to for as long as the element is
 * mounted, and the latest `onReset` is called. Outside a form there is nothing
 * to reset and nothing is listened to.
 */
export const useFormReset = <Value extends HTMLElement>(
  onReset: () => void,
  ref?: ForwardedRef<Value>
): RefCallback<Value> => {
  const latest = useRef(onReset);
  useLayoutEffect(() => {
    latest.current = onReset;
  });
  const stop = useRef<() => void>();
  return useCallback(
    (element: Value | null) => {
      stop.current?.();
      stop.current = undefined;
      const form = element?.closest("form");
      if (form !== null && form !== undefined) {
        const listener = () => latest.current();
        form.addEventListener("reset", listener);
        stop.current = () => form.removeEventListener("reset", listener);
      }
      assignRef(ref, element);
    },
    [ref]
  );
};
