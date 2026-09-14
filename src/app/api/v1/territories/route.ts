import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { searchMunicipalities } from "@/modules/territories/service";

const querySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const { q, limit } = querySchema.parse({
      q: url.searchParams.get("q") ?? "",
      limit: url.searchParams.get("limit") ?? undefined
    });
    return Response.json({ data: await searchMunicipalities(q, limit) });
  } catch (error) {
    return errorResponse(error);
  }
}
