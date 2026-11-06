import { expect, test } from "vitest";
import { createPages } from "./template";

// OrganizeOS fork: a new project's pages carry no "Built with Webstudio"
// badge, which upstream's createPages appends to the 404 page
// (coreTemplates.builtWithWebstudio). An upstream merge that brings it back
// fails here.
test("a new project's pages carry no Built with Webstudio badge", () => {
  const data = createPages();

  for (const instance of data.instances.values()) {
    expect(instance.label).not.toBe("Built with Webstudio");
  }
  for (const prop of data.props.values()) {
    expect(JSON.stringify(prop.value)).not.toContain("webstudio.is");
  }
});
