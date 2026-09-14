import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { confirmEmailVerification } from "@/modules/auth/account-service";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: Request) {
  try {
    const { token } = schema.parse(await request.json());
    return Response.json({ data: await confirmEmailVerification(token) });
  } catch (error) {
    return errorResponse(error);
  }
}
