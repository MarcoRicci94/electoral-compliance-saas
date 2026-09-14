import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { getComplianceOverview, overrideFinding } from "@/modules/compliance/service";
import { evaluateCampaign } from "@/modules/rules/service";

const evaluateSchema = z.object({ action: z.literal("EVALUATE") });
const overrideSchema = z.object({
  action: z.literal("OVERRIDE_FINDING"),
  findingId: z.string().cuid(),
  reason: z.string().min(10).max(2000)
});
const bodySchema = z.discriminatedUnion("action", [evaluateSchema, overrideSchema]);

type RouteContext = { params: Promise<{ organizationId: string; campaignId: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    return Response.json({
      data: await getComplianceOverview(session.userId, organizationId, campaignId)
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

    if (input.action === "EVALUATE") {
      const evaluation = await evaluateCampaign(session.userId, organizationId, campaignId);
      return Response.json({
        data: {
          complianceState: evaluation.complianceState,
          readyToFile: evaluation.readyToFile,
          notEvaluable: evaluation.notEvaluable,
          blockedReason: evaluation.blockedReason,
          provenance: evaluation.provenance,
          persisted: evaluation.persisted,
          calculations: evaluation.calculations,
          outcomes: evaluation.outcomes
        }
      });
    }

    return Response.json({
      data: await overrideFinding(
        session.userId,
        organizationId,
        campaignId,
        input.findingId,
        input.reason
      )
    });
  } catch (error) {
    return errorResponse(error);
  }
}
