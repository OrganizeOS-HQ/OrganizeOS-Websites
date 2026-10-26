import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

/**
 * "playing" and "stopped" show the Pause button with its Pause and its Play
 * label; "off" means the marquee will not move, and the button hides.
 */
export type MarqueeState = "playing" | "stopped" | "off";

export type MarqueePartKind = "button" | "track";

/**
 * What the Marquee root shares with its parts (spec 12.7, plan amendment 5):
 * the parts register their elements, and the button reads the state and
 * toggles it. The labels are the button's own props.
 */
export type MarqueeRoot = {
  register: (kind: MarqueePartKind, element: HTMLElement) => () => void;
  state: MarqueeState;
  toggle: () => void;
};

export const MarqueeContext = createContext<MarqueeRoot | undefined>(undefined);

export type MarqueeParts = {
  buttons: readonly HTMLElement[];
  tracks: readonly HTMLElement[];
};

/** The root's side of registration: the parts' elements, in state. */
export const useMarqueeParts = () => {
  const [parts, setParts] = useState<MarqueeParts>({
    buttons: [],
    tracks: [],
  });
  const register = useCallback(
    (kind: MarqueePartKind, element: HTMLElement) => {
      const key = kind === "button" ? "buttons" : "tracks";
      setParts((previous) => ({
        ...previous,
        [key]: [...previous[key], element],
      }));
      return () => {
        setParts((previous) => ({
          ...previous,
          [key]: previous[key].filter((item) => item !== element),
        }));
      };
    },
    []
  );
  return { parts, register };
};

/**
 * A part's side: register its element with the closest root, if there is
 * one. A layout effect, so the root knows its parts before the browser
 * paints.
 */
export const useRegisterMarqueePart = (
  kind: MarqueePartKind,
  ref: RefObject<HTMLElement | null>
) => {
  const register = useContext(MarqueeContext)?.register;
  useLayoutEffect(() => {
    const element = ref.current;
    if (register === undefined || element === null) {
      return;
    }
    return register(kind, element);
  }, [register, kind, ref]);
};
