/**
 * An in-memory `CmsSource` with sample content for a fictional labor
 * organization, the Eastbrook Allied Workers Union. It feeds the storybook
 * preview of the native CMS screen before the platform door exists.
 *
 * Writes change memory with the platform's rules for drafts, staged changes,
 * publishing and the edit lock. `flags` simulates a conflict and each
 * refusal.
 */
import { getItemTitle, isSameValue, isSlug, slugify } from "./cms-logic";
import {
  CMS_BULK_MAX,
  CMS_IMAGE_MAX_BYTES,
  CMS_IMAGE_TYPES,
  CMS_PAGE_SIZE,
  CMS_SEARCH_IDS_MAX,
  type CmsAccess,
  type CmsCollection,
  type CmsErrorCode,
  type CmsFailure,
  type CmsField,
  type CmsImageValue,
  type CmsItem,
  type CmsItemData,
  type CmsItemRow,
  type CmsItemStatus,
  type CmsSortKey,
  type CmsRichTextValue,
  type CmsSource,
} from "./cms-source";

export type SampleCmsFlags = {
  /** Every call answers with this code: a refusal for the whole screen. */
  refuse?: CmsErrorCode;
  /** Writes answer with this code; reads still work. */
  refuseWrites?: CmsErrorCode;
  /**
   * The next write finds the item changed by someone else: the sample edits
   * one field and moves the lock, then answers `conflict`.
   */
  conflictOnNextWrite?: boolean;
  /**
   * The next write lands, then answers `unavailable`, as a timeout whose
   * write went through: the editor's unknown-outcome rule reads it back.
   */
  lostAnswerOnNextWrite?: boolean;
  /** Milliseconds each call waits. */
  latency?: number;
};

export type SampleCmsSource = CmsSource & {
  flags: SampleCmsFlags;
  /** The access E0 answers with. */
  access: CmsAccess;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A PostgREST timestamp, the edit lock's raw form. */
const toPostgrestTimestamp = (time: number) =>
  new Date(time).toISOString().replace("Z", "000+00:00");

const uuid = (group: number, index: number) =>
  `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${index
    .toString(16)
    .padStart(12, "0")}`;

export const SAMPLE_COLLECTION_IDS = {
  news: uuid(1, 0),
  campaigns: uuid(2, 0),
  leadership: uuid(3, 0),
  locals: uuid(4, 0),
} as const;

/** Items the stories open. */
export const SAMPLE_ITEM_IDS = {
  /** Published, with staged changes. */
  safeStaffingNow: uuid(2, 1),
  /** Published, every field kind set. */
  fairContract2027: uuid(2, 2),
  /** A draft whose story holds an image: read-only rich text. */
  childcareStipend: uuid(2, 9),
  /** A Lite-era photo, a bare URL string. */
  lenaFischer: uuid(3, 7),
} as const;

/** About 80 characters a name, for the stories that check truncation. */
const longCollectionNames: Record<string, string> = {
  news: "News and bargaining updates from every local, unit and chapter across Eastbrook",
  campaigns:
    "Campaigns for the 2027 statewide master agreement and every bargaining unit",
  leadership:
    "Leadership, stewards and executive board members of the Eastbrook Allied Workers",
  locals:
    "Locals and chapters across the Eastbrook metropolitan region and the county",
};

const lengthen = (title: string) =>
  `${title}: what members across every Eastbrook local need to know this year`;

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Sample content, not interface colour: the pictures are field values. */
const coverPalette = [
  ["#1f4e79", "#3f8fd2"],
  ["#7a2e1f", "#d2693f"],
  ["#1f5c3a", "#47b27a"],
  ["#4b2a6b", "#9a62c9"],
  ["#5c4a12", "#d1a93a"],
  ["#173c46", "#2f9bb0"],
] as const;

const coverImage = (index: number, label: string): CmsImageValue => {
  const [from, to] = coverPalette[index % coverPalette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><g fill="#fff" fill-opacity="0.14"><circle cx="980" cy="140" r="220"/><circle cx="1100" cy="520" r="160"/><rect x="80" y="120" width="420" height="24" rx="12"/><rect x="80" y="170" width="300" height="24" rx="12"/></g><text x="80" y="540" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700" fill="#fff">${label}</text></svg>`;
  return {
    url: svgDataUri(svg),
    alt: label,
    width: 1200,
    height: 630,
    path: `sample/collections/cover-${index}.svg`,
  };
};

const portraitImage = (index: number, name: string): CmsImageValue => {
  const [from, to] = coverPalette[(index + 2) % coverPalette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${to}"/><stop offset="1" stop-color="${from}"/></linearGradient></defs><rect width="480" height="480" fill="url(#g)"/><circle cx="240" cy="190" r="92" fill="#fff" fill-opacity="0.85"/><path d="M80 480c0-100 72-170 160-170s160 70 160 170z" fill="#fff" fill-opacity="0.85"/></svg>`;
  return {
    url: svgDataUri(svg),
    alt: name,
    width: 480,
    height: 480,
    path: `sample/collections/portrait-${index}.svg`,
  };
};

const richText = (html: string): CmsRichTextValue => ({
  html,
  text: html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .trim(),
});

type SampleField = CmsField;

const newsFields: SampleField[] = [
  {
    key: "title",
    label: "Headline",
    kind: "text",
    isTitle: true,
    required: true,
    maxLength: 120,
  },
  {
    key: "summary",
    label: "Summary",
    kind: "textarea",
    help: "Lists and link previews show it.",
    maxLength: 280,
  },
  { key: "body", label: "Body", kind: "richtext" },
  { key: "cover", label: "Cover image", kind: "image" },
  { key: "publishedOn", label: "Date", kind: "date", required: true },
  {
    key: "category",
    label: "Category",
    kind: "option",
    options: [
      { value: "bargaining", label: "Bargaining" },
      { value: "organizing", label: "Organizing" },
      { value: "safety", label: "Health and safety" },
      { value: "community", label: "Community" },
    ],
  },
  {
    key: "author",
    label: "Author",
    kind: "reference",
    reference: {
      collectionId: SAMPLE_COLLECTION_IDS.leadership,
      multiple: false,
    },
  },
  {
    key: "campaigns",
    label: "Campaigns",
    kind: "multireference",
    reference: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      multiple: true,
    },
  },
  { key: "featured", label: "Featured", kind: "switch" },
];

/** Every one of the 15 kinds, in schema order. */
const campaignFields: SampleField[] = [
  {
    key: "name",
    label: "Name",
    kind: "text",
    isTitle: true,
    required: true,
    maxLength: 80,
  },
  { key: "summary", label: "Summary", kind: "textarea", maxLength: 280 },
  { key: "story", label: "Story", kind: "richtext" },
  { key: "cover", label: "Cover image", kind: "image" },
  { key: "petition", label: "Petition link", kind: "link" },
  { key: "contactEmail", label: "Contact email", kind: "email" },
  { key: "hotline", label: "Hotline", kind: "phone" },
  {
    key: "signatureGoal",
    label: "Signature goal",
    kind: "number",
    help: "The petition's progress bar counts toward it.",
  },
  { key: "launchDate", label: "Launch date", kind: "date" },
  { key: "rallyAt", label: "Next rally", kind: "datetime" },
  { key: "isFeatured", label: "Featured on home", kind: "switch" },
  { key: "accent", label: "Accent color", kind: "color" },
  {
    key: "stage",
    label: "Stage",
    kind: "option",
    required: true,
    options: [
      { value: "organizing", label: "Organizing" },
      { value: "active", label: "Active" },
      { value: "won", label: "Won" },
      { value: "paused", label: "Paused" },
    ],
  },
  {
    key: "lead",
    label: "Lead organizer",
    kind: "reference",
    reference: {
      collectionId: SAMPLE_COLLECTION_IDS.leadership,
      multiple: false,
    },
  },
  {
    key: "relatedNews",
    label: "Related news",
    kind: "multireference",
    reference: { collectionId: SAMPLE_COLLECTION_IDS.news, multiple: true },
  },
];

/** Stored before the kinds were renamed: `url` and `boolean` (E2 as is). */
const leadershipFields: SampleField[] = [
  {
    key: "name",
    label: "Name",
    kind: "text",
    isTitle: true,
    required: true,
    maxLength: 80,
  },
  { key: "role", label: "Role", kind: "text", required: true },
  { key: "bio", label: "Bio", kind: "textarea" },
  { key: "photo", label: "Photo", kind: "image" },
  { key: "email", label: "Email", kind: "email" },
  { key: "phone", label: "Phone", kind: "phone" },
  { key: "website", label: "Website", kind: "link" },
  { key: "onBoard", label: "On the executive board", kind: "switch" },
  {
    key: "local",
    label: "Home local",
    kind: "reference",
    reference: { collectionId: SAMPLE_COLLECTION_IDS.locals, multiple: false },
  },
];

const localFields: SampleField[] = [
  {
    key: "name",
    label: "Name",
    kind: "text",
    isTitle: true,
    required: true,
  },
  { key: "number", label: "Local number", kind: "number", required: true },
  { key: "city", label: "City", kind: "text" },
  { key: "meetingAt", label: "Next meeting", kind: "datetime" },
];

type SampleItem = {
  id: string;
  slug: string;
  status: CmsItemStatus;
  /** The working values: staged ones while `hasStagedChanges`. */
  data: CmsItemData;
  /** What the published site shows; null before the first publish. */
  liveData: CmsItemData | null;
  liveSlug: string | null;
  hasStagedChanges: boolean;
  updatedAt: string;
  createdAt: string;
  publishedAt: string | null;
  /** Who made the last change. */
  modifiedByName?: string;
};

type SampleCollection = CmsCollection & {
  items: SampleItem[];
};

const leaders = [
  ["Maria Okafor", "President"],
  ["Marcus Hale", "Vice President"],
  ["Daniel Reyes", "Secretary-Treasurer"],
  ["Priya Natarajan", "Organizing Director"],
  ["Tom Kowalski", "Chief Steward"],
  ["Aisha Bello", "Political Director"],
  ["Lena Fischer", "Communications Director"],
] as const;

const campaigns = [
  "Safe Staffing Now",
  "Fair Contract 2027",
  "Heat Safety Standard",
  "Transit Pass for All",
  "Night Shift Differential",
  "Paid Family Leave",
  "Respect at Work",
  "Clean Air in the Depots",
  "Childcare Stipend",
] as const;

const newsSubjects = [
  "Hospital workers",
  "Bus drivers",
  "Food service staff",
  "School custodians",
  "Warehouse crews",
  "Home care aides",
  "Hotel housekeepers",
  "City librarians",
] as const;

const newsActions = [
  "ratify a new contract",
  "win safe staffing language",
  "file for a union election",
  "rally for heat protections",
  "secure back pay",
  "elect new stewards",
  "launch a petition drive",
  "testify at city hall",
] as const;

const spotlightNames = [
  "Rosa Delgado",
  "Kwame Mensah",
  "Hannah Brooks",
  "Luis Ortega",
  "Mei Lin",
  "Samuel Adeyemi",
  "Grace Whitfield",
  "Omar Haddad",
  "Nadia Petrova",
  "Elijah Carter",
  "Ines Moreau",
  "Victor Nunez",
] as const;

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const rightsTopics = [
  "breaks and meal periods",
  "overtime pay",
  "reporting an injury",
  "a Weingarten meeting",
  "heat on the job",
  "scheduling notice",
  "sick leave",
  "your personnel file",
  "a discipline hearing",
  "workplace harassment",
  "a layoff notice",
  "joining a picket",
] as const;

/** 120 headlines, mixed by a fixed shuffle so runs match. */
const newsHeadlines = () => {
  const headlines: string[] = [];
  for (const subject of newsSubjects) {
    for (const action of newsActions) {
      headlines.push(`${subject} ${action}`);
    }
  }
  for (let session = 1; session <= 20; session += 1) {
    headlines.push(`Bargaining update: session ${session}`);
  }
  for (const name of spotlightNames) {
    headlines.push(`Member spotlight: ${name}`);
  }
  for (const month of months) {
    headlines.push(`Steward training, ${month} cohort`);
  }
  for (const topic of rightsTopics) {
    headlines.push(`Know your rights: ${topic}`);
  }
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = headlines.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [headlines[index], headlines[other]] = [headlines[other], headlines[index]];
  }
  return headlines;
};

const dateOnly = (time: number) => new Date(time).toISOString().slice(0, 10);

const buildCollections = (
  now: number,
  longNames: boolean
): SampleCollection[] => {
  const stamp = (ago: number) => toPostgrestTimestamp(now - ago);
  const title = (name: string) => (longNames ? lengthen(name) : name);

  const item = ({
    id,
    data,
    status,
    staged,
    ago,
    titleKey,
  }: {
    id: string;
    data: CmsItemData;
    status: CmsItemStatus;
    staged?: CmsItemData;
    ago: number;
    titleKey: string;
  }): SampleItem => {
    const slug = slugify(String(data[titleKey] ?? ""));
    const wasPublished = status !== "draft";
    return {
      id,
      slug,
      status,
      data: staged === undefined ? data : { ...data, ...staged },
      liveData: wasPublished ? data : null,
      liveSlug: wasPublished ? slug : null,
      hasStagedChanges: status === "published" && staged !== undefined,
      updatedAt: stamp(ago),
      createdAt: stamp(ago + 9 * DAY),
      publishedAt: wasPublished ? stamp(ago + HOUR) : null,
    };
  };

  const leaderItems = leaders.map(([name, role], index) =>
    item({
      id: uuid(3, index + 1),
      titleKey: "name",
      status: index === 6 ? "draft" : "published",
      ago: (index + 1) * 3 * DAY,
      data: {
        name,
        role,
        bio: `${name.split(" ")[0]} has worked in the Eastbrook transit and health systems for over a decade and was elected ${role.toLowerCase()} in 2025.`,
        // the last one was saved by Lite, as a bare URL
        photo:
          index === 6
            ? portraitImage(index, name).url
            : portraitImage(index, name),
        email: `${name.split(" ")[0].toLowerCase()}@eastbrookworkers.example`,
        phone: `(555) 014-${String(2200 + index * 17).padStart(4, "0")}`,
        website: `https://eastbrookworkers.example/leadership/${slugify(name)}`,
        onBoard: index < 3,
        local: null,
      },
    })
  );

  const headlines = newsHeadlines().map(title);
  const newsItems = headlines.map((headline, index) => {
    const status: CmsItemStatus =
      index === 0 || index === 1 || index === 7 || index === 23
        ? "draft"
        : index % 17 === 11
          ? "archived"
          : "published";
    const ago =
      index === 0 ? 12 * MINUTE : index === 1 ? 3 * HOUR : index * 1.7 * DAY;
    const categories = ["bargaining", "organizing", "safety", "community"];
    return item({
      id: uuid(1, index + 1),
      titleKey: "title",
      status,
      ago,
      staged:
        status === "published" && (index === 2 || index === 5 || index === 30)
          ? {
              summary: `${headline}: corrected figures from the members' meeting.`,
            }
          : undefined,
      data: {
        title: headline,
        summary: `${headline}. Read what members won, what comes next, and how to get involved.`,
        body: richText(
          `<p>${headline}. Members met on Tuesday evening and voted to move forward.</p><p>Read the full statement from the <a href="https://eastbrookworkers.example/bargaining">bargaining committee</a>.</p>`
        ),
        cover:
          index % 4 === 0 ? coverImage(index, headline.split(":")[0]) : null,
        publishedOn: dateOnly(now - ago),
        category: categories[index % categories.length],
        author: leaderItems[index % leaderItems.length].id,
        campaigns: index % 3 === 0 ? [uuid(2, (index % 9) + 1)] : [],
        featured: index % 11 === 0,
      },
    });
  });

  const campaignStatuses: CmsItemStatus[] = [
    "published",
    "published",
    "draft",
    "archived",
    "published",
    "draft",
    "published",
    "published",
    "draft",
  ];
  const campaignItems = campaigns.map(title).map((name, index) =>
    item({
      id: uuid(2, index + 1),
      titleKey: "name",
      status: campaignStatuses[index],
      ago: index === 0 ? 2 * HOUR : index === 1 ? 25 * MINUTE : index * 4 * DAY,
      staged:
        index === 0
          ? {
              summary:
                "One nurse for every four patients on every shift, written into the contract and enforced.",
              signatureGoal: 7500,
            }
          : undefined,
      data: {
        name,
        summary:
          index === 0
            ? "Safe ratios on every ward, every shift."
            : `${name}: what we are asking for, who it covers, and how to add your name.`,
        story: richText(
          `<p>Across Eastbrook, members are organizing for <strong>${name.toLowerCase()}</strong>. Management has had two years to fix it.</p>${
            // saved by the classic CMS with a picture: read-only here
            index === 8
              ? `<p><img src="${coverImage(index, campaigns[index]).url}" alt="Members at the childcare rally"></p>`
              : ""
          }<p>Sign the petition, then bring a coworker to the next <em>general meeting</em>.<br>Every signature is counted at the table.</p><hr><p>Questions? Ask your <a href="https://eastbrookworkers.example/stewards">steward</a>.</p>`
        ),
        cover: coverImage(index, campaigns[index]),
        petition: `https://eastbrookworkers.example/petitions/${slugify(name)}`,
        contactEmail: "campaigns@eastbrookworkers.example",
        hotline: "(555) 014-3300",
        signatureGoal: 5000 + index * 500,
        launchDate: dateOnly(now - (30 + index * 12) * DAY),
        rallyAt: new Date(
          Math.floor((now + (6 + index) * DAY) / HOUR) * HOUR + 17 * HOUR
        ).toISOString(),
        isFeatured: index < 2,
        accent: ["#1F4E79", "#B5442A", "#2E7D4F", "#6B3FA0"][index % 4],
        stage: ["active", "organizing", "won", "paused"][index % 4],
        lead: leaderItems[(index + 3) % leaderItems.length].id,
        relatedNews: [newsItems[index * 2].id, newsItems[index * 2 + 3].id],
      },
    })
  );

  const collections: SampleCollection[] = [
    {
      id: SAMPLE_COLLECTION_IDS.news,
      slug: "news",
      name: "News",
      singularName: "News post",
      isPublic: true,
      fields: newsFields,
      items: newsItems,
    },
    {
      id: SAMPLE_COLLECTION_IDS.campaigns,
      slug: "campaigns",
      name: "Campaigns",
      singularName: "Campaign",
      isPublic: true,
      fields: campaignFields,
      items: campaignItems,
    },
    {
      id: SAMPLE_COLLECTION_IDS.leadership,
      slug: "leadership",
      name: "Leadership",
      singularName: "Leader",
      isPublic: true,
      fields: leadershipFields,
      items: leaderItems,
    },
    {
      id: SAMPLE_COLLECTION_IDS.locals,
      slug: "locals",
      name: "Locals",
      singularName: "Local",
      isPublic: false,
      fields: localFields,
      items: [],
    },
  ];
  return longNames
    ? collections.map((collection) => ({
        ...collection,
        name: longCollectionNames[collection.slug] ?? collection.name,
      }))
    : collections;
};

/** E3's table columns: the first four non-title fields the table shows. */
const columnsOf = (fields: CmsField[]) =>
  fields
    .filter(
      (field) =>
        field.isTitle !== true &&
        field.kind !== "richtext" &&
        field.kind !== "image" &&
        field.kind !== "multireference"
    )
    .slice(0, 4)
    .map((field) => field.key);

/** E3's Filter field: the first non-title option field with options. */
const filterFieldOf = (fields: CmsField[]) =>
  fields.find(
    (field) =>
      field.isTitle !== true &&
      field.kind === "option" &&
      (field.options?.length ?? 0) > 0
  );

const sortableKinds = new Set(["text", "date", "switch", "option"]);

/** A sort the schema allows, else the manual order (E3's rule). */
const sortOf = (sort: CmsSortKey, fields: CmsField[]): CmsSortKey => {
  if (!sort.startsWith("field:")) {
    return sort;
  }
  const field = fields.find((candidate) => `field:${candidate.key}` === sort);
  return field !== undefined &&
    field.isTitle !== true &&
    sortableKinds.has(field.kind)
    ? sort
    : "order";
};

const statusRank: Record<CmsItemStatus, number> = {
  draft: 0,
  published: 1,
  archived: 2,
};

export const createSampleCmsSource = ({
  now = Date.now(),
  flags = {},
  access = { canEdit: true, canPublish: true, canManageSettings: true },
  longNames = false,
}: {
  now?: number;
  flags?: SampleCmsFlags;
  access?: CmsAccess;
  /** Collection names and item titles of about 80 characters. */
  longNames?: boolean;
} = {}): SampleCmsSource => {
  const collections = buildCollections(now, longNames);
  /** E6's create-once keys: clientId to the item it made. */
  const created = new Map<string, string>();
  let clock = now;
  const tick = () => {
    clock += 1000;
    return clock;
  };

  const wait = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, flags.latency ?? 0);
    });

  const refusal = async (write: boolean): Promise<CmsFailure | undefined> => {
    await wait();
    if (flags.refuse !== undefined) {
      return { error: flags.refuse };
    }
    if (write && flags.refuseWrites !== undefined) {
      return { error: flags.refuseWrites };
    }
    return undefined;
  };

  const findCollection = (collectionId: string) =>
    collections.find((collection) => collection.id === collectionId);

  const toItem = (sample: SampleItem): CmsItem => ({
    id: sample.id,
    slug: sample.slug,
    status: sample.status,
    hasStagedChanges: sample.hasStagedChanges,
    data: structuredClone(sample.data),
    updatedAt: sample.updatedAt,
    createdAt: sample.createdAt,
    publishedAt: sample.publishedAt,
    live:
      sample.hasStagedChanges && sample.liveData !== null
        ? {
            slug: sample.liveSlug ?? sample.slug,
            data: structuredClone(sample.liveData),
          }
        : null,
    modifiedByName: sample.modifiedByName ?? "Dana Reyes",
  });

  /** A write answer: no live copy (E6 to E8b). */
  const toWritten = (sample: SampleItem): CmsItem => ({
    ...toItem(sample),
    live: null,
  });

  const titleOf = (collection: SampleCollection, sample: SampleItem) =>
    getItemTitle(sample.data, collection.fields);

  /** A write that lands and loses its answer, once. */
  const loseAnswer = (): CmsFailure | undefined => {
    if (flags.lostAnswerOnNextWrite) {
      flags.lostAnswerOnNextWrite = false;
      return { error: "unavailable" };
    }
    return undefined;
  };

  /** The lock check, and the simulated edit by someone else. */
  const checkLock = (
    collection: SampleCollection,
    sample: SampleItem,
    expectedUpdatedAt: string
  ): CmsFailure | undefined => {
    if (flags.conflictOnNextWrite) {
      flags.conflictOnNextWrite = false;
      const textField =
        collection.fields.find((field) => field.kind === "textarea") ??
        collection.fields.find((field) => field.isTitle);
      if (textField !== undefined) {
        sample.data = {
          ...sample.data,
          [textField.key]: `${String(sample.data[textField.key] ?? "")} Edited by the communications team.`,
        };
      }
      sample.updatedAt = toPostgrestTimestamp(tick());
      return { error: "conflict" };
    }
    if (sample.updatedAt !== expectedUpdatedAt) {
      return { error: "conflict" };
    }
    return undefined;
  };

  const checkSlug = (
    collection: SampleCollection,
    slug: string,
    itemId?: string
  ): CmsFailure | undefined => {
    if (isSlug(slug) === false) {
      return { error: "invalid", field: "slug" };
    }
    if (
      collection.items.some(
        (other) => other.slug === slug && other.id !== itemId
      )
    ) {
      // 23505 carries no field (5.7)
      return { error: "slug_taken" };
    }
    return undefined;
  };

  const source: SampleCmsSource = {
    flags,
    access,

    async getAccess() {
      return (await refusal(false)) ?? { ...access };
    },

    async listCollections() {
      return (
        (await refusal(false)) ?? {
          collections: collections.map(({ fields: _, items, ...rest }) => ({
            ...rest,
            total: items.length,
          })),
        }
      );
    },

    async getCollection(collectionId) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      const { items: _, ...rest } = collection;
      return { collection: structuredClone(rest) };
    },

    async listItems(
      collectionId,
      {
        q,
        page = 1,
        status = "all",
        sort = "order",
        direction,
        optionKey,
        optionValue,
      }
    ) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      const { fields } = collection;
      const columns = columnsOf(fields);
      const filterField = filterFieldOf(fields);
      const appliedSort = sortOf(sort, fields);
      const appliedDirection =
        appliedSort === "order"
          ? "asc"
          : (direction ?? (appliedSort === "updated" ? "desc" : "asc"));
      // An option filter runs only on the Filter's field, for a listed value
      const option =
        filterField !== undefined &&
        optionKey === filterField.key &&
        filterField.options?.some((entry) => entry.value === optionValue)
          ? { key: optionKey, value: optionValue }
          : undefined;
      const query = q?.trim().toLowerCase() ?? "";
      const matched = collection.items.filter(
        (sample) =>
          titleOf(collection, sample).toLowerCase().includes(query) &&
          (status === "all" ||
            (status === "staged"
              ? sample.hasStagedChanges
              : sample.status === status)) &&
          (option === undefined || sample.data[option.key] === option.value)
      );
      const keyOf = (sample: SampleItem): string | number => {
        if (appliedSort === "name") {
          return titleOf(collection, sample).toLowerCase();
        }
        if (appliedSort === "status") {
          return statusRank[sample.status];
        }
        if (appliedSort === "updated") {
          return sample.updatedAt;
        }
        if (appliedSort.startsWith("field:")) {
          return String(sample.data[appliedSort.slice(6)] ?? "");
        }
        return 0;
      };
      const sorted =
        appliedSort === "order"
          ? matched
          : [...matched].sort((left, right) => {
              const a = keyOf(left);
              const b = keyOf(right);
              const order = a < b ? -1 : a > b ? 1 : 0;
              return appliedDirection === "desc" ? -order : order;
            });
      // A page past the last answers the last page, as E3 does
      const lastPage = Math.max(1, Math.ceil(sorted.length / CMS_PAGE_SIZE));
      const answered = Math.min(Math.max(1, page), lastPage);
      const start = (answered - 1) * CMS_PAGE_SIZE;
      return {
        items: sorted
          .slice(start, start + CMS_PAGE_SIZE)
          .map((sample): CmsItemRow => {
            const values: Record<string, unknown> = {};
            for (const key of columns) {
              if (key in sample.data) {
                values[key] = sample.data[key];
              }
            }
            return {
              id: sample.id,
              slug: sample.slug,
              title: titleOf(collection, sample),
              status: sample.status,
              hasStagedChanges: sample.hasStagedChanges,
              updatedAt: sample.updatedAt,
              publishedAt:
                sample.status === "published" ? sample.publishedAt : null,
              values,
            };
          }),
        total: sorted.length,
        page: answered,
        columns,
        filterField: filterField?.key ?? null,
        applied: {
          status,
          sort: appliedSort,
          direction: appliedDirection,
          optionKey: option?.key ?? null,
          optionValue: option?.value ?? null,
        },
      };
    },

    async getItem(collectionId, itemId) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const sample = findCollection(collectionId)?.items.find(
        (candidate) => candidate.id === itemId
      );
      return sample === undefined
        ? { error: "not_found" }
        : { item: toItem(sample) };
    },

    async searchItems(collectionId, { q, ids }) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      const toResult = (sample: SampleItem) => ({
        id: sample.id,
        title: titleOf(collection, sample),
        status: sample.status,
      });
      // E5's input rule: at most 100 ids; with neither a term nor ids, no items
      if (ids !== undefined && ids.length > CMS_SEARCH_IDS_MAX) {
        return { error: "invalid" };
      }
      const query = q?.trim().toLowerCase() ?? "";
      if (query === "" && (ids === undefined || ids.length === 0)) {
        return { items: [] };
      }
      if (ids !== undefined && ids.length > 0) {
        return {
          items: ids.flatMap((id) => {
            const sample = collection.items.find(
              (candidate) => candidate.id === id
            );
            return sample === undefined ? [] : [toResult(sample)];
          }),
        };
      }
      return {
        items: collection.items
          .filter((sample) =>
            titleOf(collection, sample).toLowerCase().includes(query)
          )
          .slice(0, 20)
          .map(toResult),
      };
    },

    async createItem(collectionId, { clientId, slug, data }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      // a repeat of a create that went through answers its item (200)
      const madeId = created.get(`${collectionId}:${clientId}`);
      const made = collection.items.find((sample) => sample.id === madeId);
      if (made !== undefined) {
        return { item: toWritten(made), created: false };
      }
      const finalSlug = slug ?? slugify(getItemTitle(data, collection.fields));
      const slugFailure = checkSlug(collection, finalSlug);
      if (slugFailure) {
        return slugFailure;
      }
      const time = toPostgrestTimestamp(tick());
      const sample: SampleItem = {
        id: uuid(9, tick()),
        slug: finalSlug,
        status: "draft",
        data: structuredClone(data),
        liveData: null,
        liveSlug: null,
        hasStagedChanges: false,
        updatedAt: time,
        createdAt: time,
        publishedAt: null,
      };
      collection.items.unshift(sample);
      created.set(`${collectionId}:${clientId}`, sample.id);
      return loseAnswer() ?? { item: toWritten(sample), created: true };
    },

    async updateItem(collectionId, itemId, { slug, data, expectedUpdatedAt }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      const sample = collection?.items.find(
        (candidate) => candidate.id === itemId
      );
      if (collection === undefined || sample === undefined) {
        return { error: "not_found" };
      }
      const lockFailure = checkLock(collection, sample, expectedUpdatedAt);
      if (lockFailure) {
        return lockFailure;
      }
      const nextSlug = slug ?? sample.slug;
      const slugFailure = checkSlug(collection, nextSlug, itemId);
      if (slugFailure) {
        return slugFailure;
      }
      sample.data = structuredClone(data);
      sample.slug = nextSlug;
      if (sample.status === "published") {
        sample.hasStagedChanges =
          isSameValue(sample.liveData, sample.data) === false ||
          sample.liveSlug !== sample.slug;
      }
      sample.updatedAt = toPostgrestTimestamp(tick());
      return loseAnswer() ?? { item: toWritten(sample) };
    },

    async publishItem(collectionId, itemId, { expectedUpdatedAt }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      const sample = collection?.items.find(
        (candidate) => candidate.id === itemId
      );
      if (collection === undefined || sample === undefined) {
        return { error: "not_found" };
      }
      const lockFailure = checkLock(collection, sample, expectedUpdatedAt);
      if (lockFailure) {
        return lockFailure;
      }
      const time = tick();
      sample.status = "published";
      sample.liveData = structuredClone(sample.data);
      sample.liveSlug = sample.slug;
      sample.hasStagedChanges = false;
      sample.publishedAt = toPostgrestTimestamp(time);
      sample.updatedAt = toPostgrestTimestamp(time);
      return loseAnswer() ?? { item: toWritten(sample) };
    },

    async discardItemChanges(collectionId, itemId, { expectedUpdatedAt }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      const sample = collection?.items.find(
        (candidate) => candidate.id === itemId
      );
      if (collection === undefined || sample === undefined) {
        return { error: "not_found" };
      }
      const lockFailure = checkLock(collection, sample, expectedUpdatedAt);
      if (lockFailure) {
        return lockFailure;
      }
      if (sample.hasStagedChanges && sample.liveData !== null) {
        sample.data = structuredClone(sample.liveData);
        sample.slug = sample.liveSlug ?? sample.slug;
        sample.hasStagedChanges = false;
        sample.updatedAt = toPostgrestTimestamp(tick());
      }
      return loseAnswer() ?? { item: toWritten(sample) };
    },

    async publishItems(collectionId, { items }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      if (items.length === 0 || items.length > CMS_BULK_MAX) {
        return { error: "invalid" };
      }
      const answer = {
        published: [] as string[],
        unchanged: [] as string[],
        conflicts: [] as string[],
        failed: [] as string[],
      };
      for (const { id, updatedAt } of items) {
        const sample = collection.items.find(
          (candidate) => candidate.id === id
        );
        if (sample === undefined) {
          answer.failed.push(id);
        } else if (sample.updatedAt !== updatedAt) {
          answer.conflicts.push(id);
        } else if (
          sample.status === "published" &&
          sample.hasStagedChanges === false
        ) {
          answer.unchanged.push(id);
        } else {
          const time = toPostgrestTimestamp(tick());
          sample.status = "published";
          sample.liveData = structuredClone(sample.data);
          sample.liveSlug = sample.slug;
          sample.hasStagedChanges = false;
          sample.publishedAt = sample.publishedAt ?? time;
          sample.updatedAt = time;
          answer.published.push(id);
        }
      }
      return answer;
    },

    async setItemsStatus(collectionId, { ids, status }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      if (ids.length === 0 || ids.length > CMS_BULK_MAX) {
        return { error: "invalid" };
      }
      const changed: string[] = [];
      for (const sample of collection.items) {
        if (ids.includes(sample.id) === false || sample.status === status) {
          continue;
        }
        if (status === "draft") {
          // the staged copy folds into the draft
          sample.liveData = null;
          sample.liveSlug = null;
          sample.hasStagedChanges = false;
        }
        sample.status = status;
        sample.updatedAt = toPostgrestTimestamp(tick());
        changed.push(sample.id);
      }
      return { changed };
    },

    async deleteItems(collectionId, { ids }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      if (ids.length === 0 || ids.length > CMS_BULK_MAX) {
        return { error: "invalid" };
      }
      const deleted = collection.items
        .filter((sample) => ids.includes(sample.id))
        .map((sample) => sample.id);
      collection.items = collection.items.filter(
        (sample) => deleted.includes(sample.id) === false
      );
      return { deleted };
    },

    async reorderItems(collectionId, { ids }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const collection = findCollection(collectionId);
      if (collection === undefined) {
        return { error: "not_found" };
      }
      if (ids.length === 0 || ids.length > CMS_BULK_MAX) {
        return { error: "invalid" };
      }
      // The ids sent take the places they held, in their new order
      const sent = collection.items.filter((sample) => ids.includes(sample.id));
      const places = collection.items
        .map((sample, index) => (ids.includes(sample.id) ? index : -1))
        .filter((index) => index !== -1);
      const ordered = ids.flatMap((id) => {
        const sample = sent.find((candidate) => candidate.id === id);
        return sample === undefined ? [] : [sample];
      });
      let changed = 0;
      places.forEach((place, index) => {
        if (collection.items[place] !== ordered[index]) {
          changed += 1;
          ordered[index].updatedAt = toPostgrestTimestamp(tick());
        }
        collection.items[place] = ordered[index];
      });
      return { changed };
    },

    async uploadImage(file) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const extension = CMS_IMAGE_TYPES[file.type];
      if (extension === undefined || file.size > CMS_IMAGE_MAX_BYTES) {
        return { error: "invalid", field: "file" };
      }
      return {
        url: URL.createObjectURL(file),
        path: `sample/collections/${tick()}-upload.${extension}`,
      };
    },
  };
  return source;
};
