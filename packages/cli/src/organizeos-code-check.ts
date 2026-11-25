import type { PublishedProjectBundle } from "@webstudio-is/protocol";
import type { Pages } from "@webstudio-is/sdk";
import {
  checkCustomCodeNames,
  findCodeCheckFailure,
  pagesToCheck,
  type CodeCheckFailure,
} from "@organizeos/site-components/org-script";

/**
 * OrganizeOS fork: input validation for expressions and generated names
 * before publishing (`code-check.ts` in @organizeos/site-components). Every
 * expression, action, resource field, generated name and instance tag the
 * build holds is checked, and the first that fails stops the build, naming
 * the page or instance and the field. It runs whatever orgScriptMayRun()
 * says, and never changes the build.
 */
export const describeCodeCheckFailure = ({
  place,
  field,
  reason,
}: CodeCheckFailure) => {
  const where =
    place.type === "page"
      ? `page "${place.path === "" ? "/" : (place.path ?? place.id)}"`
      : `${place.type} "${place.id}"`;
  return `The ${field} of ${where} cannot be published: ${reason}.`;
};

export const assertBuildCodeValid = (
  build: PublishedProjectBundle["build"],
  pages: Pages
) => {
  const failure = findCodeCheckFailure({
    pages: pagesToCheck(pages),
    instances: build.instances.map(([, instance]) => instance),
    props: build.props.map(([, prop]) => prop),
    resources: (build.resources ?? []).map(([, resource]) => resource),
    dataSources: build.dataSources.map(([, dataSource]) => dataSource),
  });
  if (failure !== undefined) {
    throw new Error(describeCodeCheckFailure(failure));
  }
};

/**
 * OrganizeOS fork: custom code is compiled into the home page's module by
 * upstream's htmlToJsx, which writes tag and attribute names as code
 * (custom-code-names.ts in @organizeos/site-components). Prebuild runs this on
 * the exact string it is about to compile, and a refusal stops the build
 * before anything is written.
 */
export const assertCustomCodeNamesValid = (code: string): void => {
  const names = checkCustomCodeNames(code);
  if (names.ok === false) {
    throw new Error(
      `Custom code cannot be published: "${names.name}" is not a tag or attribute name a page can hold. Nothing was published.`
    );
  }
};
