import { evaluateExpression, type RuleExpression } from "@/modules/rules/dsl";

export type EvaluatableRule = {
  id: string;
  ruleCode: string;
  name: string;
  severityDefault: "INFO" | "ACTION_REQUIRED" | "WARNING" | "CRITICAL" | "BLOCKER";
  conditionExpression: RuleExpression;
  effectType:
    "REQUIREMENT" | "WARNING" | "BLOCKER" | "TASK" | "DEADLINE" | "CALCULATION" | "INFORMATION";
  effectPayload: Record<string, unknown>;
};

export type RuleEvaluation = { rule: EvaluatableRule; matched: boolean };

export function evaluateRules(
  rules: EvaluatableRule[],
  context: Record<string, unknown>
): RuleEvaluation[] {
  return rules.map((rule) => ({
    rule,
    matched: evaluateExpression(rule.conditionExpression, context)
  }));
}

export function deriveComplianceState(evaluations: RuleEvaluation[]) {
  const matched = evaluations.filter((item) => item.matched).map((item) => item.rule);
  if (matched.some((rule) => rule.severityDefault === "BLOCKER")) return "CRITICAL";
  if (
    matched.some((rule) =>
      ["CRITICAL", "WARNING", "ACTION_REQUIRED"].includes(rule.severityDefault)
    )
  )
    return "ATTENTION_REQUIRED";
  return "COMPLETE";
}
