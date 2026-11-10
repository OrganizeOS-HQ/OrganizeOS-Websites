/**
 * The column's Fields tab (slice 3): the open collection's fields in schema
 * order, each with its kind's icon, its name and its kind, the title field
 * marked; dragged, or moved with Alt+Arrow, to reorder. "Add field" is a
 * menu of kinds, names with icons, grouped as the classic menu is.
 */
import type { KeyboardEvent, ReactNode } from "react";
import {
  Chip,
  css,
  cssVar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Flex,
  IconButton,
  InsetList,
  InsetListItem,
  List,
  ListItem,
  ScrollAreaNative,
  Separator,
  Text,
  theme,
  Tooltip,
  useSortable,
} from "@webstudio-is/design-system";
import {
  CalendarIcon,
  DragHandleIcon,
  ContentBlockIcon,
  EmailIcon,
  FormTextAreaIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  ResourceIcon,
  LockIcon,
  PaintBrushIcon,
  PhoneIcon,
  PlusIcon,
  SelectIcon,
  SliderIcon,
  SwitchIcon,
  TextIcon,
} from "@webstudio-is/icons";
import { planBadgeLabel } from "~/shared/branding";
import type { CmsFieldKind } from "./cms-source";
import {
  FIELDS_HARD_MAX,
  FIELD_KIND_GROUPS,
  FIELD_KIND_LABELS,
} from "./cms-structure-logic";
import type { CmsStructureField } from "./cms-structure-source";
import { TruncatedText } from "./truncated-text";

const kindIcons: Record<CmsFieldKind, (props: { size?: number }) => ReactNode> =
  {
    text: TextIcon,
    textarea: FormTextAreaIcon,
    richtext: ContentBlockIcon,
    image: ImageIcon,
    link: LinkIcon,
    email: EmailIcon,
    phone: PhoneIcon,
    number: SliderIcon,
    date: CalendarIcon,
    datetime: CalendarIcon,
    switch: SwitchIcon,
    color: PaintBrushIcon,
    option: SelectIcon,
    reference: ResourceIcon,
    // drawn with fills, not strokes
    multireference: (props) => <ListIcon fill="currentColor" {...props} />,
  };

export const FieldKindIcon = ({ kind }: { kind: CmsFieldKind }) => {
  const Icon = kindIcons[kind] ?? TextIcon;
  return <Icon size={16} />;
};

/** A kind's icon and name, for the menu and the kind select. */
export const FieldKindLabel = ({ kind }: { kind: CmsFieldKind }) => (
  <Flex align="center" gap="2">
    <FieldKindIcon kind={kind} />
    {FIELD_KIND_LABELS[kind]}
  </Flex>
);

/** Quiet, as the Archived chip: no fill, a 1 px inset border. */
const outlineChipCss = {
  backgroundColor: "transparent",
  color: cssVar("--foreground-secondary"),
  boxShadow: `inset 0 0 0 1px ${cssVar("--border-default")}`,
};

const rowStyle = css({
  display: "grid",
  "&[data-dragging]": { opacity: 0.5 },
  // the grip takes the kind icon's place while a row can move
  "& [data-grip]": { display: "none" },
  "&[data-movable]:hover [data-grip], &[data-movable]:focus-within [data-grip]":
    { display: "flex" },
  "&[data-movable]:hover [data-kind-icon], &[data-movable]:focus-within [data-kind-icon]":
    { display: "none" },
});

const iconSlotStyle = css({
  display: "flex",
  color: "currentColor",
  opacity: 0.7,
});

/** The menu of kinds; disabled at the plan's cap. */
export const AddFieldMenu = ({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (kind: CmsFieldKind) => void;
}) => (
  <DropdownMenu modal={false}>
    <Tooltip content="Add field" side="bottom">
      <DropdownMenuTrigger asChild disabled={disabled}>
        <IconButton aria-label="Add field" disabled={disabled}>
          <PlusIcon />
        </IconButton>
      </DropdownMenuTrigger>
    </Tooltip>
    <DropdownMenuContent align="end" css={{ minWidth: theme.spacing[28] }}>
      {FIELD_KIND_GROUPS.map((group, index) => (
        <DropdownMenuGroup key={group.label}>
          {index > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
          {group.kinds.map((kind) => (
            <DropdownMenuItem
              key={kind}
              data-kind={kind}
              icon={<FieldKindIcon kind={kind} />}
              onSelect={() => onAdd(kind)}
            >
              {FIELD_KIND_LABELS[kind]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const FieldRow = ({
  index,
  field,
  isCurrent,
  isDragging,
  isMovable,
  onSelect,
  onMove,
}: {
  index: number;
  field: CmsStructureField;
  isCurrent: boolean;
  isDragging: boolean;
  isMovable: boolean;
  onSelect: () => void;
  onMove: (offset: -1 | 1) => void;
}) => (
  <div
    role="listitem"
    data-id={field.key}
    data-cms-field-row={field.key}
    data-dragging={isDragging || undefined}
    data-movable={isMovable || undefined}
    className={rowStyle()}
  >
    <ListItem
      asChild
      role={undefined}
      index={index}
      current={isCurrent}
      onSelect={onSelect}
      onKeyDown={(event: KeyboardEvent) => {
        if (
          event.altKey &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          onMove(event.key === "ArrowUp" ? -1 : 1);
        }
      }}
    >
      <InsetListItem
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        css={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          gap: theme.spacing[3],
        }}
      >
        <span className={iconSlotStyle()} data-kind-icon>
          <FieldKindIcon kind={field.kind} />
        </span>
        <span className={iconSlotStyle()} data-grip aria-hidden>
          <DragHandleIcon size={16} />
        </span>
        <TruncatedText variant="labels">
          {`${field.label}${field.required ? " *" : ""}`}
        </TruncatedText>
        <Flex align="center" gap="1" css={{ flexShrink: 0 }}>
          {field.locked && (
            <Tooltip content="From the template">
              <span className={iconSlotStyle()} aria-label="From the template">
                <LockIcon size={12} />
              </span>
            </Tooltip>
          )}
          {field.isTitle ? (
            <Chip css={outlineChipCss}>Title</Chip>
          ) : (
            <Text color="subtle">{FIELD_KIND_LABELS[field.kind]}</Text>
          )}
        </Flex>
      </InsetListItem>
    </ListItem>
  </div>
);

export const FieldsList = ({
  fields,
  currentKey,
  cap,
  canManage,
  onSelect,
  onReorder,
}: {
  fields: CmsStructureField[];
  /** The field open in the sheet. */
  currentKey: string | undefined;
  cap: number;
  canManage: boolean;
  onSelect: (key: string) => void;
  /** The key, and where it goes. */
  onReorder: (key: string, toIndex: number) => void;
}) => {
  const items = fields.map((field) => ({ id: field.key }));
  const { dragItemId, placementIndicator, sortableRefCallback } = useSortable({
    items,
    onSort: (newIndex, oldIndex) => {
      if (canManage) {
        onReorder(fields[oldIndex].key, newIndex);
      }
    },
  });
  return (
    <Flex direction="column" css={{ minHeight: 0, height: "100%" }}>
      <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <List asChild>
          <InsetList
            ref={canManage ? sortableRefCallback : undefined}
            role="list"
            aria-label="Fields"
            css={{ gap: theme.spacing[1] }}
          >
            {fields.map((field, index) => (
              <FieldRow
                key={field.key}
                index={index}
                field={field}
                isCurrent={field.key === currentKey}
                isDragging={dragItemId === field.key}
                isMovable={canManage && fields.length > 1}
                onSelect={() => onSelect(field.key)}
                onMove={(offset) => {
                  if (canManage) {
                    onReorder(field.key, index + offset);
                  }
                }}
              />
            ))}
          </InsetList>
        </List>
      </ScrollAreaNative>
      {placementIndicator}
      {fields.length >= cap && (
        <>
          <Separator />
          <Flex
            align="center"
            justify="between"
            gap="2"
            data-cms-field-cap
            css={{
              flexShrink: 0,
              paddingInline: theme.spacing[7],
              paddingBlock: theme.spacing[5],
            }}
          >
            <Text color="subtle">{`${fields.length} of ${cap} fields`}</Text>
            {/* the plan chip only where a higher plan allows more */}
            {cap < FIELDS_HARD_MAX && <Chip>{planBadgeLabel}</Chip>}
          </Flex>
        </>
      )}
    </Flex>
  );
};
