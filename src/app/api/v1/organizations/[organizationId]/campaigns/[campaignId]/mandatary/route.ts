import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { inviteMandatary, upsertMandatary } from "@/modules/mandataries/service";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  taxCode: z.string().trim().max(32).optional(),
  birthDate: z.coerce.date().optional(),
  birthPlace: z.string().trim().max(160).optional(),
  residence: z.string().trim().max(500).optional(),
  pec: z.string().email().optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(32).optional(),
  appointmentDate: z.coerce.date().optional()
});
const invitationSchema = z.object({ email: z.string().email() });

export async function PUT(
  request: Request,
  context: { params: Promise<{ organizationId: string; campaignId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    return Response.json({
      data: await upsertMandatary(
        session.userId,
        organizationId,
        campaignId,
        profileSchema.parse(await request.json())
      )
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; campaignId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    const invitation = invitationSchema.parse(await request.json());
    return Response.json(
      {
        data: await inviteMandatary(session.userId, organizationId, campaignId, invitation.email)
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
