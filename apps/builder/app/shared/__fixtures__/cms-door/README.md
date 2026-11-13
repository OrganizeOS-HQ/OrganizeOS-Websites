# CMS door response fixtures

The pinned answers of the CMS door, the server-to-server routes the Website
builder calls under `/api/internal/websites2/cms/{organizationId}`. Spec:
`docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md` (section
5.4); plan: `docs/superpowers/plans/2026-11-10-native-cms-in-the-builder.md`
(Tasks 11b, 13 to 15).

- Each file is one endpoint's answer,
  `{ "status": <n>, "body": <the door body> }`, written from the starting rows
  of the door's test world (`client/tests/helpers/cms-door-world.ts`).
  `door.test.ts` (`client/tests/lib/collections/cms-core/`) and the route tests
  (`client/tests/app/api/internal/cms/`) replay them.
- The builder fork copies every `.json` file here byte for byte to
  `apps/builder/app/shared/__fixtures__/cms-door/`, where its client for the
  door parses each body through that endpoint's schema (fork W1, Task 24).
- A change to a file here needs that copy, and its README note's commit, updated
  in the fork.

| File                 | Endpoint                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `access.json`        | E0, `GET /access`: the owner's three flags                                                 |
| `collections.json`   | E1, `GET /collections`: org A's one collection, with its item total                        |
| `collection.json`    | E2, `GET /collections/{collectionId}`: the collection, each field's kind canonical         |
| `items.json`         | E3, `GET /collections/{collectionId}/items`: page 1, in the collection's order             |
| `item.json`          | E4, `GET /collections/{collectionId}/items/{itemId}`: the staged item, rich text sanitised |
| `search.json`        | E5, `GET /collections/{collectionId}/items/search?ids=…`: another org's id dropped         |
| `item-write.json`    | E6, `POST /collections/{collectionId}/items`: 201, a new draft                             |
| `items-publish.json` | E10, `POST /collections/{collectionId}/items/publish`: one draft published                 |
| `items-status.json`  | E11, `POST …/items/status`: the staged item archived                                       |
| `items-delete.json`  | E12, `POST …/items/delete`: the draft deleted                                              |
| `items-order.json`   | E13, `POST …/items/order`: two rows reordered                                              |
| `upload.json`        | E9, `POST /uploads/image`: a stored PNG (tests compare its shape)                          |

The structure endpoints (slice 3,
`docs/superpowers/specs/2026-11-13-native-cms-slice-3-design.md` 5.5):

| File                                | Endpoint                                           |
| ----------------------------------- | -------------------------------------------------- |
| `structure.json`                    | E20, `GET /structure`: templates and limits        |
| `collection-structure.json`         | E21, `GET /collections/{collectionId}/structure`   |
| `collection-create.json`            | E22, `POST /collections`: 201, a Custom collection |
| `collection-settings.json`          | E23, `PUT /collections/{collectionId}`             |
| `collection-schema.json`            | E24, `PUT /collections/{collectionId}/schema`      |
| `collection-delete.json`            | E25, `POST /collections/{collectionId}/delete`     |
| `collection-delete-referenced.json` | E25: 409 `referenced`                              |
