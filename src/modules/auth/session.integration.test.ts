import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "@/modules/auth/session";

describe("session integration", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/test");
    vi.stubEnv("SESSION_SECRET", "a-very-long-test-secret-that-is-at-least-thirty-two-characters");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a signed, time-bound token containing only session identity", async () => {
    const token = await createSessionToken({ userId: "user_a", email: "candidate@example.test" });
    expect(token.split(".")).toHaveLength(3);
    expect(token).not.toContain("password");
  });
});
