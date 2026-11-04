import { describe, expect, test } from "vitest";
import {
  createTestServer,
  db,
  json,
  testContext,
} from "@webstudio-is/postgrest/testing";
import { parsePlansEnv, type PlanFeatures } from "@webstudio-is/plans";
import { parseProductMeta } from "@webstudio-is/plans/index.server";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import { appRouter } from "./trcp-router.server";
import { assertApiProjectPermit } from "./api-permits.server";
import {
  ORGANIZEOS_PLAN_NAME,
  entitlementProductMeta,
} from "~/shared/db/organizeos-plan.server";

// OrganizeOS fork, owner decision D8 of the 0.309.0 merge: no API token
// reaches an org project. Only a project's owner creates tokens, and an org
// project's owner is the org's synthetic service account; its human admins
// are workspace administrators. The organizeos plan sets
// allowAdditionalPermissions to false, which also refuses every canUseApi
// token, at creation and at use (services/api-permits.server.ts,
// packages/authorization-token/src/db/authorization-token.ts).

const server = createTestServer();

// The organizeos entry of the PLANS env (ORGANIZEOS-FORK.md §3) with D8's
// value. A fixture: the deployment's own PLANS is never read here.
const plansFixture = (allowAdditionalPermissions: boolean) =>
  JSON.stringify([
    {
      name: ORGANIZEOS_PLAN_NAME,
      features: {
        canDownloadAssets: true,
        canRestoreBackups: true,
        allowAdditionalPermissions,
        allowDynamicData: true,
        allowAuth: true,
        allowContentMode: true,
        allowStagingPublish: true,
        maxContactEmailsPerProject: 1000000,
        maxDomainsAllowedPerUser: 1000000,
        maxDailyPublishesPerUser: 1000000,
        maxWorkspaces: 1000000,
        maxProjectsAllowedPerUser: 1000000,
        maxAssetsPerProject: 1000000,
        seatsIncluded: 1000000,
        maxSeatsPerWorkspace: 1000000,
      },
    },
  ]);

// What getPlanInfo resolves for an org's owner: the named plan, then the
// org's entitlement delta from Product.meta on top.
const orgPlanFeatures = (allowAdditionalPermissions: boolean): PlanFeatures => {
  const plan = parsePlansEnv(plansFixture(allowAdditionalPermissions)).get(
    ORGANIZEOS_PLAN_NAME
  );
  if (plan === undefined) {
    throw new Error("The PLANS fixture has no organizeos plan");
  }
  return {
    ...plan.features,
    ...parseProductMeta(entitlementProductMeta({ collections: true })),
  };
};

const serviceOwnerId = "a1b2c3d4-0000-4000-8000-000000000001";
const orgAdminId = "a1b2c3d4-0000-4000-8000-000000000002";

const createContext = (
  authorization: AppContext["authorization"],
  planFeatures: PlanFeatures
) =>
  ({
    ...testContext,
    authorization,
    planFeatures,
    getOwnerPlanFeatures: async () => planFeatures,
  }) as unknown as AppContext;

/** The org's project: owned by the service account, administered by a human. */
const orgProjectHandlers = (projectId: string) => {
  const inserts: unknown[] = [];
  const handlers = [
    db.get("Project", ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get("id")).toBe(`eq.${projectId}`);
      return url.searchParams.get("userId") === `eq.${serviceOwnerId}`
        ? json({ id: projectId })
        : json([]);
    }),
    db.get("WorkspaceProjectAuthorization", ({ request }) => {
      const url = new URL(request.url);
      return url.searchParams.get("userId") === `eq.${orgAdminId}`
        ? json([{ relation: "administrators" }])
        : json([]);
    }),
    db.post("AuthorizationToken", async ({ request }) => {
      inserts.push(await request.json());
      return json([], { status: 201 });
    }),
  ];
  return { handlers, inserts };
};

describe("API tokens on an org project", () => {
  test("an org project's administrator cannot create an API token", async () => {
    const projectId = "b1b2c3d4-0000-4000-8000-000000000001";
    const { handlers, inserts } = orgProjectHandlers(projectId);
    server.use(...handlers);
    // Even under the plan as it was before D8, with the key on.
    const caller = appRouter.createCaller(
      createContext({ type: "user", userId: orgAdminId }, orgPlanFeatures(true))
    );

    for (const canUseApi of [true, false]) {
      await expect(
        caller.authorizationToken.create({
          projectId,
          relation: "administrators",
          name: "Agent",
          canUseApi,
        })
      ).rejects.toMatchObject({
        message:
          "You don't have access to create this project authorization tokens",
      });
    }
    expect(inserts).toEqual([]);
  });

  test("a token with canUseApi is refused when the plan disallows additional permissions", async () => {
    const projectId = "b1b2c3d4-0000-4000-8000-000000000002";
    const { handlers, inserts } = orgProjectHandlers(projectId);
    const planFeatures = orgPlanFeatures(false);
    expect(planFeatures.allowAdditionalPermissions).toBe(false);

    // Created by the project's owner: refused for the plan.
    server.use(...handlers);
    const owner = appRouter.createCaller(
      createContext({ type: "user", userId: serviceOwnerId }, planFeatures)
    );
    await expect(
      owner.authorizationToken.create({
        projectId,
        relation: "viewers",
        name: "Agent",
        canUseApi: true,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API permission requires an upgrade.",
    });
    expect(inserts).toEqual([]);

    // A canUseApi token that already exists: refused at use.
    server.use(
      db.get("AuthorizationToken", () =>
        json({
          token: "existing-api-token",
          projectId,
          name: "Agent",
          relation: "administrators",
          canClone: true,
          canCopy: true,
          canPublish: true,
          canUseApi: true,
          createdAt: "2026-11-01T00:00:00.000Z",
        })
      )
    );
    await expect(
      assertApiProjectPermit(
        createContext(
          { type: "token", authToken: "existing-api-token" },
          planFeatures
        ),
        projectId,
        "view"
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Authorization token cannot use Builder API",
    });
  });
});
