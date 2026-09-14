import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requestPasswordReset } from "@/modules/auth/account-service";

const schema = z.object({ email: z.string().email() });

/**
 * Non richiede autenticazione e non rivela se l'indirizzo sia registrato: la
 * risposta e' la stessa in ogni caso.
 */
export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return Response.json({ data: await requestPasswordReset(email, ip) });
  } catch (error) {
    return errorResponse(error);
  }
}
