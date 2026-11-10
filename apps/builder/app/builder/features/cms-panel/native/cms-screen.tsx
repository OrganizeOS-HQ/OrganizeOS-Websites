/**
 * The native CMS screen of slice 1 (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3): the collections column, then the items view or the item editor.
 *
 * Its state is local (D10): React state, and `$cmsNativeDirty`
 * (`cms-native-stores.ts`) for the window's `beforeunload`. Nothing here
 * reads or writes the build's stores; W2's overlay passes the door's
 * `CmsSource`, the catalog join and the collection actions in.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Box,
  Button,
  cssVar,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  Flex,
  toast,
} from "@webstudio-is/design-system";
import { getRefusal, getToastText, normalizeCollection } from "./cms-logic";
import { $cmsNativeDirty } from "./cms-native-stores";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCatalogView,
  type CmsCollection,
  type CmsCollectionSummary,
  type CmsFailure,
  type CmsItem,
  type CmsItemsPage,
  type CmsSource,
} from "./cms-source";
import type { CmsStructureSource } from "./cms-structure-source";
import { CollectionsColumn } from "./collections-column";
import { ItemEditor } from "./item-editor";
import { ItemsView } from "./items-view";
import { RefusalLine, type CmsLineKind } from "./refusal-line";
import { useCmsStructure, type CmsStructureInitial } from "./use-cms-structure";

export type CmsScreenView = {
  collectionId?: string;
  /** null: a new item. Absent: the items view. */
  itemId?: string | null;
  page?: number;
  query?: string;
  /** Slice 3: a tab, the field sheet or settings, a dialog. */
  structure?: CmsStructureInitial;
};

const lineOf = (failure: CmsFailure): CmsLineKind =>
  getRefusal(failure.error) ?? "unavailable";

const isSameAccess = (left: CmsAccess, right: CmsAccess) =>
  left.canEdit === right.canEdit &&
  left.canPublish === right.canPublish &&
  left.canManageSettings === right.canManageSettings;

export const CmsScreen = ({
  source,
  onClose,
  catalog,
  renderCollectionActions,
  collectionsFooter,
  homeUrl,
  initialView,
  openCount = 0,
  onOpenClassic,
  onItemWritten,
  structure,
  renderCollectionActionItems,
}: {
  source: CmsSource;
  /** Hides the overlay; never discards anything. */
  onClose: () => void;
  /** What the column draws from the build's catalog (4.5). */
  catalog?: CmsCatalogView;
  /**
   * Each row's "..." (4.5): W2's `CollectionActionsMenu`. W2 passes it only
   * in Design mode, for an org the deny list allows.
   */
  renderCollectionActions?: (collection: CmsCollectionSummary) => ReactNode;
  /** The orphan rows at the column's foot (4.5). */
  collectionsFooter?: ReactNode;
  /** The builder menu's "Back to OrganizeOS" address, for sign-in lines. */
  homeUrl?: string;
  /** Where to open, as the classic frame's `?collection` and `?item`. */
  initialView?: CmsScreenView;
  /**
   * The overlay's opens so far. Each reopen reads E0 again (4.3.1) and keeps
   * the view, unsaved edits included.
   */
  openCount?: number;
  /** Present while the classic frame exists (4.6). */
  onOpenClassic?: () => void;
  /** After a write: W2 invalidates the collection's canvas requests (4.7). */
  onItemWritten?: (collectionSlug: string, item: CmsItem) => void;
  /** Slice 3: the structure screens; absent, the screen is slice 1's. */
  structure?: CmsStructureSource;
  /**
   * With `structure`, the row's "..." is one menu: Settings, these
   * collection actions as menu items, then Delete.
   */
  renderCollectionActionItems?: (collection: CmsCollectionSummary) => ReactNode;
}) => {
  const [access, setAccess] = useState<CmsAccess | undefined>(undefined);
  const [line, setLine] = useState<CmsLineKind | undefined>(undefined);
  const [collections, setCollections] = useState<CmsCollectionSummary[]>([]);
  const [collectionId, setCollectionId] = useState(initialView?.collectionId);
  const [itemId, setItemId] = useState(initialView?.itemId);
  const [page, setPage] = useState(initialView?.page ?? 1);
  const [query, setQuery] = useState(initialView?.query ?? "");
  const [itemsPage, setItemsPage] = useState<CmsItemsPage | undefined>(
    undefined
  );
  const [detail, setDetail] = useState<CmsCollection | undefined>(undefined);
  const [detailFailed, setDetailFailed] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [pending, setPending] = useState<{ run: () => void } | undefined>(
    undefined
  );
  const [attempt, setAttempt] = useState(0);
  // A new editor for each item opened; a created item keeps its editor.
  const [editorSession, setEditorSession] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const [focusBack, setFocusBack] = useState(false);
  const [returnFocusItemId, setReturnFocusItemId] = useState<
    string | undefined
  >(undefined);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const isReady = access !== undefined;

  // E0 and E1, on open, on each reopen and on Retry.
  useEffect(() => {
    const effect = { isCurrent: true };
    // a function: narrowing would outlive the awaits
    const isStale = () => effect.isCurrent === false;
    const load = async () => {
      const accessResult = await source.getAccess();
      if (isStale()) {
        return;
      }
      if (isCmsFailure(accessResult)) {
        setLine(lineOf(accessResult));
        return;
      }
      const listResult = await source.listCollections();
      if (isStale()) {
        return;
      }
      if (isCmsFailure(listResult)) {
        setLine(lineOf(listResult));
        return;
      }
      setLine(undefined);
      setAccess((current) =>
        current !== undefined && isSameAccess(current, accessResult)
          ? current
          : accessResult
      );
      setCollections(listResult.collections);
      // a deep link to a collection E1 does not list opens the first one
      setCollectionId((current) =>
        listResult.collections.some((entry) => entry.id === current)
          ? current
          : listResult.collections[0]?.id
      );
    };
    void load();
    return () => {
      effect.isCurrent = false;
    };
  }, [source, attempt, openCount]);

  // Counts refetch after each write, silently.
  useEffect(() => {
    if (listVersion === 0) {
      return;
    }
    let isCurrent = true;
    void source.listCollections().then((result) => {
      if (isCurrent && isCmsFailure(result) === false) {
        setCollections(result.collections);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [source, listVersion]);

  // E2: the open collection's fields, kinds normalised once.
  useEffect(() => {
    if (collectionId === undefined || isReady === false) {
      return;
    }
    let isCurrent = true;
    setDetailFailed(false);
    void source.getCollection(collectionId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = getRefusal(result.error);
        if (refusal === undefined) {
          setDetailFailed(true);
        } else {
          setLine(refusal);
        }
        return;
      }
      setDetail(normalizeCollection(result.collection));
    });
    return () => {
      isCurrent = false;
    };
  }, [source, collectionId, isReady, detailAttempt]);

  // E3: the open page of items.
  useEffect(() => {
    if (collectionId === undefined || isReady === false) {
      return;
    }
    let isCurrent = true;
    void source
      .listItems(collectionId, { q: query === "" ? undefined : query, page })
      .then((result) => {
        if (isCurrent === false) {
          return;
        }
        if (isCmsFailure(result)) {
          const refusal = getRefusal(result.error);
          if (refusal === undefined) {
            toast.error(getToastText(result.error));
          } else {
            setLine(refusal);
          }
          return;
        }
        setItemsPage(result);
      });
    return () => {
      isCurrent = false;
    };
  }, [source, collectionId, isReady, page, query, listVersion]);

  useEffect(() => {
    $cmsNativeDirty.set(isEditorDirty);
  }, [isEditorDirty]);
  useEffect(() => () => $cmsNativeDirty.set(false), []);

  const onDirtyChange = useCallback((dirty: boolean) => {
    setIsEditorDirty(dirty);
  }, []);

  /** The unsaved guard: back, another item or collection, Classic CMS. */
  const guard = (run: () => void) => {
    if (isEditorDirty) {
      setPending({ run });
      return;
    }
    run();
  };

  const collection = collections.find((entry) => entry.id === collectionId);

  /** Opens a collection's items, past the guard. */
  const applyCollection = (nextId: string | undefined) => {
    setIsEditorDirty(false);
    if (nextId !== collectionId) {
      setItemsPage(undefined);
      setDetail(undefined);
    }
    setCollectionId(nextId);
    setItemId(undefined);
    setPage(1);
    setQuery("");
    setReturnFocusItemId(undefined);
    structureScreens.closeView();
  };

  const structureScreens = useCmsStructure({
    structure,
    access,
    collections,
    collectionId,
    initial: initialView?.structure,
    guard,
    onDirtyChange,
    onChanged: () => {
      setListVersion((current) => current + 1);
      setDetailAttempt((current) => current + 1);
    },
    onOpenCollection: applyCollection,
    onRefusal: setLine,
    renderActionItems: renderCollectionActionItems,
  });

  const selectCollection = (nextId: string) =>
    guard(() => applyCollection(nextId));

  const openItem = (nextId: string | null) => {
    setEditorSession((current) => current + 1);
    setFocusBack(true);
    setReturnFocusItemId(undefined);
    setItemId(nextId);
  };

  const closeEditor = () =>
    guard(() => {
      setIsEditorDirty(false);
      setReturnFocusItemId(itemId ?? undefined);
      setItemId(undefined);
    });

  const onWritten = (item: CmsItem) => {
    setListVersion((current) => current + 1);
    if (collection !== undefined) {
      onItemWritten?.(collection.slug, item);
    }
  };

  /** `unauthorized` (4.3.4): the guard, then this tab to the home address. */
  const onOpenHome =
    homeUrl === undefined
      ? undefined
      : () =>
          guard(() => {
            setIsEditorDirty(false);
            window.location.assign(homeUrl);
          });

  const renderView = () => {
    if (access === undefined || collection === undefined) {
      return null;
    }
    if (itemId !== undefined) {
      if (detailFailed) {
        return (
          <RefusalLine
            kind="unavailable"
            onRetry={() => setDetailAttempt((current) => current + 1)}
          />
        );
      }
      if (detail === undefined || detail.id !== collection.id) {
        return null;
      }
      return (
        <ItemEditor
          key={`${detail.id}:${editorSession}`}
          source={source}
          access={access}
          collection={detail}
          itemId={itemId}
          homeUrl={homeUrl}
          focusBack={focusBack}
          onBack={closeEditor}
          onDirtyChange={onDirtyChange}
          onWritten={onWritten}
          onCreated={(item) => setItemId(item.id)}
          onOpenHome={onOpenHome}
          onOpenClassic={
            onOpenClassic === undefined ? undefined : () => guard(onOpenClassic)
          }
        />
      );
    }
    return (
      <ItemsView
        collection={collection}
        page={itemsPage}
        query={query}
        canEdit={access.canEdit}
        focusItemId={returnFocusItemId}
        onQueryChange={(next) => {
          setQuery(next);
          setPage(1);
          setReturnFocusItemId(undefined);
        }}
        onPageChange={(next) => {
          setPage(next);
          setReturnFocusItemId(undefined);
        }}
        onOpenItem={(nextId) => openItem(nextId)}
        onNewItem={() => openItem(null)}
      />
    );
  };

  return (
    <Flex
      data-cms-native
      // the overlay focuses the screen on open (4.2.5); popups that float
      // panels anchor here (4.2.7)
      tabIndex={-1}
      data-floating-panel-container
      css={{
        width: "100%",
        height: "100%",
        outline: "none",
        background: cssVar("--background-primary"),
        color: cssVar("--foreground-primary"),
      }}
    >
      <CollectionsColumn
        collections={collections}
        currentCollectionId={line === undefined ? collectionId : undefined}
        catalog={isReady ? catalog : undefined}
        renderCollectionActions={
          isReady
            ? (structureScreens.renderRowMenu ?? renderCollectionActions)
            : undefined
        }
        structure={isReady ? structureScreens.column : undefined}
        footer={isReady ? collectionsFooter : undefined}
        onSelectCollection={selectCollection}
        onOpenClassic={
          onOpenClassic === undefined ? undefined : () => guard(onOpenClassic)
        }
        onClose={onClose}
      />
      <Flex direction="column" grow css={{ minWidth: 0, height: "100%" }}>
        {line !== undefined && (
          <RefusalLine
            kind={line}
            homeUrl={homeUrl}
            onOpenHome={onOpenHome}
            onRetry={() => setAttempt((current) => current + 1)}
          />
        )}
        {/* a refusal on reopen hides the view and keeps its edits */}
        <Box
          css={{
            display: line === undefined ? "flex" : "none",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0,
          }}
        >
          {structureScreens.mainView ?? renderView()}
        </Box>
      </Flex>
      {structureScreens.dialogs}
      <Dialog
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (open === false) {
            setPending(undefined);
          }
        }}
      >
        <DialogContent
          width={420}
          aria-describedby={undefined}
          // the safe choice takes the first focus; Discard stays right
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keepEditingRef.current?.focus();
          }}
        >
          <DialogActions>
            <Button
              color="destructive"
              onClick={() => {
                const next = pending;
                setPending(undefined);
                setIsEditorDirty(false);
                next?.run();
              }}
            >
              Discard
            </Button>
            <DialogClose>
              <Button ref={keepEditingRef} color="ghost">
                Keep editing
              </Button>
            </DialogClose>
          </DialogActions>
          {/* last in the DOM, so the close button is last in tab order */}
          <DialogTitle>Discard unsaved changes?</DialogTitle>
        </DialogContent>
      </Dialog>
    </Flex>
  );
};
