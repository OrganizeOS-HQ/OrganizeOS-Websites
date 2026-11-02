import type { WsComponentMeta } from "@webstudio-is/sdk";
import * as baseMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";

export const baseComponentImportSource =
  "@webstudio-is/sdk-components-react/components";
export const radixComponentNamespace =
  "@webstudio-is/sdk-components-react-radix";

export type ComponentMetaLibrary = {
  namespace?: string;
  importSource: string;
  metas: Record<string, WsComponentMeta>;
};

// OrganizeOS fork: no animation library. Upstream's animation package is
// EULA-proprietary and removed from the fork (docs/ORGANIZEOS-FORK.md section 2).
export const componentMetaLibraries: readonly ComponentMetaLibrary[] = [
  {
    importSource: baseComponentImportSource,
    metas: baseMetas,
  },
  {
    namespace: radixComponentNamespace,
    importSource: radixComponentNamespace,
    metas: radixMetas,
  },
];

export const getComponentName = (
  library: Pick<ComponentMetaLibrary, "namespace">,
  exportName: string
) =>
  library.namespace === undefined
    ? exportName
    : `${library.namespace}:${exportName}`;
