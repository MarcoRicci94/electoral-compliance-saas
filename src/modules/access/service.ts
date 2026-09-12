import { MembershipStatus, type CampaignRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { hasCampaignPermission, type CampaignPermission } from "@/modules/access/policy";

export type CampaignAccess = {
  userId: string;
  organizationId: string;
  campaignId: string;
  role: CampaignRole;
};

export async function requireOrganizationMember(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId, status: MembershipStatus.ACTIVE },
    select: { id: true, role: true }
  });
  if (!membership)
    throw new HttpError(403, "ORGANIZATION_ACCESS_DENIED", "Accesso all'organizzazione negato");
  return membership;
}

export async function requireCampaignAccess(
  userId: string,
  organizationId: string,
  campaignId: string
) {
  await requireOrganizationMember(userId, organizationId);
  const member = await prisma.campaignMember.findFirst({
    where: { campaignId, userId, status: MembershipStatus.ACTIVE, campaign: { organizationId } },
    select: { role: true }
  });
  if (!member) throw new HttpError(403, "CAMPAIGN_ACCESS_DENIED", "Accesso alla campagna negato");
  return { userId, organizationId, campaignId, role: member.role } satisfies CampaignAccess;
}

export async function requireCampaignPermission(
  userId: string,
  organizationId: string,
  campaignId: string,
  permission: CampaignPermission
) {
  const access = await requireCampaignAccess(userId, organizationId, campaignId);
  if (!hasCampaignPermission(access.role, permission)) {
    throw new HttpError(
      403,
      "CAMPAIGN_PERMISSION_DENIED",
      "Permesso insufficiente per questa operazione"
    );
  }
  return access;
}
