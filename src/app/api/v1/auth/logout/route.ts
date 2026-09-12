import { sessionCookie } from "@/modules/auth/session";

export async function POST() {
  const response = Response.json({ data: { loggedOut: true } });
  response.headers.append(
    "Set-Cookie",
    `${sessionCookie.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
