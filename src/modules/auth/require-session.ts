import { HttpError } from "@/lib/http";
import { getSession } from "@/modules/auth/session";

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Autenticazione richiesta");
  return session;
}
