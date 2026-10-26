import { readFileSync } from "node:fs";
import type { ClearZone, FieldArm, FieldPoint } from "./generate";

// Tests only: the shared fixture (`__fixtures__/README.md`), read from disk
// rather than imported, so the typecheck never infers a literal type for its
// thousands of arms.

/** An arm as the fixture encodes it: `[x, y, deg, size, level]`. */
export type ArmTuple = [number, number, number, number, number];

export type FixtureCase = {
  name: string;
  width: number;
  height: number;
  spacing: number;
  focus: FieldPoint;
  zone: ClearZone;
  arms: ArmTuple[];
};

export type Fixture = {
  source: string;
  commit: string;
  cases: FixtureCase[];
};

export const fixturePath = new URL(
  "./__fixtures__/convergence-field.fixture.json",
  import.meta.url
);

export const readFixture = (): Fixture =>
  JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

export const toTuple = (arm: FieldArm): ArmTuple => [
  arm.x,
  arm.y,
  arm.deg,
  arm.size,
  arm.level,
];

export const fixtureCase = (name: string): FixtureCase => {
  const found = readFixture().cases.find((item) => item.name === name);
  if (found === undefined) {
    throw new Error(`no fixture case ${name}`);
  }
  return found;
};
