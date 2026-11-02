import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Routes read the environment once, when first imported
const { fake, operations } = vi.hoisted(() => {
  Object.assign(process.env, {
    ORGANIZEOS_AGENT_TOKEN: "agent-secret",
    ORGANIZEOS_PROVISION_TOKEN: "provision-secret",
    POSTGREST_URL: "https://postgrest.test",
    POSTGREST_API_KEY: "postgrest-key",
  });
  return {
    fake: { client: { name: "postgrest" } },
    operations: {
      resolveAgentProject: vi.fn(),
      readOverview: vi.fn(),
      readPage: vi.fn(),
      listImages: vi.fn(),
    },
  };
});

vi.mock("@webstudio-is/postgrest/index.server", () => ({
  createClient: () => fake.client,
}));

vi.mock("~/shared/db/organizeos-agent.server", () => operations);

import { action, loader } from "~/routes/internal.organizeos-agent";

const organizationId = "org-1";
const actorUserId = "8f14e45f-ceea-467f-a8f5-1f1f2d1f0b4e";
const resolvedProject = { projectId: "derived" };

const post = (
  body: unknown,
  {
    token = "agent-secret",
    headers = {},
  }: { token?: string | null; headers?: Record<string, string> } = {}
) =>
  new Request("https://builder.test/internal/organizeos-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token === null ? {} : { Authorization: token }),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const call = async (request: Request) => {
  const response = await action({
    request,
    params: {},
    context: {},
  } as never);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // a plain body
  }
  return { status: response.status, body };
};

const valid = (operation: string, args: unknown = {}) => ({
  organizationId,
  actorUserId,
  operation,
  args,
});

beforeEach(() => {
  operations.resolveAgentProject.mockResolvedValue({
    ok: true,
    result: resolvedProject,
  });
  operations.readOverview.mockReturnValue({ hasWebsite: true, pages: [] });
  operations.readPage.mockReturnValue({
    ok: true,
    result: { page: { id: "page-1" }, sections: [] },
  });
  operations.listImages.mockResolvedValue({
    ok: true,
    result: { images: [] },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("the secret", () => {
  test("unset or empty, the route answers 404 before any other check", async () => {
    const saved = process.env.ORGANIZEOS_AGENT_TOKEN;
    try {
      for (const value of [undefined, ""]) {
        vi.resetModules();
        if (value === undefined) {
          delete process.env.ORGANIZEOS_AGENT_TOKEN;
        } else {
          process.env.ORGANIZEOS_AGENT_TOKEN = value;
        }
        const route = await import("~/routes/internal.organizeos-agent");
        const response = await route.action({
          request: post(valid("website_overview"), { token: value ?? null }),
          params: {},
          context: {},
        } as never);
        expect(response.status).toBe(404);
        // A GET, a bad body: still 404.
        expect(
          (
            await route.action({
              request: new Request(
                "https://builder.test/internal/organizeos-agent"
              ),
              params: {},
              context: {},
            } as never)
          ).status
        ).toBe(404);
        expect((route.loader() as Response).status).toBe(404);
      }
      expect(operations.resolveAgentProject).not.toHaveBeenCalled();
      expect(operations.listImages).not.toHaveBeenCalled();
    } finally {
      process.env.ORGANIZEOS_AGENT_TOKEN = saved;
      vi.resetModules();
    }
  });

  test("a wrong or missing token answers 401", async () => {
    expect(
      (await call(post(valid("website_overview"), { token: "nope" }))).status
    ).toBe(401);
    expect(
      (await call(post(valid("website_overview"), { token: null }))).status
    ).toBe(401);
    // The provisioning token is not this route's secret.
    expect(
      (
        await call(
          post(valid("website_overview"), { token: "provision-secret" })
        )
      ).status
    ).toBe(401);
    expect(operations.resolveAgentProject).not.toHaveBeenCalled();
  });

  test("a request carrying a cookie answers 401, even with the right token", async () => {
    const { status } = await call(
      post(valid("website_overview"), { headers: { Cookie: "session=1" } })
    );
    expect(status).toBe(401);
    expect(operations.resolveAgentProject).not.toHaveBeenCalled();
  });
});

describe("the method", () => {
  test("GET answers 405", async () => {
    const { status } = await call(
      new Request("https://builder.test/internal/organizeos-agent", {
        method: "GET",
        headers: { Authorization: "agent-secret" },
      })
    );
    expect(status).toBe(405);
    expect((loader() as Response).status).toBe(405);
  });
});

describe("the body", () => {
  test.each([
    ["an unknown operation", valid("website_publish")],
    [
      "an unknown top-level key",
      { ...valid("website_overview"), projectId: "p" },
    ],
    ["an unknown args key", valid("website_overview", { pageId: "page-1" })],
    [
      "an unknown read_page args key",
      valid("website_read_page", { pageId: "page-1", instanceId: "i" }),
    ],
    ["a missing pageId", valid("website_read_page", {})],
    ["an empty pageId", valid("website_read_page", { pageId: "" })],
    [
      "a pageId over 64 characters",
      valid("website_read_page", { pageId: "p".repeat(65) }),
    ],
    ["a non-string pageId", valid("website_read_page", { pageId: 7 })],
    [
      "missing args",
      { organizationId, actorUserId, operation: "website_overview" },
    ],
    [
      "an empty organizationId",
      { ...valid("website_overview"), organizationId: "" },
    ],
    [
      "an actorUserId that is not a uuid",
      { ...valid("website_overview"), actorUserId: "user-1" },
    ],
  ])("%s answers 400 invalid_input", async (_name, body) => {
    expect(await call(post(body))).toEqual({
      status: 400,
      body: { ok: false, code: "invalid_input" },
    });
    expect(operations.resolveAgentProject).not.toHaveBeenCalled();
    expect(operations.listImages).not.toHaveBeenCalled();
  });

  test("a body that is not JSON answers 400 invalid_input", async () => {
    expect(await call(post("{not json"))).toEqual({
      status: 400,
      body: { ok: false, code: "invalid_input" },
    });
  });
});

describe("the operations", () => {
  test("website_overview resolves the org's project and reads its overview", async () => {
    const { status, body } = await call(post(valid("website_overview")));
    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      result: { hasWebsite: true, pages: [] },
    });
    expect(operations.resolveAgentProject).toHaveBeenCalledWith(
      fake.client,
      organizationId
    );
    expect(operations.readOverview).toHaveBeenCalledWith(resolvedProject);
  });

  test("website_read_page reads the page id inside the resolved project", async () => {
    const { status, body } = await call(
      post(valid("website_read_page", { pageId: "page-1" }))
    );
    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      result: { page: { id: "page-1" }, sections: [] },
    });
    expect(operations.resolveAgentProject).toHaveBeenCalledWith(
      fake.client,
      organizationId
    );
    expect(operations.readPage).toHaveBeenCalledWith(resolvedProject, {
      pageId: "page-1",
    });
  });

  test("website_list_images lists the org's images", async () => {
    const { status, body } = await call(post(valid("website_list_images")));
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, result: { images: [] } });
    expect(operations.listImages).toHaveBeenCalledWith(
      fake.client,
      organizationId
    );
    expect(operations.resolveAgentProject).not.toHaveBeenCalled();
  });

  test("no project answers 200 not_found", async () => {
    operations.resolveAgentProject.mockResolvedValue({
      ok: false,
      code: "not_found",
    });
    expect(await call(post(valid("website_overview")))).toEqual({
      status: 200,
      body: { ok: false, code: "not_found" },
    });
    expect(
      await call(post(valid("website_read_page", { pageId: "page-1" })))
    ).toEqual({ status: 200, body: { ok: false, code: "not_found" } });
    expect(operations.readOverview).not.toHaveBeenCalled();
    expect(operations.readPage).not.toHaveBeenCalled();
  });

  test("a page not in the project answers 200 not_found", async () => {
    operations.readPage.mockReturnValue({ ok: false, code: "not_found" });
    expect(
      await call(post(valid("website_read_page", { pageId: "elsewhere" })))
    ).toEqual({ status: 200, body: { ok: false, code: "not_found" } });
  });

  test("a thrown error answers 500 unavailable, with no detail in the answer or the log", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    operations.resolveAgentProject.mockRejectedValue(
      Object.assign(new Error(`invalid input for ${organizationId}`), {
        code: "22P02",
      })
    );
    const { status, body } = await call(
      post(valid("website_read_page", { pageId: "page-secret" }))
    );
    expect(status).toBe(500);
    expect(body).toEqual({ ok: false, code: "unavailable" });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("website_read_page");
    expect(logged).not.toContain(organizationId);
    expect(logged).not.toContain("page-secret");
    expect(logged).not.toContain(actorUserId);
    expect(logged).not.toContain("invalid input");
  });
});
