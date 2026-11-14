import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  InputField,
  Label as BaseLabel,
  SmallIconButton,
  Switch,
  Text,
  Tooltip,
  theme,
  useIsTruncated,
} from "@webstudio-is/design-system";
import { PlusIcon, XSmallIcon } from "@webstudio-is/icons";
import { $project } from "~/shared/sync/data-stores";
import type { FormsKind } from "~/builder/features/organizeos-panel/forms-api";
import {
  $doorForms,
  $formsAccess,
  $formsLists,
  $optInLocked,
  FORM_LISTS_LIMIT,
  FORM_NOTIFY_LIMIT,
  doorFormOf,
  formSettingsRowsOf,
  loadDoorForms,
  loadFormsAccess,
  loadFormsLists,
  parseNotifyAddress,
  saveFormSetting,
} from "~/builder/features/organizeos-panel/form-settings";
import { VerticalLayout } from "../shared";

/**
 * OrganizeOS fork: a Signup Form's Lists, Confirm by email and Notify, with
 * the site forms switch on (docs/ORGANIZEOS-FORK.md section 9, "Site forms";
 * builder forms spec 9). They are the form's own settings on the platform:
 * a change shows at once and is written to the form at once (F4), never into
 * the build or its undo. Lists and Notify are read-only without
 * `canEditPrivate`. `part` picks the rows drawn under Fields (Lists, Confirm
 * by email) or under After submit (Notify).
 */

const ChipLabel = ({ children }: { children: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const truncated = useIsTruncated(ref, children);
  const text = (
    <span
      ref={ref}
      style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
    >
      {children}
    </span>
  );
  return truncated ? <Tooltip content={children}>{text}</Tooltip> : text;
};

const ValueChip = ({
  label,
  onRemove,
}: {
  label: string;
  /** Absent when read-only. */
  onRemove?: () => void;
}) => (
  <Chip
    data-form-setting-chip={label}
    css={{ gap: theme.spacing[1], justifyContent: "start" }}
  >
    <ChipLabel>{label}</ChipLabel>
    {onRemove !== undefined && (
      <Tooltip content="Remove">
        <SmallIconButton
          aria-label={`Remove ${label}`}
          icon={<XSmallIcon />}
          css={{ color: "inherit", flexShrink: 0 }}
          onClick={onRemove}
        />
      </Tooltip>
    )}
  </Chip>
);

const Chips = ({ children }: { children: React.ReactNode }) => (
  <Flex wrap="wrap" css={{ gap: theme.spacing[2], minWidth: 0 }}>
    {children}
  </Flex>
);

const None = () => (
  <Text color="subtle" data-form-setting-none>
    None
  </Text>
);

export const FormSettingsRows = ({
  part,
  kind,
  record,
}: {
  part: "fields" | "after-submit";
  kind: FormsKind;
  /** The block's form id (`record`). */
  record: unknown;
}) => {
  const id = useId();
  const project = useStore($project);
  const doorForms = useStore($doorForms);
  const access = useStore($formsAccess);
  const allLists = useStore($formsLists);
  const optInLocked = useStore($optInLocked);
  const [address, setAddress] = useState("");
  const [invalid, setInvalid] = useState(false);
  const formId = typeof record === "string" ? record.trim() : "";
  const projectId = project?.id;
  const form =
    projectId === undefined || formId === ""
      ? undefined
      : doorFormOf(doorForms, projectId, kind, formId);
  const entry =
    projectId === undefined
      ? undefined
      : doorForms.get(`${projectId}:${kind}`)?.status;

  useEffect(() => {
    if (projectId === undefined) {
      return;
    }
    void loadDoorForms(projectId, kind);
    void loadFormsAccess(projectId);
    void loadFormsLists(projectId, kind);
  }, [projectId, kind]);

  // a form made since F2 was read (New form's): read it again once
  const missing = entry === "ready" && formId !== "" && form === undefined;
  const reloaded = useRef(new Set<string>());
  useEffect(() => {
    if (projectId === undefined || missing === false) {
      return;
    }
    if (reloaded.current.has(formId)) {
      return;
    }
    reloaded.current.add(formId);
    void loadDoorForms(projectId, kind, { reload: true });
  }, [projectId, kind, formId, missing]);

  if (projectId === undefined || form === undefined) {
    return null;
  }
  const rows = formSettingsRowsOf(kind);
  const canEdit = access.get(projectId)?.canEditPrivate === true;
  const save = (change: Parameters<typeof saveFormSetting>[3]) => {
    void saveFormSetting(projectId, kind, form.id, change);
  };

  if (part === "fields") {
    const lists = form.lists ?? [];
    const orgLists = allLists.get(`${projectId}:${kind}`) ?? [];
    const nameOf = (listId: string) =>
      orgLists.find((list) => list.id === listId)?.name ?? listId;
    const addable = orgLists.filter(
      (list) => lists.includes(list.id) === false
    );
    const canAdd =
      canEdit && lists.length < FORM_LISTS_LIMIT && addable.length > 0;
    return (
      <>
        {rows.lists && (
          <VerticalLayout label={<BaseLabel>Lists</BaseLabel>}>
            <Chips>
              {lists.map((listId) => (
                <ValueChip
                  key={listId}
                  label={nameOf(listId)}
                  onRemove={
                    canEdit
                      ? () =>
                          save({
                            lists: lists.filter((item) => item !== listId),
                          })
                      : undefined
                  }
                />
              ))}
              {canEdit ? (
                <DropdownMenu>
                  <Tooltip content="Add list">
                    <DropdownMenuTrigger asChild disabled={canAdd === false}>
                      <SmallIconButton
                        aria-label="Add list"
                        icon={<PlusIcon />}
                      />
                    </DropdownMenuTrigger>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    {addable.map((list) => (
                      <DropdownMenuItem
                        key={list.id}
                        onSelect={() => save({ lists: [...lists, list.id] })}
                      >
                        {list.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                lists.length === 0 && <None />
              )}
            </Chips>
          </VerticalLayout>
        )}
        {rows.confirm && (
          <Flex
            align="center"
            justify="between"
            css={{ gap: theme.spacing[3], py: theme.spacing[2] }}
          >
            <BaseLabel htmlFor={`${id}:confirm`}>Confirm by email</BaseLabel>
            <Switch
              id={`${id}:confirm`}
              checked={form.opt_in === "double"}
              disabled={optInLocked.has(form.id)}
              onCheckedChange={(checked) =>
                save({ optIn: checked ? "double" : "single" })
              }
            />
          </Flex>
        )}
      </>
    );
  }

  if (rows.notify === false) {
    return null;
  }
  const notify = form.notify ?? [];
  const full = notify.length >= FORM_NOTIFY_LIMIT;
  const add = () => {
    const parsed = parseNotifyAddress(address);
    const known = notify.some(
      (item) => item.toLowerCase() === parsed?.toLowerCase()
    );
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    setAddress("");
    setInvalid(false);
    if (known === false) {
      save({ notify: [...notify, parsed] });
    }
  };
  return (
    <VerticalLayout
      label={<BaseLabel htmlFor={`${id}:notify`}>Notify</BaseLabel>}
    >
      <Flex direction="column" css={{ gap: theme.spacing[3], minWidth: 0 }}>
        <Chips>
          {notify.map((item) => (
            <ValueChip
              key={item}
              label={item}
              onRemove={
                canEdit
                  ? () =>
                      save({ notify: notify.filter((other) => other !== item) })
                  : undefined
              }
            />
          ))}
          {canEdit === false && notify.length === 0 && <None />}
        </Chips>
        {canEdit && (
          <InputField
            id={`${id}:notify`}
            type="email"
            placeholder="Add email"
            aria-label="Add email"
            disabled={full}
            color={invalid ? "error" : undefined}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        )}
      </Flex>
    </VerticalLayout>
  );
};
