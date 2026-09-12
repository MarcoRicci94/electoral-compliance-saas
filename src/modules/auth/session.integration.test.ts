import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken } from "@/modules/auth/session";

describe("session integration", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/test";
    process.env.SESSION_SECRET = "a-very-long-test-secret-that-is-at-least-thirty-two-characters";
    process.env.NODE_ENV = "test";
  });

  it("issues a signed, time-bound token containing only session identity", async () => {
    const token = await createSessionToken({ userId: "user_a", email: "candidate@example.test" });
    expect(token.split(".")).toHaveLength(3);
    expect(token).not.toContain("password");
  });
});
