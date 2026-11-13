// The site-template module: the format, renderer, check and catalog, grown
// by the tasks that add them. Imported only by the chooser and the apply
// routine, never by components.ts or metas.ts, so no published site carries
// a template. The builder imports ./canonical-variables directly, which
// keeps the catalog and its images out of its chunk. The spike in
// __fixtures__ is not exported: it is not in the catalog, and exporting it
// would bring its image into the catalog's chunk.

export * from "./canonical-variables";
export * from "./place-block";
export * from "./platform-paths";
export * from "./types";
export * from "./render";
export * from "./sections";
export * from "./check";
export * from "./catalog";
// beside the renderer that applies it; the builder's block insert imports it
// from "@organizeos/site-components/style-order", which keeps the catalog
// out of the canvas
export { localStylesFirst } from "../shared/style-order";
// components by registered name, for the builder's own templates and tests
// (0.309.0's template package has no $ of its own)
export { $, organizeos, radix } from "../shared/proxy";
