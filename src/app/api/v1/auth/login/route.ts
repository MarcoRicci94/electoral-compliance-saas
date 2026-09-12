import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { authenticateUser } from "@/modules/auth/service";
import { createSessionToken, sessionCookie } from "@/modules/auth/session";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await authenticateUser(input.email, input.password);
    const response = Response.json({ data: { id: user.id, email: user.email } });
    response.headers.append(
      "Set-Cookie",
      `${sessionCookie.name}=${await createSessionToken({ userId: user.id, email: user.email })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
