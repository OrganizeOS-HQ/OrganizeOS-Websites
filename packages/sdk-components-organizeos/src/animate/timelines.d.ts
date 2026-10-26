// Scroll-driven animation types the DOM lib does not have yet. The classes
// themselves are upstream's declarations (@types/scroll-timeline.d.ts, which
// the package's tsconfig includes); this adds what the player also needs,
// and makes them reachable from builds that do not include that folder.
/// <reference path="../../../../@types/scroll-timeline.d.ts" />

interface KeyframeAnimationOptions {
  rangeStart?: string;
  rangeEnd?: string;
}

interface Window {
  ScrollTimeline?: typeof ScrollTimeline;
  ViewTimeline?: typeof ViewTimeline;
}
