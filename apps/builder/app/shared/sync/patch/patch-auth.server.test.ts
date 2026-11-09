import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const hasProjectPermit = vi.hoisted(() => vi.fn());
const readAccessToken = vi.hoisted(() => vi.fn());
const getContentModeCapabilities = vi.hoisted(() =>
  vi.fn(
    (input: {
      instances: Map<string, unknown>;
      metas: Map<string, unknown>;
      props: Map<string, unknown>;
      styleSources: Map<string, unknown>;
      styleSourceSelections: Map<string, unknown>;
      styles: Map<string, unknown>;
      breakpoints: Map<string, unknown>;
    }) => ({
      editablePropIds: new Set(),
      editableInstanceIds: new Set(),
      instances: input.instances,
      metas: input.metas,
      props: input.props,
      htmlTagsByInstanceId: new Map(),
      styleSources: input.styleSources,
      styleSourceSelections: input.styleSourceSelections,
      styles: input.styles,
      breakpoints: input.breakpoints,
      contentRootIds: new Set(),
    })
  )
);
const applyContentModeTransaction = vi.hoisted(() =>
  vi.fn(
    ({
      capabilities,
      transaction,
    }: {
      capabilities: Record<string, unknown>;
      transaction: { id: string; payload: Array<{ namespace: string }> };
    }) => {
      if (transaction.payload.some((change) => change.namespace === "styles")) {
        return { success: false, error: "build-only" };
      }
      return {
        success: true,
        capabilities: { ...capabilities, appliedTransactionId: transaction.id },
      };
    }
  )
);

vi.mock("@webstudio-is/trpc-interface/index.server", () => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    authorizeProject: { hasProjectPermit },
  };
});

vi.mock("@webstudio-is/project-build/runtime", () => ({
  applyContentModeTransaction,
  getContentModeCapabilities,
}));

const env = vi.hoisted(() => ({
  AUTH_WS_CLIENT_SECRET: "secret",
  ORGANIZEOS_SSO_PUBLIC_KEY: undefined as string | undefined,
  ORGANIZEOS_SESSION_BINDING: "observe" as "observe" | "enforce",
  POSTGREST_URL: "http://localhost:3000",
  POSTGREST_API_KEY: "service-key",
}));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("~/env/env.server", () => ({ default: env }));

vi.mock("@webstudio-is/postgrest/index.server", () => ({
  createClient: () => ({ rpc }),
}));

vi.mock("@webstudio-is/project/index.server", () => ({
  patchLoadedBuild: vi.fn(),
}));

vi.mock("~/services/token.server", () => ({
  readAccessToken,
}));

vi.mock(
  "~/services/auth-strategy/organizeos-binding.server",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("~/services/auth-strategy/organizeos-binding.server")
      >();
    return {
      ...actual,
      checkOrganizeosBindingClaims: vi.fn(actual.checkOrganizeosBindingClaims),
    };
  }
);

import {
  checkOrganizeosBindingClaims,
  resetOrganizeosBindingCache,
} from "~/services/auth-strategy/organizeos-binding.server";
import {
  authorizePatchEntries,
  createContentModeCapabilities,
  createWriterContext,
} from "./patch-auth.server";
import { loadAuthorizedPatchState } from "./patch-service.server";
import type { NormalizedPatchRequest } from "./patch-normalize.server";

const buildRow = {
  pages: JSON.stringify({}),
  instances: JSON.stringify([
    { id: "body-1", type: "instance", component: "Body", children: [] },
  ]),
  props: JSON.stringify([]),
  styleSources: JSON.stringify([]),
  styleSourceSelections: JSON.stringify([]),
  styles: JSON.stringify([]),
  breakpoints: JSON.stringify([]),
};

const createContext = () => {
  const context = {
    authorization: { type: "anonymous" },
    createTokenContext: vi.fn(async (authToken: string) => ({
      authorization: { type: "token", authToken },
    })),
    postgrest: {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: buildRow,
                error: undefined,
              })),
            })),
          })),
        })),
      },
    },
  };
  return context;
};

const transaction = (namespace: string, id = `tx-${namespace}`) => ({
  id,
  payload: [{ namespace, patches: [{ op: "replace", path: ["x"], value: 1 }] }],
});

describe("createWriterContext", () => {
  beforeEach(() => {
    readAccessToken.mockReset();
  });

  test("rejects empty and legacy session tokens", async () => {
    const context = createContext();

    await expect(createWriterContext(context as never, "")).rejects.toThrow(
      "Collab writer token is not authorized"
    );
    await expect(
      createWriterContext(context as never, "session")
    ).rejects.toThrow("Collab writer token is not authorized");
  });

  test("creates a user context from a signed collab token", async () => {
    readAccessToken.mockResolvedValue({
      userId: "user-1",
      projectId: "project-1",
      purpose: "collab",
    });

    const writerContext = await createWriterContext(
      createContext() as never,
      "signed-token"
    );

    expect(writerContext.authorization).toMatchObject({
      type: "user",
      userId: "user-1",
    });
    const authorization = writerContext.authorization as {
      isLoggedInToBuilder: (projectId: string) => Promise<boolean>;
    };
    expect(await authorization.isLoggedInToBuilder("project-1")).toBe(true);
    expect(await authorization.isLoggedInToBuilder("project-2")).toBe(false);
  });

  test("falls back to the shared-link token context", async () => {
    readAccessToken.mockResolvedValue(undefined);
    const context = createContext();

    const writerContext = await createWriterContext(
      context as never,
      "shared-link-token"
    );

    expect(context.createTokenContext).toHaveBeenCalledWith(
      "shared-link-token"
    );
    expect(writerContext.authorization).toEqual({
      type: "token",
      authToken: "shared-link-token",
    });
  });
});

// OrganizeOS: collaboration writes pass the session binding check
// (services/auth-strategy/organizeos-binding.server.ts), as session reads do.
describe("collaboration writes pass the session binding check", () => {
  const SID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const ORGANIZEOS_USER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const boundToken = {
    userId: "user-1",
    projectId: "project-1",
    organizeosSid: SID,
    organizeosUserId: ORGANIZEOS_USER,
    purpose: "collab",
  };
  const unauthorized = "Collab writer token is not authorized";

  const writerPatch = (): NormalizedPatchRequest => ({
    buildId: "build-1",
    projectId: "project-1",
    clientVersion: 1,
    entries: [
      {
        transaction: transaction("props") as never,
        writer: { type: "token", authToken: "token-1" },
      },
    ],
  });

  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    readAccessToken.mockReset();
    hasProjectPermit.mockReset();
    hasProjectPermit.mockResolvedValue(true);
    rpc.mockReset();
    vi.mocked(checkOrganizeosBindingClaims).mockClear();
    resetOrganizeosBindingCache();
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    env.ORGANIZEOS_SESSION_BINDING = "observe";
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
    env.ORGANIZEOS_SESSION_BINDING = "observe";
  });

  test("a live binding gives a user context", async () => {
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: true, error: null });

    const writerContext = await createWriterContext(
      createContext() as never,
      "token-1"
    );

    expect(writerContext.authorization).toMatchObject({
      type: "user",
      userId: "user-1",
    });
    expect(rpc).toHaveBeenCalledWith("websites2_sso_session_live", {
      p_session_id: SID,
      p_user_id: ORGANIZEOS_USER,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test("a dead binding is allowed and logged once under observe", async () => {
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: false, error: null });

    const writerContext = await createWriterContext(
      createContext() as never,
      "token-1"
    );

    expect(writerContext.authorization).toMatchObject({ type: "user" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        organizeosBinding: "dead",
        mode: "observe",
        userId: "user-1",
      })
    );
  });

  test("a dead binding is refused under enforce, without the share-link path", async () => {
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: false, error: null });
    const context = createContext();

    await expect(
      createWriterContext(context as never, "token-1")
    ).rejects.toThrow(unauthorized);
    expect(context.createTokenContext).not.toHaveBeenCalled();
  });

  test.each([
    ["observe", true],
    ["enforce", false],
  ] as const)("a token without the binding under %s", async (mode, allow) => {
    env.ORGANIZEOS_SESSION_BINDING = mode;
    readAccessToken.mockResolvedValue({
      userId: "user-1",
      projectId: "project-1",
      purpose: "collab",
    });
    const result = createWriterContext(createContext() as never, "token-1");

    if (allow) {
      await expect(result).resolves.toMatchObject({
        authorization: { type: "user" },
      });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ organizeosBinding: "missing" })
      );
    } else {
      await expect(result).rejects.toThrow(unauthorized);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ["observe", true],
    ["enforce", false],
  ] as const)("a liveness error under %s", async (mode, allow) => {
    env.ORGANIZEOS_SESSION_BINDING = mode;
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = createWriterContext(createContext() as never, "token-1");

    if (allow) {
      await expect(result).resolves.toMatchObject({
        authorization: { type: "user" },
      });
    } else {
      await expect(result).rejects.toThrow(unauthorized);
    }
  });

  test("without SSO the token is allowed and no liveness check runs", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    readAccessToken.mockResolvedValue({
      userId: "user-1",
      projectId: "project-1",
      purpose: "collab",
    });

    await expect(
      createWriterContext(createContext() as never, "token-1")
    ).resolves.toMatchObject({ authorization: { type: "user" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ["no purpose", undefined],
    ["another purpose", "login"],
  ])(
    "an access token with %s is a refused entry, in every mode",
    async (_name, purpose) => {
      env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
      readAccessToken.mockResolvedValue({
        userId: "user-1",
        projectId: "project-1",
        ...(purpose === undefined ? {} : { purpose }),
      });
      const context = createContext();

      const result = await authorizePatchEntries(
        context as never,
        writerPatch(),
        () => createContentModeCapabilities(buildRow)
      );

      expect(result.authorized).toEqual([]);
      expect(result.rejected).toEqual([
        expect.objectContaining({ errors: unauthorized }),
      ]);
      expect(context.createTokenContext).not.toHaveBeenCalled();
      expect(checkOrganizeosBindingClaims).not.toHaveBeenCalled();
    }
  );

  test("a dead binding under enforce is a refused entry", async () => {
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: false, error: null });

    const result = await authorizePatchEntries(
      createContext() as never,
      writerPatch(),
      () => createContentModeCapabilities(buildRow)
    );

    expect(result.authorized).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({ errors: unauthorized }),
    ]);
  });

  test("a failure of the check itself fails the request, not the entry", async () => {
    readAccessToken.mockResolvedValue(boundToken);
    vi.mocked(checkOrganizeosBindingClaims).mockRejectedValueOnce(
      new Error("check failed")
    );
    const context = createContext();

    await expect(
      authorizePatchEntries(context as never, writerPatch(), () =>
        createContentModeCapabilities(buildRow)
      )
    ).rejects.toThrow("check failed");
    expect(context.createTokenContext).not.toHaveBeenCalled();
  });

  test("loadAuthorizedPatchState refuses a dead binding under enforce", async () => {
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    readAccessToken.mockResolvedValue(boundToken);
    rpc.mockResolvedValue({ data: false, error: null });
    const context = createContext();

    await expect(
      loadAuthorizedPatchState({
        authToken: "token-1",
        buildId: "build-1",
        context: context as never,
      })
    ).rejects.toThrow(unauthorized);
    expect(context.createTokenContext).not.toHaveBeenCalled();
    expect(hasProjectPermit).not.toHaveBeenCalled();
  });
});

describe("authorizePatchEntries", () => {
  beforeEach(() => {
    hasProjectPermit.mockReset();
    readAccessToken.mockReset();
    getContentModeCapabilities.mockClear();
    applyContentModeTransaction.mockClear();
  });

  test("skips content-mode capabilities for writers with build permit", async () => {
    readAccessToken
      .mockResolvedValueOnce({
        userId: "user-1",
        projectId: "project-1",
        purpose: "collab",
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        projectId: "project-1",
        purpose: "collab",
      });
    hasProjectPermit.mockResolvedValue(true);
    const context = createContext();
    const patch: NormalizedPatchRequest = {
      buildId: "build-1",
      projectId: "project-1",
      clientVersion: 1,
      entries: [
        {
          transaction: transaction("props") as never,
          writer: { type: "token", authToken: "token-1" },
        },
        {
          transaction: transaction("styles") as never,
          writer: { type: "token", authToken: "token-2" },
        },
      ],
    };

    const result = await authorizePatchEntries(context as never, patch, () =>
      createContentModeCapabilities(buildRow)
    );

    expect(result.rejected).toEqual([]);
    expect(result.authorized[0].context.authorization).toMatchObject({
      type: "user",
      userId: "user-1",
    });
    expect(result.authorized[1].context.authorization).toMatchObject({
      type: "user",
      userId: "user-2",
    });
    expect(getContentModeCapabilities).not.toHaveBeenCalled();
    expect(applyContentModeTransaction).not.toHaveBeenCalled();
    expect(hasProjectPermit).toHaveBeenCalledTimes(2);
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      1,
      { projectId: "project-1", permit: "build" },
      expect.objectContaining({
        authorization: expect.objectContaining({ userId: "user-1" }),
      })
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      2,
      { projectId: "project-1", permit: "build" },
      expect.objectContaining({
        authorization: expect.objectContaining({ userId: "user-2" }),
      })
    );
  });

  test("falls back to content-mode permissions without build permit", async () => {
    readAccessToken
      .mockResolvedValueOnce({
        userId: "user-1",
        projectId: "project-1",
        purpose: "collab",
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        projectId: "project-1",
        purpose: "collab",
      });
    hasProjectPermit
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const patch: NormalizedPatchRequest = {
      buildId: "build-1",
      projectId: "project-1",
      clientVersion: 1,
      entries: [
        {
          transaction: transaction("props", "tx-edit") as never,
          writer: { type: "token", authToken: "token-1" },
        },
        {
          transaction: transaction("styles", "tx-build") as never,
          writer: { type: "token", authToken: "token-2" },
        },
      ],
    };

    const result = await authorizePatchEntries(
      createContext() as never,
      patch,
      () => createContentModeCapabilities(buildRow)
    );

    expect(result.rejected).toEqual([]);
    expect(result.authorized).toHaveLength(2);
    expect(getContentModeCapabilities).toHaveBeenCalledTimes(1);
    expect(applyContentModeTransaction).toHaveBeenCalledTimes(2);
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        transaction: patch.entries[0].transaction,
        capabilities: expect.objectContaining({
          editablePropIds: expect.any(Set),
          instances: expect.any(Map),
          metas: expect.any(Map),
          props: expect.any(Map),
          styleSources: expect.any(Map),
          styleSourceSelections: expect.any(Map),
          styles: expect.any(Map),
          breakpoints: expect.any(Map),
          contentRootIds: expect.any(Set),
        }),
      })
    );
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transaction: patch.entries[1].transaction,
        capabilities: expect.objectContaining({
          appliedTransactionId: patch.entries[0].transaction.id,
        }),
      })
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      1,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      2,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      3,
      { projectId: "project-1", permit: "edit" },
      expect.anything()
    );
  });

  test("advances capabilities for build-permit entries in mixed batches", async () => {
    readAccessToken
      .mockResolvedValueOnce({
        userId: "user-1",
        projectId: "project-1",
        purpose: "collab",
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        projectId: "project-1",
        purpose: "collab",
      });
    hasProjectPermit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const patch: NormalizedPatchRequest = {
      buildId: "build-1",
      projectId: "project-1",
      clientVersion: 1,
      entries: [
        {
          transaction: transaction("props", "tx-build") as never,
          writer: { type: "token", authToken: "token-1" },
        },
        {
          transaction: transaction("props", "tx-edit") as never,
          writer: { type: "token", authToken: "token-2" },
        },
      ],
    };

    const result = await authorizePatchEntries(
      createContext() as never,
      patch,
      () => createContentModeCapabilities(buildRow)
    );

    expect(result.rejected).toEqual([]);
    expect(result.authorized).toHaveLength(2);
    expect(getContentModeCapabilities).toHaveBeenCalledTimes(1);
    expect(applyContentModeTransaction).toHaveBeenCalledTimes(2);
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transaction: patch.entries[1].transaction,
        capabilities: expect.objectContaining({
          appliedTransactionId: patch.entries[0].transaction.id,
        }),
      })
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      1,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      2,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      3,
      { projectId: "project-1", permit: "edit" },
      expect.anything()
    );
  });

  test("creates content-mode capabilities once for multiple content-mode entries", async () => {
    readAccessToken
      .mockResolvedValueOnce({
        userId: "user-1",
        projectId: "project-1",
        purpose: "collab",
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        projectId: "project-1",
        purpose: "collab",
      });
    hasProjectPermit
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const getInitialContentModeCapabilities = vi.fn(() =>
      createContentModeCapabilities(buildRow)
    );

    const patch: NormalizedPatchRequest = {
      buildId: "build-1",
      projectId: "project-1",
      clientVersion: 1,
      entries: [
        {
          transaction: transaction("props", "tx-edit-1") as never,
          writer: { type: "token", authToken: "token-1" },
        },
        {
          transaction: transaction("props", "tx-edit-2") as never,
          writer: { type: "token", authToken: "token-2" },
        },
      ],
    };

    const result = await authorizePatchEntries(
      createContext() as never,
      patch,
      getInitialContentModeCapabilities
    );

    expect(result.rejected).toEqual([]);
    expect(result.authorized).toHaveLength(2);
    expect(getInitialContentModeCapabilities).toHaveBeenCalledTimes(1);
    expect(getContentModeCapabilities).toHaveBeenCalledTimes(1);
    expect(applyContentModeTransaction).toHaveBeenCalledTimes(2);
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        transaction: patch.entries[0].transaction,
        capabilities: expect.objectContaining({
          editablePropIds: expect.any(Set),
          instances: expect.any(Map),
          metas: expect.any(Map),
          props: expect.any(Map),
          styleSources: expect.any(Map),
          styleSourceSelections: expect.any(Map),
          styles: expect.any(Map),
          breakpoints: expect.any(Map),
          contentRootIds: expect.any(Set),
        }),
      })
    );
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transaction: patch.entries[1].transaction,
        capabilities: expect.objectContaining({
          appliedTransactionId: patch.entries[0].transaction.id,
        }),
      })
    );
  });

  test("continues authorizing later build-permit entries after a rejected entry", async () => {
    readAccessToken
      .mockResolvedValueOnce({
        userId: "user-1",
        projectId: "project-1",
        purpose: "collab",
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        projectId: "project-1",
        purpose: "collab",
      });
    hasProjectPermit.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const patch: NormalizedPatchRequest = {
      buildId: "build-1",
      projectId: "project-1",
      clientVersion: 1,
      entries: [
        {
          transaction: transaction("styles", "tx-build") as never,
          writer: { type: "token", authToken: "token-1" },
        },
        {
          transaction: transaction("props", "tx-edit") as never,
          writer: { type: "token", authToken: "token-2" },
        },
      ],
    };

    const result = await authorizePatchEntries(
      createContext() as never,
      patch,
      () => createContentModeCapabilities(buildRow)
    );

    expect(result.rejected).toEqual([
      expect.objectContaining({
        entry: patch.entries[0],
        errors: "You don't have permission to build this project.",
      }),
    ]);
    expect(result.authorized).toEqual([
      expect.objectContaining({
        entry: patch.entries[1],
      }),
    ]);
    expect(applyContentModeTransaction).toHaveBeenCalledTimes(2);
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        transaction: patch.entries[0].transaction,
      })
    );
    expect(applyContentModeTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transaction: patch.entries[1].transaction,
      })
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      1,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
    expect(hasProjectPermit).toHaveBeenNthCalledWith(
      2,
      { projectId: "project-1", permit: "build" },
      expect.anything()
    );
  });

  test("returns rejected entries when a writer does not have the required permit", async () => {
    readAccessToken.mockResolvedValue({
      userId: "user-1",
      projectId: "project-1",
      purpose: "collab",
    });
    hasProjectPermit.mockResolvedValue(false);

    const result = await authorizePatchEntries(
      createContext() as never,
      {
        buildId: "build-1",
        projectId: "project-1",
        clientVersion: 1,
        entries: [
          {
            transaction: transaction("styles") as never,
            writer: { type: "token", authToken: "token-1" },
          },
        ],
      },
      () => createContentModeCapabilities(buildRow)
    );

    expect(result.authorized).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        errors: "You don't have permission to build this project.",
      }),
    ]);
  });
});
