import { type ReactNode, useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Flex,
  Label as BaseLabel,
  SmallIconButton,
  SmallToggleButton,
  Text,
  Tooltip,
  theme,
  useIsTruncated,
  useSortable,
} from "@webstudio-is/design-system";
import {
  DragHandleIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
} from "@webstudio-is/icons";
import { $instances, $project, $props } from "~/shared/sync/data-stores";
import {
  $formsAccess,
  $formsCatalogs,
  loadFormsAccess,
  loadFormsCatalog,
} from "~/builder/features/organizeos-panel/form-settings";
import { removeSignupField } from "~/builder/features/organizeos-panel/signup-fields";
import {
  addCatalogField,
  catalogAddOptions,
  formKindOf,
  moveSiteField,
  setSiteFieldRequired,
  siteFieldRows,
} from "~/builder/features/organizeos-panel/site-forms";
import { VerticalLayout } from "../shared";
import { $selectedInstanceDataProp } from "./organizeos-record";

/**
 * OrganizeOS fork: the Fields list of a block marked as a site form
 * (docs/ORGANIZEOS-FORK.md section 9, "Site forms"; builder forms spec 9).
 * One row per key under the root, in tree order: a drag handle, the label,
 * a required toggle and a remove; a locked row (the catalog's, Email always)
 * shows a lock, no remove, and its toggle pressed and disabled. Add (+) lists
 * the catalog's fields the root lacks, standard first, then Custom. Each
 * change is one build transaction and one undo; the fields reach the live
 * form with the next publish.
 */

const RowLabel = ({ children }: { children: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const truncated = useIsTruncated(ref, children);
  const text = (
    <Text ref={ref} truncate css={{ flexGrow: 1, minWidth: 0 }}>
      {children}
    </Text>
  );
  return truncated ? <Tooltip content={children}>{text}</Tooltip> : text;
};

export const SiteFieldsControl = ({
  rootId,
  warning,
}: {
  rootId: string;
  /** The Fields row's warning line, drawn under the list. */
  warning?: ReactNode;
}) => {
  useStore($instances);
  useStore($props);
  const project = useStore($project);
  const data = useStore($selectedInstanceDataProp);
  const kind = formKindOf(rootId, data);
  const projectId = project?.id;
  // F1 and F0, read once per project (and kind) and kept (form-settings.ts)
  const catalogs = useStore($formsCatalogs);
  const access = useStore($formsAccess);
  const catalog =
    projectId === undefined ? undefined : catalogs.get(`${projectId}:${kind}`);
  const smsAvailable =
    projectId !== undefined && access.get(projectId)?.smsAvailable === true;

  useEffect(() => {
    if (projectId === undefined) {
      return;
    }
    void loadFormsCatalog(projectId, kind);
    void loadFormsAccess(projectId);
  }, [projectId, kind]);

  // until F1 answers, the kind's own locks hold (Email, and Message on
  // Contact us)
  const rows = siteFieldRows(rootId, catalog, kind);
  const { sortableRefCallback, dragItemId, placementIndicator } = useSortable({
    items: rows.map((row) => ({ id: row.key })),
    onSort: (newIndex, oldIndex) => {
      const row = rows[oldIndex];
      if (row !== undefined) {
        void moveSiteField(rootId, row.key, newIndex);
      }
    },
  });
  const add =
    catalog === undefined
      ? undefined
      : catalogAddOptions(
          catalog,
          rows.map((row) => row.key),
          { smsAvailable }
        );
  const canAdd =
    add !== undefined &&
    add.full === false &&
    add.standard.length + add.custom.length > 0;

  return (
    <VerticalLayout label={<BaseLabel>Fields</BaseLabel>}>
      <Flex direction="column" css={{ gap: theme.spacing[3], minWidth: 0 }}>
        <Flex
          direction="column"
          ref={sortableRefCallback}
          css={{ gap: theme.spacing[2], minWidth: 0 }}
        >
          {rows.map((row) => (
            <Flex
              key={row.key}
              data-id={row.key}
              data-site-field={row.key}
              align="center"
              css={{
                gap: theme.spacing[2],
                minWidth: 0,
                opacity: dragItemId === row.key ? 0.5 : 1,
              }}
            >
              <DragHandleIcon aria-hidden />
              <RowLabel>{row.label}</RowLabel>
              <Tooltip content="Required">
                <SmallToggleButton
                  aria-label="Required"
                  pressed={row.required || row.locked}
                  disabled={row.locked}
                  onPressedChange={(pressed) => {
                    void setSiteFieldRequired(rootId, row.key, pressed);
                  }}
                  icon={<Text>*</Text>}
                />
              </Tooltip>
              {row.locked ? (
                <Tooltip content="Locked">
                  <span aria-label="Locked" role="img">
                    <LockIcon />
                  </span>
                </Tooltip>
              ) : (
                <Tooltip content="Remove">
                  <SmallIconButton
                    aria-label="Remove"
                    icon={<TrashIcon />}
                    onClick={() => {
                      void removeSignupField(rootId, row.key);
                    }}
                  />
                </Tooltip>
              )}
            </Flex>
          ))}
          {placementIndicator}
        </Flex>
        <DropdownMenu>
          <Tooltip content="Add field">
            <DropdownMenuTrigger asChild disabled={canAdd === false}>
              <SmallIconButton aria-label="Add field" icon={<PlusIcon />} />
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="start">
            {add?.standard.map((field) => (
              <DropdownMenuItem
                key={field.key}
                onSelect={() => {
                  void addCatalogField(rootId, field);
                }}
              >
                {field.label}
              </DropdownMenuItem>
            ))}
            {add !== undefined && add.custom.length > 0 && (
              <DropdownMenuLabel>Custom</DropdownMenuLabel>
            )}
            {add?.custom.map((field) => (
              <DropdownMenuItem
                key={field.key}
                onSelect={() => {
                  void addCatalogField(rootId, field);
                }}
              >
                {field.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {warning}
      </Flex>
    </VerticalLayout>
  );
};
