import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { linkCampaignToMunicipality } from "@/modules/territories/service";

const bodySchema = z.object({ territoryId: z.string().cuid() });

export async function PUT(
  request: Request,
  context: { params: Promise<{ organizationId: string; campaignId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    const { territoryId } = bodySchema.parse(await request.json());
    const result = await linkCampaignToMunicipality(
      session.userId,
      organizationId,
      campaignId,
      territoryId
    );
    return Response.json({
      data: {
        campaignId: result.campaign.id,
        municipality: result.municipality,
        /**
         * Il collegamento cambia i presupposti di fatto: le regole vanno
         * rivalutate. Lo dice la risposta invece di farlo di nascosto.
         */
        reevaluationRequired: true
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
