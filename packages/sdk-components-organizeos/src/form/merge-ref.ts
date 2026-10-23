import {
  useCallback,
  type ForwardedRef,
  type MutableRefObject,
  type RefCallback,
} from "react";

/** Gives a ref, whichever kind it is, its value. */
export const assignRef = <Value>(
  ref: ForwardedRef<Value> | undefined,
  value: Value | null
) => {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
};

/**
 * One ref callback for the ref a part receives (the canvas passes one) and
 * the part's own ref to its element.
 */
export const useMergedRef = <Value>(
  forwardedRef: ForwardedRef<Value>,
  ownRef: MutableRefObject<Value | null>
): RefCallback<Value> =>
  useCallback(
    (value: Value | null) => {
      ownRef.current = value;
      assignRef(forwardedRef, value);
    },
    [forwardedRef, ownRef]
  );
