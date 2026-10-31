// The site-template module: the format, renderer, check and catalog, grown
// by the tasks that add them. Imported only by the chooser and the apply
// routine, never by components.ts, metas.ts or hooks.ts, so no published
// site carries a template. The Style panel imports ./canonical-variables
// directly, which keeps the catalog and its images out of its chunk. The spike
// in __fixtures__ is not exported: it is not in the catalog, and exporting it
// would bring its image into the catalog's chunk.

export * from "./canonical-variables";
export * from "./place-block";
export * from "./platform-paths";
export * from "./types";
export * from "./render";
export * from "./sections";
export * from "./check";
export * from "./catalog";
