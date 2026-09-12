export type MandataryDeterminationInput = {
  applicable: boolean;
  requiresMandatary: boolean | null;
  sourceRuleCode?: string;
  reason?: string;
};

export type MandataryDetermination =
  | { status: "NOT_APPLICABLE"; sourceRuleCode?: string }
  | { status: "REQUIRED"; sourceRuleCode: string }
  | { status: "NOT_REQUIRED"; sourceRuleCode: string }
  | { status: "EVALUATION_INCOMPLETE"; reason: string };

export function determineMandatary(input: MandataryDeterminationInput): MandataryDetermination {
  if (!input.applicable) return { status: "NOT_APPLICABLE", sourceRuleCode: input.sourceRuleCode };
  if (input.requiresMandatary === true && input.sourceRuleCode)
    return { status: "REQUIRED", sourceRuleCode: input.sourceRuleCode };
  if (input.requiresMandatary === false && input.sourceRuleCode)
    return { status: "NOT_REQUIRED", sourceRuleCode: input.sourceRuleCode };
  return {
    status: "EVALUATION_INCOMPLETE",
    reason: input.reason ?? "Regola del mandatario non valutabile"
  };
}
