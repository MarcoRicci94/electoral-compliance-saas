import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import {
  completeSetup,
  getSetupStatus,
  saveCampaignSetup,
  setProclamationDate
} from "@/modules/campaigns/setup";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "importo non valido");

const answersSchema = z.object({
  action: z.literal("SAVE_ANSWERS"),
  expectsOwnSpending: z.boolean(),
  plannedOwnSpending: money.optional(),
  expectsThirdPartyContributions: z.boolean(),
  expectsPartyOrListSupport: z.boolean(),
  expectsInKindContributions: z.boolean(),
  plannedTotalSpending: money.optional()
});

const proclamationSchema = z.object({
  action: z.literal("SET_PROCLAMATION_DATE"),
  proclamationDate: z.coerce.date()
});

const completeSchema = z.object({ action: z.literal("COMPLETE") });

const bodySchema = z.discriminatedUnion("action", [
  answersSchema,
  proclamationSchema,
  completeSchema
]);

type RouteContext = { params: Promise<{ organizationId: string; campaignId: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    return Response.json({
      data: await getSetupStatus(session.userId, organizationId, campaignId)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    const input = bodySchema.parse(await request.json());

    if (input.action === "SAVE_ANSWERS") {
      const { mandatary } = await saveCampaignSetup(
        session.userId,
        organizationId,
        campaignId,
        input
      );
      return Response.json({
        data: {
          mandatary,
          status: await getSetupStatus(session.userId, organizationId, campaignId)
        }
      });
    }

    if (input.action === "SET_PROCLAMATION_DATE") {
      const evaluation = await setProclamationDate(
        session.userId,
        organizationId,
        campaignId,
        input.proclamationDate
      );
      return Response.json({
        data: {
          deadlines: evaluation.deadlines,
          complianceState: evaluation.complianceState,
          blockedReason: evaluation.blockedReason
        }
      });
    }

    return Response.json({
      data: await completeSetup(session.userId, organizationId, campaignId)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
