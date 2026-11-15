import { expect, test } from "vitest";
import fundraisers from "../__fixtures__/fundraisers.json";
import {
  findFundraiser,
  parseFundraisersData,
  untitledFundraiser,
} from "./fundraisers-data";

const ID_1 = "b1c2d3e4-0000-4000-8000-000000000001";

test("reads the three fundraisers of the fundraisers.json fixture, in order", () => {
  expect(parseFundraisersData(fundraisers)).toEqual([
    {
      id: ID_1,
      title: "Spring Drive",
      goalCents: 2500000,
      raisedCents: 642050,
      donorCount: 48,
      currency: "USD",
      draft: false,
    },
    {
      id: "b1c2d3e4-0000-4000-8000-000000000002",
      title: "Flood Relief",
      goalCents: null,
      raisedCents: 120500,
      donorCount: 17,
      currency: "USD",
      draft: false,
    },
    {
      id: "b1c2d3e4-0000-4000-8000-000000000003",
      title: "Year-End Match",
      goalCents: 1000000,
      raisedCents: 0,
      donorCount: 0,
      currency: "USD",
      draft: true,
    },
  ]);
});

test("reads anything that is not a fundraisers body as no body", () => {
  for (const body of [
    undefined,
    null,
    {},
    { error: "x" },
    "<html>",
    { data: "x" },
    [],
  ]) {
    expect(parseFundraisersData(body)).toBeUndefined();
  }
  expect(parseFundraisersData({ data: [] })).toEqual([]);
});

test("skips an entry with no string id, a blank or padded id, or a repeated id", () => {
  const list = parseFundraisersData({
    data: [
      { id: "a", title: "First" },
      { id: 7, title: "Number" },
      { id: "", title: "Blank" },
      { id: " b", title: "Padded" },
      { id: "a", title: "Repeat" },
      "not an object",
      { id: "c", title: "Last" },
    ],
  });
  expect(list?.map((item) => item.id)).toEqual(["a", "c"]);
});

test("reads odd values leniently", () => {
  const [item] =
    parseFundraisersData({
      data: [
        {
          id: "a",
          title: "  ",
          raised_amount_cents: -5,
          donor_count: 1.5,
          goal_amount_cents: 0,
        },
      ],
    }) ?? [];
  expect(item).toEqual({
    id: "a",
    title: untitledFundraiser,
    goalCents: null,
    raisedCents: 0,
    donorCount: 0,
    currency: "USD",
    draft: false,
  });
  const [other] =
    parseFundraisersData({
      data: [
        {
          id: "b",
          title: "B",
          raised_amount_cents: "100",
          donor_count: -1,
          goal_amount_cents: 1.5,
          currency: 7,
          draft: "yes",
        },
      ],
    }) ?? [];
  expect(other).toMatchObject({
    goalCents: null,
    raisedCents: 0,
    donorCount: 0,
    currency: "USD",
    draft: false,
  });
});

test("finds a fundraiser by its trimmed record", () => {
  const list = parseFundraisersData(fundraisers) ?? [];
  expect(findFundraiser(list, ID_1)?.title).toBe("Spring Drive");
  expect(findFundraiser(list, ` ${ID_1} `)?.title).toBe("Spring Drive");
  for (const record of ["", "  ", 7, undefined, "unknown"]) {
    expect(findFundraiser(list, record)).toBeUndefined();
  }
});
