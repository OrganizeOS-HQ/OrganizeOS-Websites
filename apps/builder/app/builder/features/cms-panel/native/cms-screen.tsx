/**
 * The native CMS screen of slice 1 (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3): the collections column, then the items view or the item editor.
 *
 * Its state is local (D10): React state, and `$cmsNativeDirty` for the
 * window's `beforeunload`. Nothing here reads or writes the build's stores;
 * W2's overlay passes the door's `CmsSource`, the catalog join and the
 * collection actions in.
 */
import { useCallback, useEffect, useState } from "react";
import { atom } from "nanostores";
import {
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
import { getRefusal, getToastText } from "./cms-logic";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCatalogView,
  type CmsCollection,
  type CmsCollectionActions,
  type CmsCollectionSummary,
  type CmsFailure,
  type CmsItem,
  type CmsItemsPage,
  type CmsSource,
} from "./cms-source";
import { CollectionsColumn } from "./collections-column";
import { ItemEditor } from "./item-editor";
import { ItemsView } from "./items-view";
import { RefusalLine, type CmsLineKind } from "./refusal-line";

/**
 * The native editor's unsaved flag. W2 makes `$cmsDirty` the computed of
 * `$cmsFrameDirty` and this (4.3.2); clearing one never clears the other.
 */
export const $cmsNativeDirty = atom(false);

export type CmsScreenView = {
  collectionId?: string;
  /** null: a new item. Absent: the items view. */
  itemId?: string | null;
  page?: number;
  query?: string;
};

const lineOf = (failure: CmsFailure): CmsLineKind =>
  getRefusal(failure.error) ?? "unavailable";

export const CmsScreen = ({
  source,
  onClose,
  catalog,
  actions = {},
  homeUrl,
  initialView,
  onOpenClassic,
  onItemWritten,
}: {
  source: CmsSource;
  /** Hides the overlay; never discards anything. */
  onClose: () => void;
  /** The build's side of each collection row (4.5). */
  catalog?: CmsCatalogView;
  actions?: CmsCollectionActions;
  /** The builder menu's "Back to OrganizeOS" address, for sign-in lines. */
  homeUrl?: string;
  /** Where to open, as the classic frame's `?collection` and `?item`. */
  initialView?: CmsScreenView;
  /** Present while the classic frame exists (4.6). */
  onOpenClassic?: () => void;
  /** After a write: W2 invalidates the collection's canvas requests (4.7). */
  onItemWritten?: (collectionSlug: string, item: CmsItem) => void;
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
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [pending, setPending] = useState<{ run: () => void } | undefined>(
    undefined
  );
  const [attempt, setAttempt] = useState(0);
  // A new editor for each item opened; a created item keeps its editor.
  const [editorSession, setEditorSession] = useState(0);
  const [listVersion, setListVersion] = useState(0);

  // E0 and E1, on open and on Retry.
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
      setAccess(accessResult);
      setCollections(listResult.collections);
      setCollectionId((current) => current ?? listResult.collections[0]?.id);
    };
    void load();
    return () => {
      effect.isCurrent = false;
    };
  }, [source, attempt]);

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

  // E2: the open collection's fields.
  useEffect(() => {
    if (collectionId === undefined || access === undefined) {
      return;
    }
    let isCurrent = true;
    setDetail(undefined);
    void source.getCollection(collectionId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        toast.error(getToastText(result.error));
        return;
      }
      setDetail(result.collection);
    });
    return () => {
      isCurrent = false;
    };
  }, [source, collectionId, access]);

  // E3: the open page of items.
  useEffect(() => {
    if (collectionId === undefined || access === undefined) {
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
  }, [source, collectionId, access, page, query, listVersion]);

  useEffect(() => {
    $cmsNativeDirty.set(isEditorDirty);
  }, [isEditorDirty]);
  useEffect(() => () => $cmsNativeDirty.set(false), []);

  /** The unsaved guard: back, another item or collection, Classic CMS. */
  const guard = (run: () => void) => {
    if (isEditorDirty) {
      setPending({ run });
      return;
    }
    run();
  };

  const collection = collections.find((entry) => entry.id === collectionId);

  const selectCollection = (nextId: string) =>
    guard(() => {
      setIsEditorDirty(false);
      if (nextId !== collectionId) {
        setItemsPage(undefined);
      }
      setCollectionId(nextId);
      setItemId(undefined);
      setPage(1);
      setQuery("");
    });

  const openItem = (nextId: string | null) => {
    setEditorSession((current) => current + 1);
    setItemId(nextId);
  };

  const onDirtyChange = useCallback((dirty: boolean) => {
    setIsEditorDirty(dirty);
  }, []);

  const onWritten = (item: CmsItem) => {
    setListVersion((current) => current + 1);
    if (collection !== undefined) {
      onItemWritten?.(collection.slug, item);
    }
  };

  const renderMain = () => {
    if (line !== undefined) {
      return (
        <Flex align="center" justify="center" grow>
          <RefusalLine
            kind={line}
            homeUrl={homeUrl}
            onRetry={() => setAttempt((current) => current + 1)}
          />
        </Flex>
      );
    }
    if (access === undefined || collection === undefined) {
      return null;
    }
    if (itemId !== undefined) {
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
          onBack={() =>
            guard(() => {
              setIsEditorDirty(false);
              setItemId(undefined);
            })
          }
          onDirtyChange={onDirtyChange}
          onWritten={onWritten}
          onCreated={(item) => setItemId(item.id)}
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
        onQueryChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        onPageChange={setPage}
        onOpenItem={(nextId) => openItem(nextId)}
        onNewItem={() => openItem(null)}
      />
    );
  };

  return (
    <Flex
      data-cms-native
      css={{
        width: "100%",
        height: "100%",
        background: cssVar("--background-primary"),
        color: cssVar("--foreground-primary"),
      }}
    >
      <CollectionsColumn
        collections={collections}
        currentCollectionId={line === undefined ? collectionId : undefined}
        catalog={access === undefined ? undefined : catalog}
        actions={actions}
        onSelectCollection={selectCollection}
        onOpenClassic={
          onOpenClassic === undefined ? undefined : () => guard(onOpenClassic)
        }
        onClose={onClose}
      />
      <Flex direction="column" grow css={{ minWidth: 0, height: "100%" }}>
        {renderMain()}
      </Flex>
      <Dialog
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (open === false) {
            setPending(undefined);
          }
        }}
      >
        <DialogContent width={420} aria-describedby={undefined}>
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
              <Button color="ghost">Keep editing</Button>
            </DialogClose>
          </DialogActions>
          {/* last in the DOM, so the close button is last in tab order */}
          <DialogTitle>Discard unsaved changes?</DialogTitle>
        </DialogContent>
      </Dialog>
    </Flex>
  );
};
