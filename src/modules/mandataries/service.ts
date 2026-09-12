import { CampaignRole, MandataryStatus, MembershipStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { requireCampaignPermission } from "@/modules/access/service";

export type UpsertMandataryInput = {
  firstName: string;
  lastName: string;
  taxCode?: string;
  birthDate?: Date;
  birthPlace?: string;
  residence?: string;
  pec?: string;
  email?: string;
  phone?: string;
  appointmentDate?: Date;
};

export async function upsertMandatary(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  input: UpsertMandataryInput
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");
  return prisma.$transaction(async (tx) => {
    const profile = await tx.mandataryProfile.upsert({
      where: { campaignId },
      create: { campaignId, ...input, status: MandataryStatus.DATA_COMPLETE },
      update: { ...input, status: MandataryStatus.DATA_COMPLETE }
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "MANDATARY_PROFILE_UPSERTED",
        entityType: "MandataryProfile",
        entityId: profile.id,
        afterJson: { status: profile.status, email: profile.email } as Prisma.InputJsonValue
      }
    });
    return profile;
  });
}

export async function inviteMandatary(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  email: string
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "members:manage");
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true }
  });
  if (!user)
    throw new HttpError(
      422,
      "INVITATION_DELIVERY_NOT_CONFIGURED",
      "L'utente non è ancora registrato; integrare il provider email prima dell'invito esterno"
    );
  return prisma.$transaction(async (tx) => {
    const membership = await tx.campaignMember.upsert({
      where: { campaignId_userId: { campaignId, userId: user.id } },
      create: {
        campaignId,
        userId: user.id,
        role: CampaignRole.MANDATARY,
        status: MembershipStatus.INVITED
      },
      update: { role: CampaignRole.MANDATARY, status: MembershipStatus.INVITED, joinedAt: null }
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "MANDATARY_INVITED",
        entityType: "CampaignMember",
        entityId: membership.id,
        afterJson: { invitedUserId: user.id }
      }
    });
    return membership;
  });
}
