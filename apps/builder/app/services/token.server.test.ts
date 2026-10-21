import {
  encrypt,
  decrypt,
  createAccessToken,
  readAccessToken,
  createCodeToken,
  readCodeToken,
} from "./token.server";
import { test, expect } from "vitest";
import { nanoid } from "nanoid";

test.each([
  "",
  nanoid(1),
  nanoid(2),
  nanoid(5),
  nanoid(10),
  nanoid(20),
  nanoid(30),
  nanoid(40),
])("Encrypt and decrypt", async (cithertext) => {
  const secret =
    "JDKHSJFHKJHFSKJDHFJSDHFKJHDKJFHSKJDHFKJHFKJSFHKKADHJKSHDJKSHAJKHDASKDJH";

  expect(await decrypt(await encrypt(cithertext, secret), secret)).toBe(
    cithertext
  );
});

test("Access token", async () => {
  const secret = "1212121212";

  const token = await createAccessToken(
    { userId: "1", projectId: "2" },
    secret,
    {
      maxAge: 1000 * 60,
    }
  );

  const tokenPayload = await readAccessToken(token, secret);

  expect(tokenPayload).toEqual({ userId: "1", projectId: "2" });
});

test("the OrganizeOS session binding survives the code and access tokens", async () => {
  const secret = "1212121212";
  const binding = {
    organizeosSid: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    organizeosUserId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  };

  const code = await createCodeToken(
    { userId: "1", projectId: "2", codeChallenge: "c", ...binding },
    secret,
    { maxAge: 1000 * 60 }
  );
  const codePayload = await readCodeToken(code, secret);
  expect(codePayload).toEqual({
    userId: "1",
    projectId: "2",
    codeChallenge: "c",
    ...binding,
  });

  const accessToken = await createAccessToken(
    {
      userId: "1",
      projectId: "2",
      organizeosSid: codePayload?.organizeosSid,
      organizeosUserId: codePayload?.organizeosUserId,
    },
    secret,
    { maxAge: 1000 * 60 }
  );
  expect(await readAccessToken(accessToken, secret)).toEqual({
    userId: "1",
    projectId: "2",
    ...binding,
  });
});

test("tokens without the OrganizeOS session binding still parse", async () => {
  const secret = "1212121212";

  const code = await createCodeToken(
    { userId: "1", projectId: "2", codeChallenge: "c" },
    secret,
    { maxAge: 1000 * 60 }
  );
  const codePayload = await readCodeToken(code, secret);
  expect(codePayload).toEqual({
    userId: "1",
    projectId: "2",
    codeChallenge: "c",
  });
  expect(codePayload?.organizeosSid).toBeUndefined();

  const accessToken = await createAccessToken(
    { userId: "1", projectId: "2" },
    secret,
    { maxAge: 1000 * 60 }
  );
  const accessPayload = await readAccessToken(accessToken, secret);
  expect(accessPayload?.organizeosSid).toBeUndefined();
  expect(accessPayload?.organizeosUserId).toBeUndefined();
});
