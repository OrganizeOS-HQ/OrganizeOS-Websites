import type { Resource } from "@webstudio-is/sdk";
import {
  parseFundraisersData,
  type Fundraiser,
} from "@organizeos/site-components/fundraisers-data";
import type {
  OrganizeosRecordOption,
  RecordPicker,
} from "~/builder/features/settings-panel/controls/organizeos-record";
import {
  FUNDRAISERS_PRESET_KEY,
  findCatalogResources,
} from "~/shared/organizeos-preset-ids";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { $project, $resources } from "~/shared/sync/data-stores";
import { loadCatalogRequest } from "./collection-schema";
import { organizeosNamespace } from "./insert-organizeos-block";

/**
 * The Giving blocks in the builder (OrganizeOS builder donations spec
 * 2026-11-13, section 7; plan F1, F-D4, F-D15 and F-D16): their component
 * names, and the pure parts of their Settings rows. The Donation Form binds
 * no data, so its Give to row reads the Fundraisers catalog live
 * (loadFundraisers); Goal Progress's row is the shared record control over
 * its bound data (fundraisersPicker). Both list with fundraiserOptions, so
 * the two rows agree.
 */

export const donationFormComponent = `${organizeosNamespace}:DonationForm`;
export const goalProgressComponent = `${organizeosNamespace}:GoalProgress`;

export type GivingOption = OrganizeosRecordOption;

export const generalGivingOption: GivingOption = {
  value: "general",
  label: "General giving",
};

const notFoundLabel = "Fundraiser not found";

/** A campaign id as the platform reads it (lower-case uuid). */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The Give to options: General giving first when the block offers it, then
 * the fundraisers in the read's order, a draft marked "(draft)". The current
 * value is never dropped: one the loaded list lacks is kept second as
 * "Fundraiser not found" (`missing`); while nothing has loaded it is kept
 * unnamed, and nothing is missing yet. An empty value selects nothing.
 */
export const fundraiserOptions = (
  list: readonly Fundraiser[] | undefined,
  current: unknown,
  { general }: { general: boolean }
): { options: GivingOption[]; selected?: GivingOption; missing: boolean } => {
  const options: GivingOption[] = general ? [generalGivingOption] : [];
  for (const fundraiser of list ?? []) {
    options.push({
      value: fundraiser.id,
      label: fundraiser.draft
        ? `${fundraiser.title} (draft)`
        : fundraiser.title,
    });
  }
  const value = typeof current === "string" ? current.trim() : "";
  if (value === "") {
    return { options, missing: false };
  }
  const found = options.find((option) => option.value === value);
  if (found !== undefined) {
    return { options, selected: found, missing: false };
  }
  const kept: GivingOption = {
    value,
    label: list === undefined ? "Fundraiser" : notFoundLabel,
  };
  options.splice(general ? 1 : 0, 0, kept);
  return { options, selected: kept, missing: list !== undefined };
};

/** Goal Progress's record picker, over the Fundraisers body bound at its root. */
export const fundraisersPicker: RecordPicker = {
  loadFailed: "Fundraisers didn't load.",
  placeholder: "Pick a fundraiser",
  getOptions: (data, value) => {
    const list = parseFundraisersData(data);
    const { options, selected } = fundraiserOptions(list, value, {
      general: false,
    });
    return { options, selected, hasData: list !== undefined };
  },
};

const originOf = (url: string): string | undefined => {
  try {
    return new URL(url).origin;
  } catch {
    return;
  }
};

/**
 * The row's one warning line, or undefined. "Re-insert this block" for a
 * Donation Form whose org or platform origin is not this site's (a copied or
 * templated project, F-D3), then "Fundraiser not found".
 */
export const givingWarning = ({
  component,
  organizationId,
  platformOrigin,
  missing,
  site,
}: {
  component: string;
  organizationId?: unknown;
  platformOrigin?: unknown;
  missing: boolean;
  site: OrganizeosSite | undefined;
}): string | undefined => {
  if (component === donationFormComponent && site !== undefined) {
    if (
      organizationId !== site.organizationId ||
      platformOrigin !== originOf(site.platformUrl)
    ) {
      return "Re-insert this block";
    }
  }
  if (missing) {
    return notFoundLabel;
  }
};

/**
 * Where Open in Fundraising goes: the Campaigns page for General giving, a
 * campaign's editor for a fundraiser. None while the site record has no
 * subdomain, or for a value that names neither.
 */
export const fundraisingHref = (
  site: OrganizeosSite | undefined,
  target: unknown
): string | undefined => {
  if (site?.subdomain === undefined) {
    return;
  }
  const base = originOf(site.platformUrl);
  if (base === undefined) {
    return;
  }
  const value = typeof target === "string" ? target.trim() : "";
  if (value === "general") {
    return `${base}/${site.subdomain}/fundraisers`;
  }
  if (ID_RE.test(value)) {
    return `${base}/${site.subdomain}/fundraisers/${value}/edit`;
  }
};

/** How long the Give to row waits for the catalog. */
export const fundraisersLoadTimeout = 3000;

const evaluateLiteral = (expression: string) => {
  try {
    const value: unknown = JSON.parse(expression);
    return typeof value === "string" ? value : undefined;
  } catch {
    return;
  }
};

const catalogOf = (resource: Resource) => {
  const url = evaluateLiteral(resource.url);
  const authorization = resource.headers.find(
    (header) => header.name.toLowerCase() === "authorization"
  )?.value;
  if (url === undefined || authorization === undefined) {
    return;
  }
  const apiBase = url.replace(/\/fundraisers(?:\?.*)?$/, "");
  return { url, catalog: { resource, apiBase, authorization } };
};

/**
 * The org's fundraisers, drafts included on the canvas (the loader mints the
 * preview header for this path, F-D18), read live through the builder's
 * resources loader with the Fundraisers catalog Resource's Authorization.
 * Undefined when the project has no such Resource, or the read fails or
 * takes longer than fundraisersLoadTimeout.
 */
export const loadFundraisers = async (): Promise<Fundraiser[] | undefined> => {
  const project = $project.get();
  if (project === undefined) {
    return;
  }
  const entry = (
    await findCatalogResources(project.id, $resources.get().values())
  ).find((item) => item.key === FUNDRAISERS_PRESET_KEY);
  const found = entry === undefined ? undefined : catalogOf(entry.resource);
  if (found === undefined) {
    return;
  }
  const controller = new AbortController();
  let timer: undefined | ReturnType<typeof setTimeout>;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, fundraisersLoadTimeout);
  });
  try {
    const loaded = await Promise.race([
      loadCatalogRequest(found.catalog, {
        url: found.url,
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (loaded?.ok !== true) {
      return;
    }
    return parseFundraisersData(loaded.data);
  } finally {
    clearTimeout(timer);
  }
};
