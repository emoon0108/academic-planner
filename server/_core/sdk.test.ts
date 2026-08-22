import { afterEach, describe, expect, it } from "vitest";

import { ENV } from "./env";
import { sdk } from "./sdk";

const originalCookieSecret = ENV.cookieSecret;
const originalProductionFlag = ENV.isProduction;

afterEach(() => {
  ENV.cookieSecret = originalCookieSecret;
  ENV.isProduction = originalProductionFlag;
});

describe("session signing", () => {
  it("rejects managed authentication without a session secret", async () => {
    ENV.cookieSecret = "";
    ENV.isProduction = false;

    await expect(
      sdk.signSession({ openId: "user-1", appId: "academiq", name: "Student" })
    ).rejects.toThrow("JWT_SECRET is required");
  });

  it("rejects a short production session secret", async () => {
    ENV.cookieSecret = "too-short";
    ENV.isProduction = true;

    await expect(
      sdk.signSession({ openId: "user-1", appId: "academiq", name: "Student" })
    ).rejects.toThrow("at least 32 characters");
  });

  it("round-trips a session signed with a strong secret", async () => {
    ENV.cookieSecret = "academiq-test-secret-with-at-least-32-characters";
    ENV.isProduction = true;

    const token = await sdk.signSession({
      openId: "user-1",
      appId: "academiq",
      name: "Student",
    });

    await expect(sdk.verifySession(token)).resolves.toEqual({
      openId: "user-1",
      appId: "academiq",
      name: "Student",
    });
  });
});
