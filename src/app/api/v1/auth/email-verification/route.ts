import { errorResponse } from "@/lib/http";
import { requestEmailVerification } from "@/modules/auth/account-service";
import { requireSession } from "@/modules/auth/require-session";

/** Richiede un nuovo link di verifica per l'utente collegato. */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return Response.json({ data: await requestEmailVerification(session.userId, ip) });
  } catch (error) {
    return errorResponse(error);
  }
}
