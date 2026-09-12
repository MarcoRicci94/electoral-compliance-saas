import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { getCampaign } from "@/modules/campaigns/service";

export async function GET(
  _: Request,
  context: { params: Promise<{ organizationId: string; campaignId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    const campaign = await getCampaign(session.userId, organizationId, campaignId);
    if (!campaign)
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Campagna non trovata" } },
        { status: 404 }
      );
    return Response.json({ data: campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
