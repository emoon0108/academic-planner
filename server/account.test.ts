import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock the db module so tests run without a real database ─────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    resetUserData: vi.fn().mockResolvedValue(undefined),
    deleteUserAccount: vi.fn().mockResolvedValue(undefined),
  };
});

import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "student@ivy.edu",
    name: "Test Student",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.resetAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resetUserData with the authenticated user's id and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resetAccount();

    expect(result).toEqual({ success: true });
    expect(db.resetUserData).toHaveBeenCalledOnce();
    expect(db.resetUserData).toHaveBeenCalledWith(42);
  });

  it("does NOT clear the session cookie (user stays logged in after reset)", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.resetAccount();

    expect(clearedCookies).toHaveLength(0);
  });

  it("propagates errors from resetUserData", async () => {
    vi.mocked(db.resetUserData).mockRejectedValueOnce(new Error("DB error"));
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.resetAccount()).rejects.toThrow("DB error");
  });
});

describe("auth.deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteUserAccount with the authenticated user's id and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.deleteAccount();

    expect(result).toEqual({ success: true });
    expect(db.deleteUserAccount).toHaveBeenCalledOnce();
    expect(db.deleteUserAccount).toHaveBeenCalledWith(42);
  });

  it("clears the session cookie after deleting the account", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.deleteAccount();

    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      httpOnly: true,
      path: "/",
    });
  });

  it("propagates errors from deleteUserAccount", async () => {
    vi.mocked(db.deleteUserAccount).mockRejectedValueOnce(new Error("DB delete error"));
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.deleteAccount()).rejects.toThrow("DB delete error");
  });
});
