// OrganizeOS fork: domain.unpublish leaves the builds alone when the
// deployment service refuses (docs/ORGANIZEOS-FORK.md section 7).
import { describe, expect, test } from "vitest";
import {
  createTestServer,
  db,
  empty,
  json,
  testContext,
} from "@webstudio-is/postgrest/testing";
import {
  createCallerFactory,
  type AppContext,
} from "@webstudio-is/trpc-interface/index.server";
import { domainRouter } from "./domain";

const server = createTestServer();
const createCaller = createCallerFactory(domainRouter);

const refusal =
  'To unpublish, use "Switch back to Website Lite" on your site\'s Website page in OrganizeOS.';

const createContext = (unpublish: () => Promise<unknown>): AppContext =>
  ({
    ...testContext,
    authorization: { type: "user", userId: "owner-1" },
    deployment: {
      deploymentTrpc: { unpublish: { mutate: unpublish } },
      env: {
        BUILDER_ORIGIN: "https://builder.example.org",
        GITHUB_REF_NAME: "main",
        GITHUB_SHA: undefined,
        PUBLISHER_HOST: "wstd.io",
      },
    },
  }) as unknown as AppContext;

// One production build holds the domain, so unpublishBuild, once called,
// deletes it: the Build writes below are what a refusal must never reach.
const useProductionBuild = () => {
  const writes = { deleted: false, patched: false, deletedId: "" };
  server.use(
    db.get("Project", () => json({ id: "proj-1" })),
    db.get("Build", () =>
      json([
        {
          id: "build-prod",
          deployment: JSON.stringify({
            destination: "saas",
            domains: ["test"],
          }),
        },
      ])
    ),
    db.delete("Build", ({ request }) => {
      writes.deleted = true;
      writes.deletedId = new URL(request.url).searchParams.get("id") ?? "";
      return empty({ status: 204 });
    }),
    db.patch("Build", () => {
      writes.patched = true;
      return empty({ status: 204 });
    })
  );
  return writes;
};

const unpublish = (context: AppContext) =>
  createCaller(context).unpublish({
    projectId: "proj-1",
    domain: "test.wstd.io",
  });

describe("domain.unpublish", () => {
  test("a refusal from the deployment service changes no build", async () => {
    const writes = useProductionBuild();

    const result = await unpublish(
      createContext(() => Promise.resolve({ success: false, error: refusal }))
    );

    expect(writes).toMatchObject({ deleted: false, patched: false });
    expect(result.success).toBe(false);
    expect(result.message).toContain(refusal);
  });

  test("a deployment service that throws changes no build", async () => {
    const writes = useProductionBuild();

    const result = await unpublish(
      createContext(() => Promise.reject(new Error("unreachable")))
    );

    expect(writes).toMatchObject({ deleted: false, patched: false });
    expect(result.success).toBe(false);
  });

  test("a success unpublishes the build, as upstream", async () => {
    const writes = useProductionBuild();

    const result = await unpublish(
      createContext(() => Promise.resolve({ success: true }))
    );

    expect(writes).toMatchObject({ deleted: true, deletedId: "eq.build-prod" });
    expect(result).toEqual({
      success: true,
      message: "test.wstd.io unpublished",
    });
  });

  test("NOT_IMPLEMENTED unpublishes the build, as upstream", async () => {
    const writes = useProductionBuild();

    const result = await unpublish(
      createContext(() =>
        Promise.resolve({ success: false, error: "NOT_IMPLEMENTED" })
      )
    );

    expect(writes).toMatchObject({ deleted: true, deletedId: "eq.build-prod" });
    expect(result).toEqual({
      success: true,
      message: "test.wstd.io unpublished",
    });
  });
});
