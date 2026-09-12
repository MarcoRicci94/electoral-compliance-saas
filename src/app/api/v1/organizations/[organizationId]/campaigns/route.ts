import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { createCampaign, listCampaigns } from "@/modules/campaigns/service";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  electionType: z.enum(["POLITICAL", "MUNICIPAL", "REGIONAL"]),
  officeSought: z.enum([
    "DEPUTY",
    "SENATOR",
    "MAYOR",
    "MUNICIPAL_COUNCILLOR",
    "REGIONAL_PRESIDENT",
    "REGIONAL_COUNCILLOR"
  ]),
  municipality: z.string().trim().max(160).optional(),
  electionDate: z.coerce.date().optional(),
  candidate: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().trim().max(32).optional()
  })
});

export async function GET(_: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireSession();
    const { organizationId } = await context.params;
    return Response.json({ data: await listCampaigns(session.userId, organizationId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId } = await context.params;
    const campaign = await createCampaign(session.userId, {
      ...schema.parse(await request.json()),
      organizationId
    });
    return Response.json({ data: campaign }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
