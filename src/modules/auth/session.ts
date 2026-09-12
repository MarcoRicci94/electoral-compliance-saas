import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

const cookieName = "ecs_session";
const encoder = new TextEncoder();

export type Session = { userId: string; email: string };

function key() {
  return encoder.encode(getServerEnv().SESSION_SECRET);
}

export async function createSessionToken(session: Session) {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());
}

export async function getSession(): Promise<Session | null> {
  // This is deliberately opt-in twice: it is only for the locally seeded demo.
  // Production deployments must leave LOCAL_DEVELOPMENT_MODE unset/false.
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.LOCAL_DEVELOPMENT_MODE === "true") {
    return { userId: "development-user", email: "sviluppo@localhost" };
  }
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: cookieName,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8
  }
};
