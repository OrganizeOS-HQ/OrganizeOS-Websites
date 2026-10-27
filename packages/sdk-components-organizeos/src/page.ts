/**
 * What a published page mounts once, from the CLI's html route template,
 * beside the blocks: the page's share-code carrier. A build entry of its own
 * (vite.build.config.ts), which the CLI copies into every site with
 * components.js (packages/cli/src/organizeos-components.ts). It is not
 * exported from components.ts, so it has no meta and the builder never
 * registers or renders it.
 */
export { PageShareCodeCarrier } from "./share-code/page-share-code-carrier";
