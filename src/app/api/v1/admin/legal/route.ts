import { z } from "zod";
import { errorResponse } from "@/lib/http";
import {
  activateRuleset,
  setRuleActive,
  updateRuleParameter,
  verifyLegalSource,
  verifyRuleParameter
} from "@/modules/administration/rulesets";
import { requireSession } from "@/modules/auth/require-session";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("VERIFY_SOURCE"),
    legalSourceId: z.string().cuid(),
    officialUrl: z.string().url().optional(),
    notes: z.string().max(4000).optional()
  }),
  z.object({
    action: z.literal("SET_RULE_ACTIVE"),
    ruleId: z.string().cuid(),
    isActive: z.boolean()
  }),
  z.object({
    action: z.literal("UPDATE_PARAMETER"),
    parameterId: z.string().cuid(),
    value: z.string().min(1).max(40),
    unit: z.string().max(40).optional(),
    note: z.string().max(2000).optional()
  }),
  z.object({
    action: z.literal("VERIFY_PARAMETER"),
    parameterId: z.string().cuid(),
    note: z.string().max(2000).optional()
  }),
  z.object({
    action: z.literal("ACTIVATE_RULESET"),
    rulesetVersionId: z.string().cuid(),
    reviewNote: z.string().min(20).max(4000)
  })
]);

/** Ogni azione verifica da sola il ruolo di piattaforma: la rotta non autorizza nulla. */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = schema.parse(await request.json());

    if (input.action === "VERIFY_SOURCE")
      return Response.json({
        data: await verifyLegalSource(session.userId, input.legalSourceId, {
          officialUrl: input.officialUrl,
          notes: input.notes
        })
      });

    if (input.action === "SET_RULE_ACTIVE")
      return Response.json({
        data: await setRuleActive(session.userId, input.ruleId, input.isActive)
      });

    if (input.action === "UPDATE_PARAMETER")
      return Response.json({
        data: await updateRuleParameter(session.userId, input.parameterId, {
          value: input.value,
          unit: input.unit,
          note: input.note
        })
      });

    if (input.action === "VERIFY_PARAMETER")
      return Response.json({
        data: await verifyRuleParameter(session.userId, input.parameterId, input.note)
      });

    return Response.json({
      data: await activateRuleset(session.userId, input.rulesetVersionId, input.reviewNote)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
