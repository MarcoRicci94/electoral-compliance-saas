import { ContributionStatus, ContributionType, ExpenseStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCampaignPermission } from "@/modules/access/service";

type FinanceScope = { actorUserId: string; organizationId: string; campaignId: string };

export async function createContribution(
  scope: FinanceScope,
  input: {
    donorId?: string;
    type: ContributionType;
    date: Date;
    amount: string;
    paymentMethod?: string;
    notes?: string;
  }
) {
  await requireCampaignPermission(
    scope.actorUserId,
    scope.organizationId,
    scope.campaignId,
    "finance:write"
  );
  return prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.create({
      data: {
        campaignId: scope.campaignId,
        donorId: input.donorId,
        type: input.type,
        date: input.date,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        status: ContributionStatus.CONFIRMED
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        userId: scope.actorUserId,
        action: "CONTRIBUTION_CREATED",
        entityType: "Contribution",
        entityId: contribution.id,
        afterJson: {
          amount: contribution.amount.toString(),
          type: contribution.type
        } as Prisma.InputJsonValue
      }
    });
    return contribution;
  });
}

export async function createExpense(
  scope: FinanceScope,
  input: {
    supplierId?: string;
    expenseDate: Date;
    description: string;
    legalCategory: string;
    subcategory?: string;
    grossAmount: string;
    netAmount?: string;
    vatAmount?: string;
    relevantAmountForLimit: string;
  }
) {
  await requireCampaignPermission(
    scope.actorUserId,
    scope.organizationId,
    scope.campaignId,
    "finance:write"
  );
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        campaignId: scope.campaignId,
        supplierId: input.supplierId,
        expenseDate: input.expenseDate,
        description: input.description,
        legalCategory: input.legalCategory,
        subcategory: input.subcategory,
        grossAmount: input.grossAmount,
        netAmount: input.netAmount,
        vatAmount: input.vatAmount,
        relevantAmountForLimit: input.relevantAmountForLimit,
        paidAmount: "0",
        outstandingAmount: input.grossAmount,
        status: ExpenseStatus.RECORDED
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        userId: scope.actorUserId,
        action: "EXPENSE_CREATED",
        entityType: "Expense",
        entityId: expense.id,
        afterJson: {
          grossAmount: expense.grossAmount.toString(),
          relevantAmountForLimit: expense.relevantAmountForLimit.toString()
        } as Prisma.InputJsonValue
      }
    });
    return expense;
  });
}

export async function getFinanceOverview(
  scope: Omit<FinanceScope, "actorUserId"> & { actorUserId: string }
) {
  await requireCampaignPermission(
    scope.actorUserId,
    scope.organizationId,
    scope.campaignId,
    "finance:read"
  );
  const [contributions, expenses, services] = await Promise.all([
    prisma.contribution.aggregate({
      where: {
        campaignId: scope.campaignId,
        status: ContributionStatus.CONFIRMED,
        deletedAt: null
      },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { campaignId: scope.campaignId, deletedAt: null, status: { not: ExpenseStatus.VOID } },
      _sum: {
        grossAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        relevantAmountForLimit: true
      }
    }),
    prisma.inKindContribution.aggregate({
      where: { campaignId: scope.campaignId, status: "CONFIRMED" },
      _sum: { estimatedValue: true }
    })
  ]);
  return {
    contributions: contributions._sum.amount?.toString() ?? "0",
    expenses: {
      gross: expenses._sum.grossAmount?.toString() ?? "0",
      paid: expenses._sum.paidAmount?.toString() ?? "0",
      outstanding: expenses._sum.outstandingAmount?.toString() ?? "0",
      relevantForLimit: expenses._sum.relevantAmountForLimit?.toString() ?? "0"
    },
    inKindServices: services._sum.estimatedValue?.toString() ?? "0"
  };
}
