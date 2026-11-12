/**
 * The native CMS screen of slice 1 (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3): the collections column, then the items view or the item editor.
 *
 * Its state is local (D10): React state, and `$cmsNativeDirty`
 * (`cms-native-stores.ts`) for the window's `beforeunload`. Nothing here
 * reads or writes the build's stores; the host (`cms-native-screen.tsx`)
 * passes the door's `CmsSource`, the catalog join and the collection actions
 * in. It takes its callbacks as props, so this folder imports cms-panel.tsx
 * for types only.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@nanostores/react";
import {
  Box,
  Button,
  cssVar,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  styled,
  toast,
} from "@webstudio-is/design-system";
import type { CmsDeepLink } from "../cms-panel";
import { getRefusal, getToastText } from "./cms-logic";
import { $cmsNativeDirty, $cmsNativeRefresh } from "./cms-native-stores";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCatalogView,
  type CmsCollection,
  type CmsCollectionSummary,
  type CmsItem,
  type CmsItemsPage,
  type CmsSource,
} from "./cms-source";
import { CollectionsColumn } from "./collections-column";
import { ItemEditor } from "./item-editor";
import { ItemsView } from "./items-view";
import { RefusalLine, type CmsLineKind } from "./refusal-line";

export type CmsScreenView = {
  collectionId?: string;
  /** null: a new item. Absent: the items view. */
  itemId?: string | null;
  page?: number;
  query?: string;
};

export type CmsScreenProps = {
  /** Undefined without a project: the column title only, and no call. */
  source: CmsSource | undefined;
  /** The classic frame shows in its place (display: none). */
  hidden: boolean;
  /**
   * Shown to the person. Each change from false to true after the first is
   * a reopen (4.3.1, 4.7).
   */
  isVisible: boolean;
  /** Hides the overlay; never discards anything. */
  onClose: () => void;
  onShowClassic: (deepLink: CmsDeepLink) => void;
  /** The builder menu's "Back to OrganizeOS" address, for sign-in lines. */
  homeUrl?: string;
  /** Leaves the builder for `homeUrl`. */
  navigate?: (url: string) => void;
  /** After a write: the collection's canvas requests are invalidated (4.7). */
  onItemWritten?: (collectionSlug: string, item: CmsItem) => void;
  /** Where to open; stories only. */
  initialView?: CmsScreenView;
  /** What the column draws from the build's catalog (4.5). */
  catalog?: CmsCatalogView;
  /** Each row's "..." (4.5), only where the actions are allowed. */
  renderCollectionActions?: (collection: CmsCollectionSummary) => ReactNode;
  /** The orphan rows at the column's foot (4.5). */
  collectionsFooter?: ReactNode;
};

const Root = styled("div", {
  width: "100%",
  height: "100%",
  outline: "none",
  color: cssVar("--foreground-primary"),
});

const Main = styled("div", {
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  minWidth: 0,
  height: "100%",
});

const isSameAccess = (left: CmsAccess, right: CmsAccess) =>
  left.canEdit === right.canEdit &&
  left.canPublish === right.canPublish &&
  left.canManageSettings === right.canManageSettings;

const defaultNavigate = (url: string) => {
  window.location.assign(url);
};

/**
 * Tells a background refetch from a foreground fetch: a fetch whose
 * foreground inputs (`key`) and source are those of the last fetch was asked
 * for only by a reopen or a refresh.
 */
const useIsBackgroundFetch = () => {
  const last = useRef<{ source: CmsSource; key: string } | undefined>(
    undefined
  );
  return useCallback((source: CmsSource, key: string) => {
    const isBackground =
      last.current?.source === source && last.current.key === key;
    last.current = { source, key };
    return isBackground;
  }, []);
};

export const CmsScreen = forwardRef<HTMLDivElement, CmsScreenProps>(
  (
    {
      source,
      hidden,
      isVisible,
      onClose,
      onShowClassic,
      homeUrl,
      navigate = defaultNavigate,
      onItemWritten,
      initialView,
      catalog,
      renderCollectionActions,
      collectionsFooter,
    },
    ref
  ) => {
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
    // The times the screen has been shown: the first is the open, each
    // later one a reopen.
    const [opens, setOpens] = useState(0);
    const refresh = useStore($cmsNativeRefresh);
    const refreshAtMount = useRef(refresh);
    const keepEditingRef = useRef<HTMLButtonElement>(null);
    const isReady = access !== undefined;
    const isLoadBackground = useIsBackgroundFetch();
    const isDetailBackground = useIsBackgroundFetch();
    const isPageBackground = useIsBackgroundFetch();

    useEffect(() => {
      if (isVisible) {
        setOpens((current) => current + 1);
      }
    }, [isVisible]);

    // E0 and E1, on open, on each reopen and on Retry.
    useEffect(() => {
      if (source === undefined || opens === 0) {
        return;
      }
      const isBackground = isLoadBackground(source, String(attempt));
      const effect = { isCurrent: true };
      // a function: narrowing would outlive the awaits
      const isStale = () => effect.isCurrent === false;
      // A refusal always shows its line; any other failure only on a
      // fetch the person asked for, so a background one changes nothing.
      const onFailure = (error: Parameters<typeof getRefusal>[0]) => {
        const refusal = getRefusal(error);
        if (refusal !== undefined) {
          setLine(refusal);
        } else if (isBackground === false) {
          setLine("unavailable");
        }
      };
      const load = async () => {
        const accessResult = await source.getAccess();
        if (isStale()) {
          return;
        }
        if (isCmsFailure(accessResult)) {
          onFailure(accessResult.error);
          return;
        }
        const listResult = await source.listCollections();
        if (isStale()) {
          return;
        }
        if (isCmsFailure(listResult)) {
          onFailure(listResult.error);
          return;
        }
        setLine(undefined);
        setAccess((current) =>
          current !== undefined && isSameAccess(current, accessResult)
            ? current
            : accessResult
        );
        setCollections(listResult.collections);
      };
      void load();
      return () => {
        effect.isCurrent = false;
      };
    }, [source, attempt, opens, isLoadBackground]);

    // E1 alone after each write, here or in the classic frame, silently.
    useEffect(() => {
      if (source === undefined || isReady === false) {
        return;
      }
      if (listVersion === 0 && refresh === refreshAtMount.current) {
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
    }, [source, isReady, listVersion, refresh]);

    // The open collection is a listed one. While an item is open it stays,
    // listed or not, so its editor and edits stay; the first collection
    // opens once the editor closes.
    useEffect(() => {
      if (isReady === false || itemId !== undefined) {
        return;
      }
      if (collections.some((entry) => entry.id === collectionId)) {
        return;
      }
      const first = collections[0]?.id;
      if (first === collectionId) {
        return;
      }
      setItemsPage(undefined);
      setDetail(undefined);
      setPage(1);
      setQuery("");
      setCollectionId(first);
    }, [isReady, itemId, collectionId, collections]);

    // E2: the open collection's fields.
    useEffect(() => {
      if (
        source === undefined ||
        collectionId === undefined ||
        isReady === false
      ) {
        return;
      }
      const isBackground = isDetailBackground(
        source,
        JSON.stringify([collectionId, detailAttempt])
      );
      let isCurrent = true;
      if (isBackground === false) {
        setDetailFailed(false);
      }
      void source.getCollection(collectionId).then((result) => {
        if (isCurrent === false) {
          return;
        }
        if (isCmsFailure(result)) {
          const refusal = getRefusal(result.error);
          if (refusal !== undefined) {
            setLine(refusal);
          } else if (isBackground === false) {
            setDetailFailed(true);
          }
          return;
        }
        setDetailFailed(false);
        setDetail(result.collection);
      });
      return () => {
        isCurrent = false;
      };
    }, [
      source,
      collectionId,
      isReady,
      detailAttempt,
      opens,
      refresh,
      isDetailBackground,
    ]);

    // E3: the open page of items.
    useEffect(() => {
      if (
        source === undefined ||
        collectionId === undefined ||
        isReady === false
      ) {
        return;
      }
      const isBackground = isPageBackground(
        source,
        JSON.stringify([collectionId, page, query, listVersion])
      );
      let isCurrent = true;
      void source
        .listItems(collectionId, { q: query === "" ? undefined : query, page })
        .then((result) => {
          if (isCurrent === false) {
            return;
          }
          if (isCmsFailure(result)) {
            const refusal = getRefusal(result.error);
            if (refusal !== undefined) {
              setLine(refusal);
            } else if (isBackground === false) {
              toast.error(getToastText(result.error));
            }
            return;
          }
          setItemsPage(result);
        });
      return () => {
        isCurrent = false;
      };
    }, [
      source,
      collectionId,
      isReady,
      page,
      query,
      listVersion,
      opens,
      refresh,
      isPageBackground,
    ]);

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

    // The open collection's summary. An open editor keeps the last one E1
    // gave, so a refetch that no longer lists it never unmounts the editor.
    const listedCollection = collections.find(
      (entry) => entry.id === collectionId
    );
    const lastCollection = useRef<CmsCollectionSummary | undefined>(undefined);
    if (listedCollection !== undefined) {
      lastCollection.current = listedCollection;
    }
    const collection =
      listedCollection ??
      (itemId !== undefined && lastCollection.current?.id === collectionId
        ? lastCollection.current
        : undefined);

    const selectCollection = (nextId: string) =>
      guard(() => {
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
      });

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

    const onDirtyChange = useCallback((dirty: boolean) => {
      setIsEditorDirty(dirty);
    }, []);

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
              navigate(homeUrl);
            });

    const renderView = () => {
      if (
        source === undefined ||
        access === undefined ||
        collection === undefined
      ) {
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
            onOpenClassic={() => guard(() => onShowClassic({}))}
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
      <Root
        ref={ref}
        data-cms-native-screen
        // popups that float panels anchor here (4.2.7)
        data-floating-panel-container
        // the overlay focuses the screen on open (4.2.5)
        tabIndex={-1}
        style={{ display: hidden ? "none" : "flex" }}
      >
        <CollectionsColumn
          collections={collections}
          currentCollectionId={line === undefined ? collectionId : undefined}
          catalog={isReady ? catalog : undefined}
          renderCollectionActions={
            isReady ? renderCollectionActions : undefined
          }
          footer={isReady ? collectionsFooter : undefined}
          onSelectCollection={selectCollection}
          onShowClassic={() => onShowClassic({})}
          onClose={onClose}
        />
        {/* without a source, nothing loads and the main region stays empty */}
        <Main data-cms-native-main>
          {source !== undefined && line !== undefined && (
            <RefusalLine
              kind={line}
              homeUrl={homeUrl}
              onOpenHome={onOpenHome}
              onRetry={() => setAttempt((current) => current + 1)}
            />
          )}
          {/* a refusal on reopen hides the view and keeps its edits */}
          {source !== undefined && (
            <Box
              css={{
                display: line === undefined ? "flex" : "none",
                flexDirection: "column",
                flexGrow: 1,
                minHeight: 0,
              }}
            >
              {renderView()}
            </Box>
          )}
        </Main>
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
      </Root>
    );
  }
);
CmsScreen.displayName = "CmsScreen";
