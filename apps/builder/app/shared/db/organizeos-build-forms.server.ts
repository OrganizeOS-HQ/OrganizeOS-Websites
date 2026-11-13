import type {
  Instance,
  Instances,
  Pages,
  Prop,
  Props,
} from "@webstudio-is/sdk";
import { migratePages } from "@webstudio-is/project-migrations";

/**
 * OrganizeOS fork: the one read of a build's instances, props and pages, for
 * the publish step (services/organizeos-publish-route.server.ts) and the
 * publisher's refusal of an older tab's publish
 * (services/organizeos-publisher.server.ts), so both see a build alike (plan
 * 2026-11-13-builder-forms-fork-p2, Task 2). Pages are read through
 * `migratePages`, which takes every stored shape. Undefined when the row
 * cannot be read or parsed; never throws.
 */

export type BuildFormsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type BuildForms = { instances: Instances; props: Props; pages: Pages };

type BuildRow = { instances?: unknown; props?: unknown; pages?: unknown };

const byId = <Item extends { id: string }>(
  list: unknown
): Map<string, Item> => {
  if (Array.isArray(list) === false) {
    throw new Error("not a list");
  }
  return new Map((list as Item[]).map((item) => [item.id, item]));
};

export const loadBuildForms = async (
  client: BuildFormsClient,
  buildId: string
): Promise<BuildForms | undefined> => {
  let row: BuildRow;
  try {
    const read = await client
      .from("Build")
      .select("instances, props, pages")
      .eq("id", buildId)
      .single();
    if (read.error || read.data === null || typeof read.data !== "object") {
      return;
    }
    row = read.data as BuildRow;
  } catch {
    return;
  }
  try {
    if (
      typeof row.instances !== "string" ||
      typeof row.props !== "string" ||
      typeof row.pages !== "string"
    ) {
      return;
    }
    return {
      instances: byId<Instance>(JSON.parse(row.instances)),
      props: byId<Prop>(JSON.parse(row.props)),
      pages: migratePages(JSON.parse(row.pages)),
    };
  } catch {
    return;
  }
};
