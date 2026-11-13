/**
 * The structure screens' state (OrganizeOS design
 * docs/superpowers/specs/2026-11-13-native-cms-slice-3-design.md, section
 * 4), for `CmsScreen`: the column's tab, the open field sheet or collection
 * settings, the open collection's structure (E21), the plan's caps and the
 * templates (E20), and the New collection and Delete dialogs. Without a
 * `CmsStructureSource` it adds nothing.
 *
 * Its reads follow the screen's rules: E20 and E21 read on open and again on
 * each reopen and refresh; a background read that fails changes nothing on
 * screen; a read made while a view holds unsaved values maps as a write.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  Flex,
  IconButton,
  Text,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { PlusIcon } from "@webstudio-is/icons";
import { getRefusal, getToastText, type CmsRefusal } from "./cms-logic";
import { $cmsNativeDirty } from "./cms-native-stores";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCollectionSummary,
  type CmsErrorCode,
  type CmsFieldKind,
} from "./cms-source";
import {
  getFieldCap,
  getStructureToastText,
  moveField,
} from "./cms-structure-logic";
import {
  CUSTOM_COLLECTION_TYPE,
  type CmsStructureCollection,
  type CmsStructureLimits,
  type CmsStructureSource,
  type CmsTemplate,
} from "./cms-structure-source";
import {
  CollectionSettings,
  DeleteCollectionDialog,
} from "./collection-settings";
import { FieldSheet, type FieldSheetTarget } from "./field-sheet";
import { AddFieldMenu, FieldsList } from "./fields-view";
import {
  NewCollectionDialog,
  NewCollectionPage,
  type CmsPendingCreate,
} from "./new-collection";
import { LineRow, RefusalLine, type CmsLineKind } from "./refusal-line";
import { StructureRowMenu } from "./structure-row-menu";

export type CmsStructureTab = "collections" | "fields";

export type CmsStructureView =
  | { type: "field"; target: FieldSheetTarget }
  | { type: "settings" };

/** Where a story opens: a tab, a view, a dialog. */
export type CmsStructureInitial = {
  tab?: CmsStructureTab;
  view?: CmsStructureView;
  dialog?: "new-collection" | "delete";
  /** The New collection dialog's preselected option. */
  newCollectionType?: string;
};

export type CmsStructureColumn = {
  tab: CmsStructureTab;
  onTabChange: (tab: CmsStructureTab) => void;
  /** Disabled with no collection open. */
  hasFields: boolean;
  /** The tab row's "+": New collection, or the Add field menu. */
  add: ReactNode;
  fields: ReactNode;
  /** The person can manage the CMS's settings: rows reserve their menu. */
  canManage: boolean;
};

/** What a structure write changed, for the screen's refetches (4.7). */
export type CmsStructureEffect =
  | { kind: "created"; collection: CmsCollectionSummary }
  | {
      kind: "settings";
      before: { slug: string; isPublic: boolean };
      after: { slug: string; isPublic: boolean };
    }
  | { kind: "schema"; slug: string; removed: string[] }
  | { kind: "deleted"; collectionId: string; slug: string };

/**
 * A read's failure, as the screen maps its own (4.3.4): while a view holds
 * unsaved values, `forbidden` and `plan` are a toast and the view stays.
 */
const mapStructureRead = (
  code: CmsErrorCode
): CmsRefusal | "toast" | undefined => {
  const refusal = getRefusal(code, $cmsNativeDirty.get() ? "write" : "load");
  if (refusal === undefined && getRefusal(code, "load") !== undefined) {
    toast.error(getToastText(code), { id: `cms-read-${code}` });
    return "toast";
  }
  return refusal;
};

/** A read whose foreground inputs are the last read's was asked by a reopen. */
const useIsBackground = () => {
  const last = useRef<{ source: CmsStructureSource; key: string } | undefined>(
    undefined
  );
  return useCallback((source: CmsStructureSource, key: string) => {
    const isBackground =
      last.current?.source === source && last.current.key === key;
    last.current = { source, key };
    return isBackground;
  }, []);
};

export const useCmsStructure = ({
  structure,
  access,
  collections,
  collectionId,
  opens,
  refresh,
  initial,
  guard,
  onDirtyChange,
  onWritten,
  onOpenCollection,
  refetchCollections,
  showLine: showScreenLine,
  clearLine: clearScreenLine,
  renderRowActions,
}: {
  structure: CmsStructureSource | undefined;
  access: CmsAccess | undefined;
  collections: CmsCollectionSummary[];
  collectionId: string | undefined;
  /** The screen's reopen count and `$cmsNativeRefresh`: E20 and E21 read again. */
  opens: number;
  refresh: number;
  initial?: CmsStructureInitial;
  /** The unsaved guard. */
  guard: (run: () => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After a structure write: the screen's refetches (4.7). */
  onWritten: (effect: CmsStructureEffect) => void;
  /** Opens a collection's items, past the guard. */
  onOpenCollection: (collectionId: string | undefined) => void;
  /** E1 again, in the background. */
  refetchCollections: () => void;
  /** The screen's line, under the cause "structure". */
  showLine: (kind: CmsLineKind) => void;
  clearLine: () => void;
  /** The collection actions, given the menu's own items; null without. */
  renderRowActions?: (
    collection: CmsCollectionSummary,
    items: { leading: ReactNode; trailing: ReactNode }
  ) => ReactNode;
}) => {
  const canManage = access?.canManageSettings === true;
  const isReady = structure !== undefined && access !== undefined;
  const [tab, setTab] = useState<CmsStructureTab>(
    initial?.tab ?? "collections"
  );
  const [view, setView] = useState<CmsStructureView | undefined>(initial?.view);
  const [session, setSession] = useState(0);
  const [detail, setDetail] = useState<CmsStructureCollection | undefined>();
  const [detailFailed, setDetailFailed] = useState<
    "unavailable" | "not_found" | undefined
  >(undefined);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [limits, setLimits] = useState<CmsStructureLimits | undefined>();
  const [templates, setTemplates] = useState<CmsTemplate[] | undefined>();
  const [structureVersion, setStructureVersion] = useState(0);
  const [isNewOpen, setIsNewOpen] = useState(
    initial?.dialog === "new-collection"
  );
  const [deleteTarget, setDeleteTarget] = useState<
    CmsStructureCollection | undefined
  >();
  const isDetailBackground = useIsBackground();
  // Which read, or a write, showed the line: that read's next answer, or
  // either read's after a write, clears it.
  const lineFrom = useRef<"e20" | "e21" | "write" | undefined>(undefined);
  const showLineFrom = useCallback(
    (from: "e20" | "e21" | "write", kind: CmsLineKind) => {
      lineFrom.current = from;
      showScreenLine(kind);
    },
    [showScreenLine]
  );
  const clearLineFrom = useCallback(
    (from: "e20" | "e21") => {
      if (lineFrom.current === from || lineFrom.current === "write") {
        lineFrom.current = undefined;
        clearScreenLine();
      }
    },
    [clearScreenLine]
  );
  const showLine = useCallback(
    (kind: CmsLineKind) => showLineFrom("write", kind),
    [showLineFrom]
  );

  // E20: the templates and the plan's caps, for a person who can manage.
  useEffect(() => {
    if (structure === undefined || isReady === false || opens === 0) {
      return;
    }
    if (canManage === false) {
      return;
    }
    let isCurrent = true;
    void structure.getStructure().then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = mapStructureRead(result.error);
        if (refusal !== undefined && refusal !== "toast") {
          showLineFrom("e20", refusal);
        }
        return;
      }
      clearLineFrom("e20");
      setLimits(result.limits);
      setTemplates(result.templates);
    });
    return () => {
      isCurrent = false;
    };
  }, [
    structure,
    isReady,
    canManage,
    opens,
    refresh,
    structureVersion,
    showLineFrom,
    clearLineFrom,
  ]);

  // E21: the open collection's structure.
  useEffect(() => {
    if (
      structure === undefined ||
      isReady === false ||
      opens === 0 ||
      collectionId === undefined
    ) {
      return;
    }
    const isBackground = isDetailBackground(
      structure,
      JSON.stringify([collectionId, detailAttempt])
    );
    let isCurrent = true;
    if (isBackground === false) {
      setDetailFailed(undefined);
    }
    void structure.getCollectionStructure(collectionId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = mapStructureRead(result.error);
        if (refusal === "toast") {
          return;
        }
        if (refusal !== undefined) {
          showLineFrom("e21", refusal);
          return;
        }
        if (isBackground) {
          return;
        }
        if (result.error === "not_found") {
          setDetailFailed("not_found");
          refetchCollections();
        } else {
          setDetailFailed("unavailable");
        }
        return;
      }
      clearLineFrom("e21");
      setDetailFailed(undefined);
      setDetail(result.collection);
    });
    return () => {
      isCurrent = false;
    };
  }, [
    structure,
    isReady,
    opens,
    refresh,
    collectionId,
    detailAttempt,
    detailVersion,
    isDetailBackground,
    showLineFrom,
    clearLineFrom,
    refetchCollections,
  ]);

  // A tab with nothing to show goes back to the list.
  useEffect(() => {
    if (collectionId === undefined && tab === "fields") {
      setTab("collections");
    }
  }, [collectionId, tab]);

  // A story may open the Delete dialog.
  const pendingDialogRef = useRef(initial?.dialog);
  useEffect(() => {
    if (pendingDialogRef.current === "delete" && detail !== undefined) {
      pendingDialogRef.current = undefined;
      setDeleteTarget(detail);
    }
  }, [detail]);

  // Whether the settings view or the field sheet reported unsaved values:
  // only then does closing it clear the screen's flag, which the item
  // editor shares.
  const viewDirty = useRef(false);
  const reportViewDirty = useCallback(
    (dirty: boolean) => {
      viewDirty.current = dirty;
      onDirtyChange(dirty);
    },
    [onDirtyChange]
  );
  const clearViewDirty = useCallback(() => {
    if (viewDirty.current) {
      viewDirty.current = false;
      onDirtyChange(false);
    }
  }, [onDirtyChange]);

  const closeView = useCallback(() => {
    clearViewDirty();
    setView(undefined);
  }, [clearViewDirty]);

  // A Create whose outcome is unknown: the next E1 holding a new collection
  // of that name is the one it made.
  const pendingCreate = useRef<
    (CmsPendingCreate & { knownIds: Set<string> }) | undefined
  >(undefined);
  const foundCreated = useRef<
    ((collection: CmsCollectionSummary, type: string) => void) | undefined
  >(undefined);
  useEffect(() => {
    const pending = pendingCreate.current;
    if (pending === undefined) {
      return;
    }
    const found = collections.find(
      (entry) =>
        pending.knownIds.has(entry.id) === false && entry.name === pending.name
    );
    if (found !== undefined) {
      foundCreated.current?.(found, pending.type);
    }
  }, [collections]);

  const fetchStructure = async (id: string) => {
    if (structure === undefined) {
      return undefined;
    }
    const result = await structure.getCollectionStructure(id);
    if (isCmsFailure(result)) {
      const refusal = mapStructureRead(result.error);
      if (refusal !== undefined && refusal !== "toast") {
        showLine(refusal);
      }
      return undefined;
    }
    return result.collection;
  };

  const open = (next: CmsStructureView) =>
    guard(() => {
      clearViewDirty();
      setSession((current) => current + 1);
      setView(next);
    });

  const openSettings = (id: string) =>
    guard(() => {
      clearViewDirty();
      if (id !== collectionId) {
        onOpenCollection(id);
      }
      setSession((current) => current + 1);
      setView({ type: "settings" });
    });

  const requestDelete = async (id: string) => {
    const found = id === detail?.id ? detail : await fetchStructure(id);
    if (found !== undefined) {
      setDeleteTarget(found);
    }
  };

  const reorder = async (key: string, toIndex: number) => {
    if (structure === undefined || detail === undefined) {
      return;
    }
    const before = detail;
    const from = before.fields.findIndex((field) => field.key === key);
    if (toIndex < 0 || toIndex >= before.fields.length || toIndex === from) {
      return;
    }
    const fields = moveField(before.fields, key, toIndex);
    setDetail({ ...before, fields });
    const result = await structure.updateSchema(before.id, {
      fields,
      expectedUpdatedAt: before.updatedAt,
    });
    if (isCmsFailure(result)) {
      setDetail((current) =>
        current?.id === before.id
          ? { ...current, fields: before.fields }
          : current
      );
      const refusal = getRefusal(result.error, "write");
      if (refusal === undefined) {
        toast.error(getStructureToastText(result.error, "field"));
      } else {
        showLine(refusal);
      }
      return;
    }
    setDetail((current) =>
      current?.id === before.id
        ? { ...current, updatedAt: result.updatedAt }
        : current
    );
    onWritten({ kind: "schema", slug: before.slug, removed: [] });
  };

  if (structure === undefined) {
    return {
      column: undefined,
      mainView: undefined,
      renderRowMenu: undefined,
      dialogs: null,
      closeView,
    };
  }

  const openDetail =
    detail !== undefined && detail.id === collectionId ? detail : undefined;
  const cap = getFieldCap(limits?.fields ?? Number.POSITIVE_INFINITY);
  const targets = collections.map(({ id, name }) => ({ id, name }));
  const openFieldKey =
    view?.type === "field" && "key" in view.target
      ? view.target.key
      : undefined;

  const renderFields = (): ReactNode => {
    if (detailFailed === "not_found") {
      return (
        <LineRow data-cms-structure-not-found>
          <Text>Collection not found</Text>
        </LineRow>
      );
    }
    if (detailFailed === "unavailable") {
      return (
        <RefusalLine
          kind="unavailable"
          onRetry={() => setDetailAttempt((current) => current + 1)}
        />
      );
    }
    if (openDetail === undefined) {
      return null;
    }
    return (
      <FieldsList
        fields={openDetail.fields}
        currentKey={openFieldKey}
        cap={cap}
        canManage={canManage}
        onSelect={(key) => {
          if (key !== openFieldKey) {
            open({ type: "field", target: { key } });
          }
        }}
        onReorder={(key, toIndex) => void reorder(key, toIndex)}
      />
    );
  };

  const column: CmsStructureColumn = {
    tab,
    onTabChange: setTab,
    hasFields: collectionId !== undefined,
    canManage,
    add:
      canManage === false ? null : tab === "collections" ? (
        <Tooltip content="New collection" side="bottom">
          <IconButton
            aria-label="New collection"
            onClick={() => guard(() => setIsNewOpen(true))}
          >
            <PlusIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <AddFieldMenu
          disabled={openDetail === undefined || openDetail.fields.length >= cap}
          onAdd={(kind: CmsFieldKind) =>
            open({ type: "field", target: { kind } })
          }
        />
      ),
    fields: <Flex css={{ flexGrow: 1, minHeight: 0 }}>{renderFields()}</Flex>,
  };

  const onCreated = (created: CmsCollectionSummary, type: string) => {
    pendingCreate.current = undefined;
    setIsNewOpen(false);
    onWritten({ kind: "created", collection: created });
    clearViewDirty();
    setView(undefined);
    onOpenCollection(created.id);
    // a custom collection starts with Name alone: its fields come next
    if (type === CUSTOM_COLLECTION_TYPE) {
      setTab("fields");
    }
    setStructureVersion((current) => current + 1);
  };

  foundCreated.current = onCreated;

  const createCallbacks = {
    onCreated,
    onRefusal: showLine,
    onUnknownOutcome: (pending: CmsPendingCreate) => {
      pendingCreate.current = {
        ...pending,
        knownIds: new Set(collections.map((entry) => entry.id)),
      };
      refetchCollections();
    },
    onLimit: () => setStructureVersion((current) => current + 1),
  };

  const renderMain = (): ReactNode => {
    if (isReady === false) {
      return undefined;
    }
    if (collections.length === 0 && canManage && templates !== undefined) {
      return (
        <NewCollectionPage
          structure={structure}
          templates={templates}
          limits={limits}
          {...createCallbacks}
        />
      );
    }
    if (view === undefined || openDetail === undefined) {
      return undefined;
    }
    if (view.type === "settings") {
      return (
        <CollectionSettings
          key={`${openDetail.id}:${session}`}
          structure={structure}
          collection={openDetail}
          canManage={canManage}
          onBack={() => guard(closeView)}
          onDirtyChange={reportViewDirty}
          onSaved={() => {
            setDetailVersion((current) => current + 1);
            onWritten({
              kind: "settings",
              before: { slug: openDetail.slug, isPublic: openDetail.isPublic },
              after: { slug: openDetail.slug, isPublic: openDetail.isPublic },
            });
          }}
          onDelete={() => setDeleteTarget(openDetail)}
          onRefusal={showLine}
        />
      );
    }
    return (
      <FieldSheet
        key={`${openDetail.id}:${session}`}
        structure={structure}
        collection={openDetail}
        target={view.target}
        targets={targets}
        canManage={canManage}
        onBack={() => guard(closeView)}
        onDirtyChange={reportViewDirty}
        onRefusal={showLine}
        onSaved={(fields, key) => {
          setDetail({ ...openDetail, fields });
          setSession((current) => current + 1);
          setView({ type: "field", target: { key } });
          onWritten({ kind: "schema", slug: openDetail.slug, removed: [] });
        }}
        onRemoved={(fields) => {
          const removed = openDetail.fields
            .filter((field) => fields.every((kept) => kept.key !== field.key))
            .map((field) => field.key);
          setDetail({ ...openDetail, fields });
          closeView();
          onWritten({ kind: "schema", slug: openDetail.slug, removed });
        }}
      />
    );
  };

  const dialogs = (
    <>
      <NewCollectionDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        structure={structure}
        templates={templates ?? []}
        limits={limits}
        initialType={initial?.newCollectionType}
        {...createCallbacks}
      />
      <DeleteCollectionDialog
        structure={structure}
        collection={deleteTarget}
        onRefusal={showLine}
        onRefresh={async (id) => {
          const found = await fetchStructure(id);
          if (found !== undefined) {
            setDeleteTarget(found);
          }
        }}
        onOpenChange={(isOpen) => {
          if (isOpen === false) {
            setDeleteTarget(undefined);
          }
        }}
        onDeleted={(id) => {
          const deleted = collections.find((entry) => entry.id === id);
          if (id === collectionId) {
            closeView();
          }
          setStructureVersion((current) => current + 1);
          onWritten({
            kind: "deleted",
            collectionId: id,
            slug: deleted?.slug ?? deleteTarget?.slug ?? "",
          });
        }}
      />
    </>
  );

  const renderRowMenu = (collection: CmsCollectionSummary): ReactNode => {
    const onSettings = () => openSettings(collection.id);
    const onDelete = () => void requestDelete(collection.id);
    const items = canManage
      ? {
          leading: (
            <>
              <DropdownMenuItem onSelect={onSettings}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ),
          trailing: (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            </>
          ),
        }
      : { leading: null, trailing: null };
    const actions = renderRowActions?.(collection, items);
    if (actions !== undefined && actions !== null) {
      return actions;
    }
    if (canManage === false) {
      return null;
    }
    return (
      <StructureRowMenu
        collection={collection}
        onSettings={onSettings}
        onDelete={onDelete}
      />
    );
  };

  return {
    column,
    mainView: renderMain(),
    renderRowMenu,
    dialogs,
    closeView,
  };
};
