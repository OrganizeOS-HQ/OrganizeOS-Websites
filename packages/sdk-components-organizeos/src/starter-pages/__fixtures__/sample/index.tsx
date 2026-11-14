import { ws } from "@webstudio-is/template";
import { $ } from "../../../shared/proxy";
import { buttonStyles } from "../../../site-templates/kit";
import type { BlockKey } from "../../../site-templates/place-block";
import coverUrl from "../../../site-templates/__fixtures__/spike/images/cover.jpg?url&no-inline";
import type { StarterPage } from "../../types";

// A page template that exists to test the starter-page code: one header with
// the page's h1 and a placeholder photo, a placed Signup Form, and a button
// to the platform's /donate. It is not in the catalog (catalog.ts), so the
// New page screen never offers it; the tests import it from here.

const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";

export const sampleStarterPage: StarterPage = {
  id: "sample",
  name: "Sample",
  pageName: "Sample",
  path: "/sample",
  title: "Sample",
  description: "Say in one sentence what this page is for.",
  status: "draft",
  picture: "picture.jpg",
  images: {
    "picture.jpg": {
      url: coverUrl,
      sourceUrl: "organizeos:generated/__fixtures__/spike/images/generate.py",
      alt: "A picture of the Sample page template",
    },
  },
  blocks: [SignupForm],
  body: ({ placeBlock, look, image }) => (
    <ws.element ws:tag="body">
      <ws.element ws:tag="section" ws:label="Page header">
        <ws.element ws:tag="h1">{"Say what this page is for"}</ws.element>
        <$.Image ws:label="Photo" {...image()} />
      </ws.element>
      <ws.element ws:tag="section" ws:label="Sign-up">
        {placeBlock(SignupForm, "signup")}
      </ws.element>
      <ws.element ws:tag="section" ws:label="Call to action band">
        <$.Link ws:style={buttonStyles(look)} href="/donate" reloadDocument>
          {"Donate"}
        </$.Link>
      </ws.element>
    </ws.element>
  ),
};
