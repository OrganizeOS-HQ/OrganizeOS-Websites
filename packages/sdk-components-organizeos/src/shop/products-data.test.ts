import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import products from "../__fixtures__/products.json";
import { parseProductsData } from "./products-data";

test("reads the four products of the products.json fixture, in order", () => {
  expect(parseProductsData(products)).toEqual([
    { id: "34efeec7-ef26-4210-946f-866b46b94f46", title: "Organizer T-shirt" },
    { id: "a66f32f6-7332-4e24-8745-2b27bc8012a0", title: "Campaign Mug" },
    { id: "5087feff-58f2-4407-a702-190424880813", title: "Canvas Tote Bag" },
    { id: "6cadce3d-67cd-4297-9d1e-273eae4123d1", title: "Sticker" },
  ]);
});

test("skips an entry with no string id, a blank or padded id, or a repeated id", () => {
  expect(
    parseProductsData({
      data: [
        { id: "a", title: "First" },
        { id: 7, title: "Number" },
        { title: "No id" },
        { id: "", title: "Blank" },
        { id: "   ", title: "Spaces" },
        { id: " b", title: "Padded" },
        { id: "a", title: "Repeated" },
        null,
        "c",
        { id: "c", title: "Third" },
      ],
    })
  ).toEqual([
    { id: "a", title: "First" },
    { id: "c", title: "Third" },
  ]);
});

test("a blank or missing title is Untitled product", () => {
  expect(
    parseProductsData({
      data: [
        { id: "a", title: "" },
        { id: "b", title: "  " },
        { id: "c" },
        { id: "d", title: 12 },
      ],
    }).map(({ title }) => title)
  ).toEqual([
    "Untitled product",
    "Untitled product",
    "Untitled product",
    "Untitled product",
  ]);
});

test("an error body, an empty object, a list that is not one and text read as no products", () => {
  expect(parseProductsData({ error: "unavailable" })).toEqual([]);
  expect(parseProductsData({})).toEqual([]);
  expect(parseProductsData({ data: {} })).toEqual([]);
  expect(parseProductsData("<!doctype html><html></html>")).toEqual([]);
  expect(parseProductsData(undefined)).toEqual([]);
  expect(parseProductsData(null)).toEqual([]);
});

test("the reader is its own export, built from package.json's exports", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  ) as { exports: Record<string, unknown> };
  expect(packageJson.exports["./products-data"]).toEqual({
    webstudio: "./src/shop/products-data.ts",
    types: "./lib/types/shop/products-data.d.ts",
    import: "./lib/shop/products-data.js",
  });
});
