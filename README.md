# OrganizeOS Websites

The site builder behind [OrganizeOS](https://organizeos.org) websites. Organizations on
OrganizeOS use it to design their public websites element by element and publish them to their
own addresses, with their events, sign-up forms and other OrganizeOS features built in.

It is a fork of [Webstudio](https://github.com/webstudio-is/webstudio), the open-source visual
development platform by Webstudio, Inc., and stays close to it so upstream changes can be merged
in.

## If you followed a link from a website

Every page published with this builder links to its source code in the page's head, at the exact
commit that built it. This repository is that source. The page's own content and design belong to
the organization that published it.

## What this fork changes

- **Sign-in and publishing through OrganizeOS.** Organization admins open the builder from
  OrganizeOS, and publishing puts a site live at the organization's own addresses.
- **OrganizeOS blocks.** Sign-up forms, event lists, RSVP forms and other blocks connected to an
  organization's OrganizeOS data, in `packages/sdk-components-organizeos`.
- **Proprietary code removed.** Upstream's animation components are under a proprietary license
  and are not part of this fork.
- **Unchanged site runtime.** The packages a published site runs on are kept identical to
  upstream's published releases.

Every file this fork adds or changes is listed in
[`docs/ORGANIZEOS-FORK.md`](docs/ORGANIZEOS-FORK.md), section 7, with the reasons in the sections
before it.

## Repository layout

- `apps/builder`: the builder app.
- `packages/cli`: builds and publishes sites, including the templates every published page uses.
- `packages/sdk-components-organizeos`: the OrganizeOS blocks.
- `docs/ORGANIZEOS-FORK.md`: what the fork changes and how it connects to OrganizeOS.

For how the builder itself works, see [Webstudio's documentation](https://docs.webstudio.is/).

## Security

Please do not open a public issue for a security problem. Report it privately to the OrganizeOS
maintainers.

## License

AGPL-3.0-or-later, as upstream Webstudio. The full text is in [`LICENSE`](LICENSE). Webstudio is
copyright Webstudio, Inc. and its contributors; OrganizeOS's changes are released under the same
license.
