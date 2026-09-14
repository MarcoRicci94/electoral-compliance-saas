import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { confirmPasswordReset } from "@/modules/auth/account-service";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128)
});

export async function POST(request: Request) {
  try {
    const { token, password } = schema.parse(await request.json());
    return Response.json({ data: await confirmPasswordReset(token, password) });
  } catch (error) {
    return errorResponse(error);
  }
}
