import { useEffect, useRef, useState } from "react";
import { computed } from "nanostores";
import {
  $propsIndex,
  $registeredComponentMetas,
  $selectedInstanceSelector,
  $selectedPage,
} from "~/shared/nano-states";
import {
  $instances,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { $matchingBreakpoints } from "~/builder/features/style-panel/shared/model";
import {
  checkSectionContrast,
  type ContrastReport,
} from "./backgrounds/contrast";

/**
 * The contrast report off the input path (panel overhaul spec 5.3). In the
 * Style panel every section is open in default mode, so a report computed
 * synchronously would re-run the whole subtree check on every style edit.
 * Instead a change of its inputs schedules one run, and a newer change
 * replaces a pending one.
 */

const contrastDelay = 150;

/**
 * Runs `run` once the main thread is idle, within 150 ms, and returns its
 * cancel. requestIdleCallback is read on every call and used only where it
 * exists (Safari has none); elsewhere it is setTimeout. A throw here would
 * take the whole Style tab down, so nothing calls it unchecked.
 */
export const scheduleContrastRun = (run: () => void): (() => void) => {
  const { requestIdleCallback, cancelIdleCallback } = globalThis as Partial<
    Pick<typeof globalThis, "requestIdleCallback" | "cancelIdleCallback">
  >;
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: contrastDelay });
    return () => {
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(handle);
      }
    };
  }
  const handle = setTimeout(run, contrastDelay);
  return () => clearTimeout(handle);
};

/**
 * What the contrast check reads, as one store to listen to. It is the stores
 * the synchronous report was computed over, less the section selector, which
 * derives from three of them and reaches the hook as its argument.
 */
export const $contrastInputs = computed(
  [
    $styles,
    $styleSourceSelections,
    $instances,
    $propsIndex,
    $registeredComponentMetas,
    $matchingBreakpoints,
    $selectedInstanceSelector,
    $selectedPage,
  ],
  (...inputs) => inputs
);

/**
 * The contrast report for `selector`, computed after a scheduled run: one at
 * once, then one more after each change of its inputs. A report is shown only
 * for the selector it was computed for, so after a change of selection it is
 * undefined until the new run lands, and the previous element's groups are
 * never shown for the new one. With no selector it schedules nothing.
 */
export const useDeferredContrastReport = (
  selector: InstanceSelector | undefined
): ContrastReport | undefined => {
  const key = selector?.join(",");
  const [state, setState] = useState<{
    key: string;
    report: ContrastReport;
  }>();
  const latestSelector = useRef(selector);
  latestSelector.current = selector;

  useEffect(() => {
    const current = latestSelector.current;
    if (key === undefined || current === undefined) {
      return;
    }
    const run = () => {
      setState({ key, report: checkSectionContrast(current) });
    };
    let cancel = scheduleContrastRun(run);
    const unlisten = $contrastInputs.listen(() => {
      cancel();
      cancel = scheduleContrastRun(run);
    });
    return () => {
      cancel();
      unlisten();
    };
  }, [key]);

  return state !== undefined && state.key === key ? state.report : undefined;
};
