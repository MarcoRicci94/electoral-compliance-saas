import { MembershipStatus, OrganizationType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrganizationMember } from "@/modules/access/service";

type CreateOrganizationInput = { name: string; type: OrganizationType };

export async function createOrganization(userId: string, input: CreateOrganizationInput) {
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.name, type: input.type, ownerUserId: userId }
    });
    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "OWNER",
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date()
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId,
        action: "ORGANIZATION_CREATED",
        entityType: "Organization",
        entityId: organization.id,
        afterJson: { name: organization.name, type: organization.type } as Prisma.InputJsonValue
      }
    });
    return organization;
  });
}

export async function listOrganizations(userId: string) {
  return prisma.organization.findMany({
    where: { members: { some: { userId, status: MembershipStatus.ACTIVE } } },
    select: { id: true, name: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function getOrganization(userId: string, organizationId: string) {
  await requireOrganizationMember(userId, organizationId);
  return prisma.organization.findFirst({
    where: { id: organizationId, members: { some: { userId, status: MembershipStatus.ACTIVE } } },
    select: { id: true, name: true, type: true, billingStatus: true }
  });
}
