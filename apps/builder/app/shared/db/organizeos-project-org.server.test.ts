import { describe, expect, test } from "vitest";
import {
  resolveProjectOrganization,
  type ProjectOrganizationClient,
} from "./organizeos-project-org.server";

const projectId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Rows = {
  Project?: Record<string, unknown> | null;
  User?: Record<string, unknown> | null;
  failing?: "Project" | "User";
};

/** Answers each table's row, recording every filter it was asked for. */
const clientWith = (rows: Rows) => {
  const filters: Array<[string, string, unknown]> = [];
  const client: ProjectOrganizationClient = {
    from: (table) => ({
      select: () => {
        const query = {
          eq: (column: string, value: unknown) => {
            filters.push([table, column, value]);
            return query;
          },
          maybeSingle: async () =>
            rows.failing === table
              ? { data: null, error: { message: "connection refused" } }
              : {
                  data:
                    (table === "Project" ? rows.Project : rows.User) ?? null,
                  error: null,
                },
        };
        return query;
      },
    }),
  };
  return { client, filters };
};

const serviceOwner = {
  provider: "organizeos-service",
  email: `org+${organizationId}@svc.organizeos.internal`,
};

describe("resolveProjectOrganization", () => {
  test("a project its org's service account owns answers the org id, read from the live project", async () => {
    const { client, filters } = clientWith({
      Project: { userId: "owner-1" },
      User: serviceOwner,
    });
    expect(await resolveProjectOrganization(client, projectId)).toEqual({
      organizationId,
    });
    expect(filters).toEqual([
      ["Project", "id", projectId],
      ["Project", "isDeleted", false],
      ["User", "id", "owner-1"],
    ]);
  });

  test("a human owner is no org, even with the service account's email", async () => {
    for (const email of ["someone@example.org", serviceOwner.email]) {
      const { client } = clientWith({
        Project: { userId: "owner-1" },
        User: { provider: "github", email },
      });
      expect(await resolveProjectOrganization(client, projectId)).toEqual({
        none: true,
      });
    }
  });

  test("a deleted or ownerless project is no org", async () => {
    for (const project of [null, { userId: null }]) {
      const { client } = clientWith({ Project: project, User: serviceOwner });
      expect(await resolveProjectOrganization(client, projectId)).toEqual({
        none: true,
      });
    }
  });

  test("an org id that is not a UUID is no org", async () => {
    for (const email of [
      "org+hq@svc.organizeos.internal",
      `org+${organizationId}x@svc.organizeos.internal`,
      null,
    ]) {
      const { client } = clientWith({
        Project: { userId: "owner-1" },
        User: { provider: "organizeos-service", email },
      });
      expect(await resolveProjectOrganization(client, projectId)).toEqual({
        none: true,
      });
    }
  });

  test("a read error of the project or its owner answers failed", async () => {
    for (const failing of ["Project", "User"] as const) {
      const { client } = clientWith({
        Project: { userId: "owner-1" },
        User: serviceOwner,
        failing,
      });
      expect(await resolveProjectOrganization(client, projectId)).toEqual({
        failed: true,
      });
    }
  });
});
