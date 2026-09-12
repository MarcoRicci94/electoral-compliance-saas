import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireSession } from "@/modules/auth/require-session";
import { createContribution, createExpense, getFinanceOverview } from "@/modules/finance/service";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const contributionSchema = z.object({
  kind: z.literal("CONTRIBUTION"),
  donorId: z.string().cuid().optional(),
  type: z.enum(["MONEY", "SELF_FINANCING", "THIRD_PARTY_PAYMENT", "OTHER"]),
  date: z.coerce.date(),
  amount: money,
  paymentMethod: z.string().max(100).optional(),
  notes: z.string().max(2000).optional()
});
const expenseSchema = z.object({
  kind: z.literal("EXPENSE"),
  supplierId: z.string().cuid().optional(),
  expenseDate: z.coerce.date(),
  description: z.string().min(1).max(1000),
  legalCategory: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  grossAmount: money,
  netAmount: money.optional(),
  vatAmount: money.optional(),
  relevantAmountForLimit: money
});

export async function GET(
  _: Request,
  context: { params: Promise<{ organizationId: string; campaignId: string }> }
) {
  try {
    const session = await requireSession();
    const { organizationId, campaignId } = await context.params;
    return Response.json({
      data: await getFinanceOverview({ actorUserId: session.userId, organizationId, campaignId })
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
    const input = await request.json();
    const scope = { actorUserId: session.userId, organizationId, campaignId };
    const data =
      input.kind === "CONTRIBUTION"
        ? await createContribution(scope, contributionSchema.parse(input))
        : await createExpense(scope, expenseSchema.parse(input));
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
