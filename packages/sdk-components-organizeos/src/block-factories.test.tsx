import { expect, test } from "vitest";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { renderTemplate, ws } from "@webstudio-is/template";
import { rotatingTabsTemplate } from "./rotating-tabs.template";
import { rsvpFormTemplate } from "./rsvp-form.template";
import { signupFormTemplate } from "./signup-form.template";

// A site template places a block once per placement, so a factory must give
// each call a Variable of its own: `renderTemplate` keys a data source by the
// Variable object, and a module-level one is shared by every copy in a render,
// scoped to the first copy's root.
test.each([
  { label: "Signup Form", template: signupFormTemplate, name: "formState" },
  { label: "RSVP Form", template: rsvpFormTemplate, name: "rsvpState" },
  { label: "Rotating Tabs", template: rotatingTabsTemplate, name: "activeTab" },
])("two $label blocks in one render keep their own state", (block) => {
  const fragment = renderTemplate(
    <ws.element ws:tag="body">
      {block.template()}
      {block.template()}
    </ws.element>
  );
  const body = fragment.instances.find(
    (instance) => instance.id === fragment.children[0].value
  );
  const roots = (body?.children ?? []).flatMap((child) =>
    child.type === "id" ? [child.value] : []
  );
  expect(roots).toHaveLength(2);

  const variables = fragment.dataSources.filter(
    (dataSource) =>
      dataSource.type === "variable" && dataSource.name === block.name
  );
  expect(variables).toHaveLength(2);
  expect(variables[0].id).not.toBe(variables[1].id);
  expect(variables.map((variable) => variable.scopeInstanceId)).toEqual(roots);

  // Each root reads its own variable, not the first one's.
  roots.forEach((root, index) => {
    const reads = fragment.props.filter(
      (prop) =>
        prop.instanceId === root &&
        prop.type === "expression" &&
        prop.value === encodeDataSourceVariable(variables[index].id)
    );
    expect(reads).toHaveLength(1);
  });
});
