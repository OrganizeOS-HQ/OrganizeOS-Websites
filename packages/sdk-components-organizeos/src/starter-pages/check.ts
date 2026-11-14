import {
  LOOK_FIELDS,
  bodyOf,
  checkMediaQueries,
  checkPageRules,
  componentName,
  describeInstance,
  describePropOwner,
  findPagePathProblem,
  findPageTextProblems,
  pageName,
} from "../site-templates/check";
import { findPageAssetIds, type RenderedPage } from "../site-templates/render";
import type { CompleteKitStyle } from "../site-templates/types";
import { NEUTRAL_LOOK } from "./look";
import { renderStarterPage } from "./render";
import type { StarterPage } from "./types";

// The rules a page template is held to (OrganizeOS design
// 2026-11-13-builder-templates-screen-and-page-templates-design.md, section
// 6.3): the per-page rules every site template's page meets (one h1, labelled
// sections, the project's breakpoints, canonical colours and fonts, band
// resets, blocks through placeBlock, one events block per section, the deny
// list, no Resources), and its own, because adding it copies the site's nav,
// footer and body styles and uploads nothing.

const isNavOrFooter = (label: string) =>
  ["Nav", "Footer"].some(
    (name) => label === name || label.startsWith(`${name}:`)
  );

const checkLookFields = (look: CompleteKitStyle): string[] =>
  LOOK_FIELDS.flatMap((field) =>
    look[field] === undefined ? [`Look: ${field} is not set`] : []
  );

const checkEntry = (page: StarterPage): string[] => {
  const name = pageName(page.id);
  const pathProblem =
    page.path === ""
      ? `${name}: the default path is empty`
      : findPagePathProblem(page.id, page.path);
  return [
    ...(pathProblem === undefined ? [] : [pathProblem]),
    ...(Object.hasOwn(page.images, page.picture)
      ? []
      : [`${name}: the picture "${page.picture}" is not in its images`]),
    ...(Object.keys(page.images).some((file) => file !== page.picture)
      ? [`${name}: images holds more than the picture`]
      : []),
    ...findPageTextProblems({
      key: page.id,
      title: page.title,
      description: page.description,
    }),
  ];
};

const checkRendered = (page: StarterPage, rendered: RenderedPage): string[] => {
  const name = pageName(page.id);
  const { fragment } = rendered;
  const body = bodyOf(fragment);
  const instances = new Map(
    fragment.instances.map((instance) => [instance.id, instance])
  );
  const sections = (body?.children ?? []).flatMap((child) => {
    const instance =
      child.type === "id" ? instances.get(child.value) : undefined;
    return instance === undefined ? [] : [instance];
  });
  const placed = new Set(rendered.placements.map(({ key }) => key));
  const named = new Set(page.blocks);
  const bodyStyled =
    body !== undefined &&
    fragment.styleSourceSelections.some(
      (selection) =>
        selection.instanceId === body.id && selection.values.length > 0
    );
  return [
    ...sections.flatMap((section) =>
      section.label !== undefined && isNavOrFooter(section.label)
        ? [
            `${name}: ${describeInstance(section)} in the body; a page template has no nav or footer`,
          ]
        : []
    ),
    ...fragment.props.flatMap((prop) =>
      prop.type === "page"
        ? [
            `${name}: the "${prop.name}" of ${describePropOwner(fragment, prop.instanceId)} links to a page; a page template links only to platform paths`,
          ]
        : []
    ),
    ...(bodyStyled
      ? [
          `${name}: the body carries a style; adding the page gives it the site's`,
        ]
      : []),
    ...[...placed]
      .filter((key) => named.has(key) === false)
      .map(
        (key) =>
          `${name} places ${componentName(key)}, which its blocks do not name`
      ),
    ...[...named]
      .filter((key) => placed.has(key) === false)
      .map(
        (key) =>
          `${name} names ${componentName(key)} in its blocks but does not place it`
      ),
    ...[...findPageAssetIds([rendered])].map(
      (id) => `${name}: holds the asset "${id}"; a page template holds none`
    ),
  ];
};

/**
 * Every rule `page` breaks, under each of `looks` (NEUTRAL_LOOK alone by
 * default; the catalog test passes every site template's too), one line
 * each, once however many looks break it. An empty list passes.
 */
export const checkStarterPage = (
  page: StarterPage,
  looks: readonly CompleteKitStyle[] = [NEUTRAL_LOOK]
): string[] => {
  const violations = new Set<string>([
    ...looks.flatMap(checkLookFields),
    ...checkEntry(page),
  ]);
  for (const look of looks) {
    const mediaQueryViolations: string[] = [];
    let rendered: RenderedPage;
    try {
      rendered = renderStarterPage(page, {
        look,
        generatePageId: () => `page:${page.id}`,
        inspectBody: (body, placements) => {
          mediaQueryViolations.push(
            ...checkMediaQueries({ key: page.id }, body, placements)
          );
        },
      });
    } catch (error) {
      violations.add(error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const line of [
      ...mediaQueryViolations,
      ...checkPageRules(rendered),
      ...checkRendered(page, rendered),
    ]) {
      violations.add(line);
    }
  }
  return [...violations];
};
