// OrganizeOS fork: runs before each browser test file; see
// keepRequestInterception in vitest.config.ts.
import { commands } from "@vitest/browser/context";

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    keepRequestInterception: () => Promise<void>;
  }
}

await commands.keepRequestInterception();
