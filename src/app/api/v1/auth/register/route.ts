import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { registerUser } from "@/modules/auth/service";
import { createSessionToken, sessionCookie } from "@/modules/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(32).optional()
});

export async function POST(request: Request) {
  try {
    const user = await registerUser(schema.parse(await request.json()));
    const response = Response.json({ data: user }, { status: 201 });
    response.headers.append(
      "Set-Cookie",
      `${sessionCookie.name}=${await createSessionToken({ userId: user.id, email: user.email })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
