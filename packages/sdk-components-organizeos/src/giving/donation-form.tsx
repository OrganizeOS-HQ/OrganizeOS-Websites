import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import { useMergedRef } from "../form/merge-ref";
import { navigateTo } from "../form/navigate";
import { isBuilderRender, type Renderer } from "../form/submit";
import { readPageShareCode } from "../share-code/share-code";
import { GIVE_FRAME_TIMEOUT_MS, GIVE_PLACEHOLDER_HEIGHT } from "./contract";
import { afterGiftTarget, readGiveMessage } from "./give-messages";
import {
  buildGiveSrc,
  encodeSiteTheme,
  isOrgId,
  isPlatformOrigin,
  parseGiveTarget,
  readSiteTheme,
} from "./give-src";

/**
 * The Donation Form (OrganizeOS builder donations spec 2026-11-13, 7.2; plan
 * F1, F-D1 and F-D9 to F-D12): a card that takes a gift where it sits, by
 * framing the platform's give embed. The root holds the block's settings and
 * gives them to its parts; the Donation Frame part builds the frame's address
 * in the browser after hydration, sizes the frame from its height messages,
 * hides it behind the Unavailable line when it does not answer, and follows
 * the after-gift page on the page's own origin only.
 */

type DonationFormSettings = {
  target?: string;
  organizationId?: string;
  platformOrigin?: string;
  afterGift?: string;
  afterGiftPage?: string;
  state?: string;
  renderer: Renderer;
};

export const DonationFormContext = createContext<
  DonationFormSettings | undefined
>(undefined);

type DonationFormProps = ComponentProps<"div"> & {
  /** `general`, or a campaign id. */
  target?: string;
  /** Written at insert from the builder's site record. */
  organizationId?: string;
  /** Written at insert: the platform's origin, where the frame lives. */
  platformOrigin?: string;
  /** `message` (the thank-you stays in the frame) or `page`. */
  afterGift?: string;
  /** The page the site goes to after a gift, on its own origin. */
  afterGiftPage?: string;
  /** Canvas only: `ready` or `unavailable`. */
  state?: string;
};

export const DonationForm = forwardRef<ElementRef<"div">, DonationFormProps>(
  (
    {
      target,
      organizationId,
      platformOrigin,
      afterGift,
      afterGiftPage,
      state,
      children,
      ...props
    },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const settings = useMemo(
      () => ({
        target,
        organizationId,
        platformOrigin,
        afterGift,
        afterGiftPage,
        state,
        renderer,
      }),
      [
        target,
        organizationId,
        platformOrigin,
        afterGift,
        afterGiftPage,
        state,
        renderer,
      ]
    );
    return (
      <DonationFormContext.Provider value={settings}>
        <div {...props} ref={ref}>
          {children}
        </div>
      </DonationFormContext.Provider>
    );
  }
);

DonationForm.displayName = "DonationForm";

/** The line in place of a frame that cannot show: the frame's own words. */
export const donationUnavailableLine = "This form isn't available.";

const SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/** The distance at which a lazy frame starts loading. */
const NEAR_VIEWPORT_MARGIN = "1250px";

// Hidden, not removed: a later height brings the frame back, and a lazy frame
// under display: none would never load.
const hiddenFrameStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: 1,
  border: 0,
  opacity: 0,
  pointerEvents: "none",
};

type FrameStatus = "loading" | "ready" | "failed";

export const DonationFrame = forwardRef<
  ElementRef<"div">,
  ComponentProps<"div">
>(({ children: _children, ...props }, ref) => {
  const settings = useContext(DonationFormContext);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRef(ref, wrapperRef);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState<string>();
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [height, setHeight] = useState(GIVE_PLACEHOLDER_HEIGHT);

  const renderer = settings?.renderer;
  const platformOrigin = settings?.platformOrigin;
  const organizationId = settings?.organizationId;
  const target = parseGiveTarget(settings?.target);
  const originOk = isPlatformOrigin(platformOrigin);
  const orgOk = isOrgId(organizationId);
  const valid =
    settings !== undefined && originOk && orgOk && target !== undefined;
  const preview = isBuilderRender(renderer);
  const unavailable =
    renderer === "canvas" && settings?.state === "unavailable";
  const afterGift = settings?.afterGift;
  const afterGiftPage = settings?.afterGiftPage;

  // The address, built in the browser: the page's origin, path and share
  // code, and the site's theme where the frame sits.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (
      valid === false ||
      wrapper === null ||
      platformOrigin === undefined ||
      organizationId === undefined ||
      target === undefined
    ) {
      setSrc(undefined);
      return;
    }
    setSrc(
      buildGiveSrc({
        platformOrigin,
        organizationId,
        target,
        page: {
          origin: window.location.origin,
          pathname: window.location.pathname,
        },
        shareCode: readPageShareCode(),
        preview,
        unavailable,
        theme: encodeSiteTheme(readSiteTheme(wrapper)),
      })
    );
    setStatus("loading");
  }, [valid, platformOrigin, organizationId, target, preview, unavailable]);

  // The address without its fragment keys the frame: a new address mounts a
  // new frame and restarts the clock.
  const frameKey = src?.split("#")[0];

  // The clock (F-D11): it starts when the frame loads or first comes near the
  // viewport, whichever is first, since a lazy frame below the fold has not
  // started loading; or at mount where IntersectionObserver is missing.
  useEffect(() => {
    if (frameKey === undefined) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (timer !== undefined) {
        return;
      }
      timer = setTimeout(() => {
        setStatus((current) => (current === "ready" ? current : "failed"));
      }, GIVE_FRAME_TIMEOUT_MS);
    };
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", start);
    let observer: IntersectionObserver | undefined;
    const wrapper = wrapperRef.current;
    if (typeof IntersectionObserver !== "function" || wrapper === null) {
      start();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            start();
          }
        },
        { rootMargin: NEAR_VIEWPORT_MARGIN }
      );
      observer.observe(wrapper);
    }
    return () => {
      clearTimeout(timer);
      iframe?.removeEventListener("load", start);
      observer?.disconnect();
    };
  }, [frameKey]);

  // The frame's messages, from the platform origin and this frame's window
  // only. A height shows the frame, even after the clock ran out.
  useEffect(() => {
    if (frameKey === undefined || platformOrigin === undefined) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const message = readGiveMessage(event, {
        platformOrigin,
        frame: iframeRef.current?.contentWindow ?? null,
      });
      if (message === undefined) {
        return;
      }
      if (message.type === "height") {
        setHeight(message.height);
        setStatus("ready");
        return;
      }
      if (afterGift !== "page" || isBuilderRender(renderer)) {
        return;
      }
      const next = afterGiftTarget(afterGiftPage);
      if (next !== undefined) {
        navigateTo(next);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameKey, platformOrigin, afterGift, afterGiftPage, renderer]);

  const problems: string[] = [];
  if (settings !== undefined && (originOk === false || orgOk === false)) {
    problems.push("Re-insert this block.");
  } else if (settings !== undefined && target === undefined) {
    problems.push("Pick what this form gives to.");
  }
  const failed = valid && src !== undefined && status === "failed";
  if (failed) {
    problems.push("Form didn't load");
  }

  return (
    <div
      {...props}
      ref={mergedRef}
      data-donation-frame={
        valid === false
          ? "unavailable"
          : src === undefined
            ? "placeholder"
            : status
      }
    >
      <CanvasCheck title="Donation form" problems={problems} />
      {valid && src === undefined && (
        <div style={{ height: GIVE_PLACEHOLDER_HEIGHT }} />
      )}
      {valid && src !== undefined && (
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={src}
          title="Donation form"
          loading="lazy"
          allow="payment"
          sandbox={SANDBOX}
          referrerPolicy="strict-origin-when-cross-origin"
          aria-hidden={failed ? true : undefined}
          style={
            failed
              ? hiddenFrameStyle
              : { display: "block", width: "100%", border: 0, height }
          }
        />
      )}
      {(valid === false || failed) && <p>{donationUnavailableLine}</p>}
    </div>
  );
});

DonationFrame.displayName = "DonationFrame";
