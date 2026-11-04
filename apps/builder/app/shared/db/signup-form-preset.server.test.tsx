import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createScope,
  encodeDataSourceVariable,
  generateManagedFormResources,
  getFormActions,
  isFormSubmission,
  validateFormSubmission,
  type Prop,
} from "@webstudio-is/sdk";
import { formDataParameterName } from "@webstudio-is/sdk/runtime";
import {
  buildSignupFormData,
  SIGNUP_FORM_FIELD_NAMES,
  SIGNUP_RESOURCE_NAME,
} from "./signup-form-preset.server";

const args = {
  projectId: "project-1",
  apiBaseUrl: "https://app.example.org/api/public/v1",
  readToken: "osk_secrettoken",
};

const build = () => buildSignupFormData(args);

const findSignup = async () => {
  const { data, bodyId } = await build();
  const form = [...data.instances.values()].find(
    (instance) => instance.component === "ResourceForm"
  );
  const signup = [...data.resources.values()].find(
    (resource) => resource.name === SIGNUP_RESOURCE_NAME
  );
  return { data, bodyId, form, signup };
};

describe("buildSignupFormData", () => {
  // Owner decision D15 of the 0.309.0 merge: the provisioned form is the
  // managed Form, persisted as ResourceForm, whose action is a Resource the
  // server runs. It is written as ResourceForm itself, so no
  // formComponentIdentityVersion marker is needed to read it as one (see
  // signup-form-preset.merge.server.test.tsx).
  test("a new /newsletter form is a ResourceForm with its action Resource", async () => {
    const { data, bodyId, form, signup } = await findSignup();
    const body = data.instances.get(bodyId);
    expect(body?.component).toBe("ws:element");
    expect(body?.tag).toBe("body");
    expect(body?.children).toEqual([{ type: "id", value: form?.id }]);
    // no deprecated Webhook Form, and no Form a marker would have to name
    expect(
      [...data.instances.values()].filter((instance) =>
        ["Form", "WebhookForm", "NativeForm"].includes(instance.component)
      )
    ).toEqual([]);

    // The action names one Resource destination, as upstream validates it.
    const props = [...data.props.values()].filter(
      (prop) => prop.instanceId === form?.id
    );
    const action = props.find((prop) => prop.name === "action");
    expect(action?.type).toBe("json");
    const value = (action as Extract<Prop, { type: "json" }>).value;
    expect(isFormSubmission(value)).toBe(true);
    if (isFormSubmission(value) === false) {
      return;
    }
    expect(validateFormSubmission(value)).toBeUndefined();
    const [destinationId] = getFormActions(value);
    const destination = data.dataSources.get(destinationId);
    expect(destination).toMatchObject({
      type: "resource",
      scopeInstanceId: form?.id,
      resourceId: signup?.id,
    });

    // It posts the form's fields to /v1/signups, server-side.
    const formData = [...data.dataSources.values()].find(
      (dataSource) =>
        dataSource.type === "parameter" &&
        dataSource.name === formDataParameterName
    );
    expect(formData?.scopeInstanceId).toBe(form?.id);
    expect(props).toContainEqual(
      expect.objectContaining({
        name: formDataParameterName,
        type: "parameter",
        value: formData?.id,
      })
    );
    expect(signup).toMatchObject({
      method: "post",
      url: `"https://app.example.org/api/public/v1/signups"`,
      body: encodeDataSourceVariable(formData!.id),
    });

    // The published site's generator builds the submission graph from it.
    const generated = generateManagedFormResources({
      scope: createScope(),
      instances: data.instances,
      dataSources: data.dataSources,
      resources: data.resources,
      props: data.props,
      forms: [{ formId: form!.id, destinationDataSourceIds: [destinationId] }],
    });
    expect(generated).toContain(`case ${JSON.stringify(form!.id)}: {`);
    expect(generated).toContain(`rootIds: ${JSON.stringify([signup!.id])}`);
    expect(generated).toContain(
      JSON.stringify("https://app.example.org/api/public/v1/signups")
    );
  });

  test("inlines the org token into the action Authorization header as a literal", async () => {
    const { data, signup } = await findSignup();

    // No token variable: variables are instance-scoped and page codegen drops
    // out-of-scope ones (publish spike produced "Bearer " + undefined).
    expect(
      [...data.dataSources.values()].some(
        (d) => d.type === "variable" && d.name === "Site read token"
      )
    ).toBe(false);

    const auth = signup?.headers.find((h) => h.name === "Authorization");
    expect(auth?.value).toBe(`"Bearer osk_secrettoken"`);
    // so the endpoint receives JSON
    expect(signup?.headers).toContainEqual({
      name: "Content-Type",
      value: `"application/json"`,
    });
  });

  test("uses input names that match the /v1/signups schema keys", async () => {
    const { data } = await build();
    const inputNames = [...data.props.values()]
      .filter((p) => p.name === "name" && p.type === "string")
      .map((p) => (p.type === "string" ? p.value : ""));
    for (const field of SIGNUP_FORM_FIELD_NAMES) {
      expect(inputNames).toContain(field);
    }
  });

  test("wires a formState variable for success/error visibility", async () => {
    const { data, form } = await findSignup();
    const formState = [...data.dataSources.values()].find(
      (d) => d.type === "variable" && d.name === "formState"
    );
    expect(formState).toBeDefined();
    const onStateChange = [...data.props.values()].find(
      (prop) => prop.instanceId === form?.id && prop.name === "onStateChange"
    );
    expect(onStateChange).toMatchObject({
      type: "action",
      value: [
        {
          type: "execute",
          args: ["state"],
          code: `${encodeDataSourceVariable(formState!.id)} = state`,
        },
      ],
    });
  });

  test("is deterministic per project and differs across projects", async () => {
    const a1 = await build();
    const a2 = await build();
    expect([...a1.data.instances.keys()].sort()).toEqual(
      [...a2.data.instances.keys()].sort()
    );
    expect([...a1.data.resources.keys()]).toEqual([
      ...a2.data.resources.keys(),
    ]);
    expect(a1.bodyId).toBe(a2.bodyId);

    const b = await buildSignupFormData({ ...args, projectId: "project-2" });
    expect(b.bodyId).not.toBe(a1.bodyId);
    expect(b.pageId).not.toBe(a1.pageId);
  });

  test("trims a trailing slash on the API base URL", async () => {
    const { data } = await buildSignupFormData({
      ...args,
      apiBaseUrl: "https://app.example.org/api/public/v1/",
    });
    const signup = [...data.resources.values()].find(
      (r) => r.name === SIGNUP_RESOURCE_NAME
    );
    expect(signup?.url).toBe(`"https://app.example.org/api/public/v1/signups"`);
  });
});

// The form a provisioned org gets, as the published-site case in
// packages/cli/src/prebuild.test.ts ("the provisioned ResourceForm submits to
// /v1/signups on its published site") builds and posts it. Regenerate after a
// change to the preset: UPDATE_SIGNUP_FORM_FIXTURE=1, then this test.
describe("the published-site fixture", () => {
  const fixtureArgs = {
    projectId: "0f1e2d3c-4b5a-4697-8877-665544332211",
    apiBaseUrl: "https://app.organizeos.org/api/public/v1",
    readToken: "osk_signup_fixture",
  };
  const fixturePath = fileURLToPath(
    new URL("./__fixtures__/signup-form.json", import.meta.url)
  );

  test("is the form the preset builds", async () => {
    const { data, bodyId, pageId } = await buildSignupFormData(fixtureArgs);
    const built = {
      ...fixtureArgs,
      bodyId,
      pageId,
      instances: [...data.instances.values()],
      props: [...data.props.values()],
      dataSources: [...data.dataSources.values()],
      resources: [...data.resources.values()],
    };
    if (process.env.UPDATE_SIGNUP_FORM_FIXTURE === "1") {
      writeFileSync(fixturePath, `${JSON.stringify(built, null, 2)}\n`);
    }
    expect(JSON.parse(readFileSync(fixturePath, "utf8"))).toEqual(built);
  });
});
