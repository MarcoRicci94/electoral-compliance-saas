import type { Prisma } from "@prisma/client";

export type AuditWriter = {
  auditLog: {
    create(args: { data: Prisma.AuditLogCreateInput }): Promise<unknown>;
  };
};

export async function appendAudit(
  db: AuditWriter,
  input: {
    organizationId: string;
    campaignId?: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    afterJson?: Prisma.InputJsonValue;
  }
) {
  await db.auditLog.create({
    data: {
      organization: { connect: { id: input.organizationId } },
      ...(input.campaignId ? { campaign: { connect: { id: input.campaignId } } } : {}),
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      afterJson: input.afterJson
    }
  });
}
