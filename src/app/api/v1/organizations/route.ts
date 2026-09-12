import { OrganizationType } from "@prisma/client";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { createOrganization, listOrganizations } from "@/modules/organizations/service";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.nativeEnum(OrganizationType)
});

export async function GET() {
  try {
    const session = await requireSession();
    return Response.json({ data: await listOrganizations(session.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const organization = await createOrganization(
      session.userId,
      schema.parse(await request.json())
    );
    return Response.json({ data: organization }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
