/**
 * The structure screens' state (slice 3), for `CmsScreen`: the column's tab,
 * the open field sheet or collection settings, the open collection's
 * schema, the plan's caps and the templates, and the New collection and
 * Delete dialogs. Absent a `CmsStructureSource`, it adds nothing.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconButton, toast, Tooltip } from "@webstudio-is/design-system";
import { PlusIcon } from "@webstudio-is/icons";
import { getRefusal } from "./cms-logic";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCollectionSummary,
  type CmsFieldKind,
} from "./cms-source";
import {
  getFieldCap,
  getStructureToastText,
  moveField,
  normalizeStructureCollection,
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
import { NewCollectionDialog, NewCollectionPage } from "./new-collection";
import type { CmsLineKind } from "./refusal-line";
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
};

export const useCmsStructure = ({
  structure,
  access,
  collections,
  collectionId,
  initial,
  guard,
  onDirtyChange,
  onChanged,
  onOpenCollection,
  onRefusal,
  renderActionItems,
}: {
  structure: CmsStructureSource | undefined;
  access: CmsAccess | undefined;
  collections: CmsCollectionSummary[];
  collectionId: string | undefined;
  initial: CmsStructureInitial | undefined;
  /** The unsaved guard. */
  guard: (run: () => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After a write: the screen refetches E1 and E2. */
  onChanged: () => void;
  /** Opens a collection, past the guard. */
  onOpenCollection: (collectionId: string | undefined) => void;
  onRefusal: (line: CmsLineKind) => void;
  renderActionItems?: (collection: CmsCollectionSummary) => ReactNode;
}) => {
  const canManage = access?.canManageSettings === true;
  const isReady = structure !== undefined && access !== undefined;
  const [tab, setTab] = useState<CmsStructureTab>(
    initial?.tab ?? "collections"
  );
  const [view, setView] = useState<CmsStructureView | undefined>(initial?.view);
  const [session, setSession] = useState(0);
  const [version, setVersion] = useState(0);
  const [detail, setDetail] = useState<CmsStructureCollection | undefined>();
  const [limits, setLimits] = useState<CmsStructureLimits | undefined>();
  const [templates, setTemplates] = useState<CmsTemplate[]>([]);
  const [isNewOpen, setIsNewOpen] = useState(
    initial?.dialog === "new-collection"
  );
  const [deleteTarget, setDeleteTarget] = useState<
    CmsStructureCollection | undefined
  >();

  // The caps and templates, on open and after a collection is made or deleted.
  useEffect(() => {
    if (structure === undefined || isReady === false) {
      return;
    }
    let isCurrent = true;
    void Promise.all([structure.getLimits(), structure.listTemplates()]).then(
      ([limitsResult, templatesResult]) => {
        if (isCurrent === false) {
          return;
        }
        if (isCmsFailure(limitsResult) === false) {
          setLimits(limitsResult);
        }
        if (isCmsFailure(templatesResult) === false) {
          setTemplates(templatesResult.templates);
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [structure, isReady, version]);

  const fetchStructure = useCallback(
    async (id: string) => {
      if (structure === undefined) {
        return undefined;
      }
      const result = await structure.getStructure(id);
      if (isCmsFailure(result)) {
        const refusal = getRefusal(result.error);
        if (refusal !== undefined) {
          onRefusal(refusal);
        }
        return undefined;
      }
      return normalizeStructureCollection(result.collection);
    },
    [structure, onRefusal]
  );

  // The open collection's schema.
  useEffect(() => {
    if (collectionId === undefined || isReady === false) {
      setDetail(undefined);
      return;
    }
    let isCurrent = true;
    void fetchStructure(collectionId).then((found) => {
      if (isCurrent) {
        setDetail(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [collectionId, isReady, version, fetchStructure]);

  // A story may open the Delete dialog.
  const [initialDialog] = useState(initial?.dialog);
  useEffect(() => {
    if (initialDialog === "delete" && detail !== undefined) {
      setDeleteTarget((current) => current ?? detail);
    }
  }, [initialDialog, detail]);

  const closeView = useCallback(() => setView(undefined), []);

  const open = (next: CmsStructureView) =>
    guard(() => {
      onDirtyChange(false);
      setSession((current) => current + 1);
      setView(next);
    });

  const openSettings = (id: string) =>
    guard(() => {
      onDirtyChange(false);
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

  const changed = () => {
    setVersion((current) => current + 1);
    onChanged();
  };

  const reorder = async (key: string, toIndex: number) => {
    if (structure === undefined || detail === undefined) {
      return;
    }
    const before = detail;
    const fields = moveField(before.fields, key, toIndex);
    setDetail({ ...before, fields });
    const result = await structure.updateSchema(before.id, { fields });
    if (isCmsFailure(result)) {
      setDetail(before);
      const refusal = getRefusal(result.error);
      if (refusal === undefined) {
        toast.error(getStructureToastText(result.error, "field"));
      } else {
        onRefusal(refusal);
      }
      return;
    }
    changed();
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

  const cap = getFieldCap(limits?.fields ?? Number.POSITIVE_INFINITY);
  const targets = collections.map(({ id, name }) => ({ id, name }));
  const openFieldKey =
    view?.type === "field" && "key" in view.target
      ? view.target.key
      : undefined;

  const column: CmsStructureColumn = {
    tab,
    onTabChange: setTab,
    hasFields: collectionId !== undefined,
    add:
      canManage === false ? null : tab === "collections" ? (
        <Tooltip content="New collection" side="bottom">
          <IconButton
            aria-label="New collection"
            onClick={() => setIsNewOpen(true)}
          >
            <PlusIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <AddFieldMenu
          disabled={detail === undefined || detail.fields.length >= cap}
          onAdd={(kind: CmsFieldKind) =>
            open({ type: "field", target: { kind } })
          }
        />
      ),
    fields:
      detail === undefined || detail.id !== collectionId ? null : (
        <FieldsList
          fields={detail.fields}
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
      ),
  };

  const renderMain = (): ReactNode => {
    if (isReady === false) {
      return undefined;
    }
    if (collections.length === 0 && canManage) {
      return (
        <NewCollectionPage
          structure={structure}
          templates={templates}
          limits={limits}
          onRefusal={onRefusal}
          onCreated={(id, type) => {
            changed();
            onOpenCollection(id);
            if (type === CUSTOM_COLLECTION_TYPE) {
              setTab("fields");
            }
          }}
        />
      );
    }
    if (
      view === undefined ||
      detail === undefined ||
      detail.id !== collectionId
    ) {
      return undefined;
    }
    if (view.type === "settings") {
      return (
        <CollectionSettings
          key={`${detail.id}:${session}`}
          structure={structure}
          collection={detail}
          canManage={canManage}
          onBack={() => guard(closeView)}
          onDirtyChange={onDirtyChange}
          onSaved={changed}
          onDelete={() => setDeleteTarget(detail)}
          onRefusal={onRefusal}
        />
      );
    }
    return (
      <FieldSheet
        key={`${detail.id}:${session}`}
        structure={structure}
        collection={detail}
        target={view.target}
        targets={targets}
        canManage={canManage}
        onBack={() => guard(closeView)}
        onDirtyChange={onDirtyChange}
        onRefusal={onRefusal}
        onSaved={(fields, key) => {
          setDetail({ ...detail, fields });
          setSession((current) => current + 1);
          setView({ type: "field", target: { key } });
          changed();
        }}
        onRemoved={(fields) => {
          setDetail({ ...detail, fields });
          closeView();
          changed();
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
        templates={templates}
        limits={limits}
        initialType={initial?.newCollectionType}
        onRefusal={onRefusal}
        onCreated={(id, type) => {
          changed();
          onDirtyChange(false);
          setView(undefined);
          onOpenCollection(id);
          // a custom collection starts with Name alone: its fields come next
          if (type === CUSTOM_COLLECTION_TYPE) {
            setTab("fields");
          }
        }}
      />
      <DeleteCollectionDialog
        structure={structure}
        collection={deleteTarget}
        onRefusal={onRefusal}
        onOpenChange={(isOpen) => {
          if (isOpen === false) {
            setDeleteTarget(undefined);
          }
        }}
        onDeleted={(id) => {
          changed();
          if (id === collectionId) {
            onDirtyChange(false);
            setView(undefined);
            onOpenCollection(collections.find((entry) => entry.id !== id)?.id);
          }
        }}
      />
    </>
  );

  return {
    column,
    mainView: renderMain(),
    renderRowMenu: (collection: CmsCollectionSummary) => (
      <StructureRowMenu
        collection={collection}
        canManage={canManage}
        actionItems={renderActionItems?.(collection)}
        onSettings={() => openSettings(collection.id)}
        onDelete={() => void requestDelete(collection.id)}
      />
    ),
    dialogs,
    closeView,
  };
};
