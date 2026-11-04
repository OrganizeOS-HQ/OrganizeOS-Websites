import { expect, test } from "vitest";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { renderTemplate, ws } from "@webstudio-is/template";
import { rotatingTabsTemplate } from "./rotating-tabs.template";
import { rsvpFormTemplate } from "./rsvp-form.template";
import { signupFormTemplate } from "./signup-form.template";
import { $, organizeos, radix } from "./shared/proxy";
import * as siteTemplates from "./site-templates";

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

// 0.309.0 removed the template package's createProxy, and its renderer names a
// component only by the object a template passes or by upstream's component
// marker (createTemplateComponentFixture, tagged @internal). The blocks and
// the site templates name every component through shared/proxy.ts, so an
// upstream change to that marker fails here first.
test("a proxied component renders as its namespaced id", () => {
  expect(renderTemplate(<organizeos.SignupForm />).instances[0].component).toBe(
    "@organizeos/site-components:SignupForm"
  );
  expect(renderTemplate(<radix.Sheet />).instances[0].component).toBe(
    "@webstudio-is/sdk-components-react-radix:Sheet"
  );
  expect(renderTemplate(<$.Link />).instances[0].component).toBe("Link");
  // the same name is the same marker, and a symbol is not a component
  expect(organizeos.SignupForm).toBe(organizeos.SignupForm);
  expect(Reflect.get(organizeos, Symbol.iterator)).toBe(undefined);
  // the builder reads the same markers from the site-templates entry
  expect(siteTemplates.$).toBe($);
  expect(siteTemplates.organizeos).toBe(organizeos);
  expect(siteTemplates.radix).toBe(radix);
  expect(siteTemplates.localStylesFirst).toEqual(expect.any(Function));
});
