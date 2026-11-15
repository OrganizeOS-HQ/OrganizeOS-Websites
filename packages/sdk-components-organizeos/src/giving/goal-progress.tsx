import {
  createContext,
  forwardRef,
  useContext,
  type ComponentProps,
  type CSSProperties,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import { isBuilderRender } from "../form/submit";
import {
  findFundraiser,
  parseFundraisersData,
  type Fundraiser,
} from "./fundraisers-data";

/**
 * Goal Progress (OrganizeOS builder donations spec 2026-11-13, 7.3; plan F1,
 * F-D13 and F-D14): a fundraiser's raised and goal figures and a bar, read
 * from the Fundraisers Resource its insert binds at the root (`data`) and
 * found by `record` in plain JS, since expressions cannot format money or
 * divide. On a published page it renders nothing when the fundraiser cannot
 * show; on the canvas it stays, with a check that says why.
 */

/**
 * Integer cents as money in US English, with no cents for whole dollars:
 * 2500000 USD is "$25,000" and 642050 is "$6,420.50". Undefined for cents
 * that are not a safe integer of 0 or more, or a currency `Intl` does not
 * know.
 */
export const formatGoalMoney = (
  cents: unknown,
  currency: unknown
): undefined | string => {
  if (
    typeof cents !== "number" ||
    Number.isSafeInteger(cents) === false ||
    cents < 0 ||
    typeof currency !== "string"
  ) {
    return;
  }
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return;
  }
};

/** The bar's share of the goal, whole percent, floored and capped at 100. */
export const progressPercent = (raised: number, goal: number): number =>
  Math.min(100, Math.floor((raised / goal) * 100));

export type GoalProgressResolution =
  | { status: "ok"; fundraiser: Fundraiser }
  | { status: "no-record" | "not-found" | "no-goal" | "draft" | "no-data" };

/**
 * The fundraiser a root shows. A draft (listed only on the canvas) reads as
 * `draft` before its goal is checked, and one with no goal as `no-goal`.
 */
export const resolveGoalProgress = (
  data: unknown,
  record: unknown
): GoalProgressResolution => {
  const list = parseFundraisersData(data);
  if (list === undefined) {
    return { status: "no-data" };
  }
  if (typeof record !== "string" || record.trim() === "") {
    return { status: "no-record" };
  }
  const fundraiser = findFundraiser(list, record);
  if (fundraiser === undefined) {
    return { status: "not-found" };
  }
  if (fundraiser.draft) {
    return { status: "draft" };
  }
  if (fundraiser.goalCents === null) {
    return { status: "no-goal" };
  }
  return { status: "ok", fundraiser };
};

type GoalProgressValue = { fundraiser?: Fundraiser; showDonors: boolean };

const GoalProgressContext = createContext<GoalProgressValue>({
  showDonors: false,
});

type GoalProgressProps = ComponentProps<"div"> & {
  /** The fundraiser's id. */
  record?: string;
  /** The `GET /v1/fundraisers` body, bound at insert. */
  data?: unknown;
  /** Whether the donors figure shows. */
  showDonors?: boolean;
};

// No line for no-data: on the canvas that is a read still loading, and a
// failed read is the Give to row's to say.
const canvasProblem: Partial<Record<GoalProgressResolution["status"], string>> =
  {
    "no-record": "Pick a fundraiser",
    "not-found": "Fundraiser not found",
    "no-goal": "This fundraiser has no goal",
  };

export const GoalProgress = forwardRef<ElementRef<"div">, GoalProgressProps>(
  ({ record, data, showDonors = false, children, style, ...props }, ref) => {
    const { renderer } = useContext(ReactSdkContext);
    const resolved = resolveGoalProgress(data, record);
    const onCanvas = isBuilderRender(renderer);
    if (resolved.status !== "ok" && onCanvas === false) {
      return null;
    }
    // A draft shows on the canvas with its figures: the preview lists it.
    const draft =
      resolved.status === "draft"
        ? findFundraiser(parseFundraisersData(data) ?? [], record)
        : undefined;
    const fundraiser = resolved.status === "ok" ? resolved.fundraiser : draft;
    const percent =
      fundraiser !== undefined && fundraiser.goalCents !== null
        ? progressPercent(fundraiser.raisedCents, fundraiser.goalCents)
        : 0;
    const problem = canvasProblem[resolved.status];
    return (
      <GoalProgressContext.Provider value={{ fundraiser, showDonors }}>
        <div
          {...props}
          ref={ref}
          style={{ ...style, "--os-progress": `${percent}%` } as CSSProperties}
        >
          <CanvasCheck
            title="Goal progress"
            problems={problem === undefined ? [] : [problem]}
            notes={
              resolved.status === "draft"
                ? ["Shows once the fundraiser is published"]
                : []
            }
          />
          {children}
        </div>
      </GoalProgressContext.Provider>
    );
  }
);

GoalProgress.displayName = "GoalProgress";

type GoalProgressFigureProps = ComponentProps<"div"> & {
  /** Which figure: `raised`, `goal` or `donors`. */
  figure?: string;
};

const donorCount = new Intl.NumberFormat("en-US");

const figureText = (
  figure: string | undefined,
  fundraiser: Fundraiser | undefined
): string => {
  if (fundraiser === undefined) {
    return "";
  }
  if (figure === "raised") {
    const amount = formatGoalMoney(fundraiser.raisedCents, fundraiser.currency);
    return amount === undefined ? "" : `${amount} raised`;
  }
  if (figure === "goal") {
    const amount = formatGoalMoney(fundraiser.goalCents, fundraiser.currency);
    return amount === undefined ? "" : `of ${amount}`;
  }
  if (figure === "donors") {
    const count = fundraiser.donorCount;
    return count === 1 ? "1 donor" : `${donorCount.format(count)} donors`;
  }
  return "";
};

/** One of Goal Progress's figures, its text from the root's fundraiser. */
export const GoalProgressFigure = forwardRef<
  ElementRef<"div">,
  GoalProgressFigureProps
>(({ figure, children: _children, ...props }, ref) => {
  const { fundraiser, showDonors } = useContext(GoalProgressContext);
  if (figure === "donors" && showDonors === false) {
    return null;
  }
  return (
    <div {...props} ref={ref}>
      {figureText(figure, fundraiser)}
    </div>
  );
});

GoalProgressFigure.displayName = "GoalProgressFigure";
