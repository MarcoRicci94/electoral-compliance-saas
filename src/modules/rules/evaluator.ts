import { Decimal } from "@prisma/client/runtime/library";
import { evaluateCalculation } from "@/modules/rules/calculation";
import { RuleEvaluationError, evaluateExpression, ruleExpressionSchema } from "@/modules/rules/dsl";
import {
  computeDeadline,
  formatLegalDate,
  LegalCalendarError
} from "@/modules/rules/legal-calendar";
import {
  RuleEffectError,
  defaultSeverityFor,
  findingEffectTypes,
  isEffectType,
  parseCalculationEffect,
  parseDeadlineEffect,
  parseFindingEffect,
  parseTaskEffect,
  severityValues,
  type EffectType
} from "@/modules/rules/effects";

/**
 * Valutatore deterministico.
 *
 * Funzione pura: riceve regole, parametri e contesto, non tocca il database. Il
 * servizio applicativo la usa per persistere, il rule tester la usa per mostrare
 * l'esito. Non devono esistere due percorsi di valutazione diversi.
 */
export const EVALUATOR_VERSION = "2026-09-14.1";

export type Severity = (typeof severityValues)[number];

export type EvaluatableRule = {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  category: string;
  severityDefault: Severity;
  conditionExpression: unknown;
  effectType: string;
  effectPayload: unknown;
  legalSourceId: string | null;
  legalSourceTitle: string | null;
};

export type ProducedFinding = {
  kind: "FINDING";
  severity: Severity;
  title: string;
  description: string;
  entityType?: string;
};

export type ProducedTask = {
  kind: "TASK";
  priority: Severity;
  title: string;
  description: string;
};

export type ProducedDeadline = {
  kind: "DEADLINE";
  name: string;
  triggerEvent: string;
  triggerDate: string;
  offsetDefinition: string;
  dueDate: string;
};

export type ProducedCalculation = {
  kind: "CALCULATION";
  code: string;
  label: string;
  value: string;
  unit?: string;
};

export type ProducedEffect =
  ProducedFinding | ProducedTask | ProducedDeadline | ProducedCalculation;

export type RuleOutcome =
  | {
      ruleId: string;
      ruleCode: string;
      status: "MATCHED";
      effectType: EffectType;
      produced: ProducedEffect;
      legalSourceId: string | null;
      legalSourceTitle: string | null;
    }
  | { ruleId: string; ruleCode: string; status: "NOT_MATCHED" }
  | {
      ruleId: string;
      ruleCode: string;
      status: "NOT_EVALUABLE";
      errorCode: string;
      message: string;
    };

export type ComplianceState =
  "COMPLETE" | "ATTENTION_REQUIRED" | "CRITICAL" | "EVALUATION_INCOMPLETE";

export type EvaluationResult = {
  evaluatorVersion: string;
  outcomes: RuleOutcome[];
  findings: ProducedFinding[];
  tasks: ProducedTask[];
  deadlines: ProducedDeadline[];
  calculations: ProducedCalculation[];
  complianceState: ComplianceState;
  /** Un rendiconto non e' depositabile con un blocco aperto o con regole non valutate. */
  readyToFile: boolean;
  notEvaluable: number;
};

function readContextPath(context: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, part)
          ? (value as Record<string, unknown>)[part]
          : undefined,
      context
    );
}

function produceEffect(
  rule: EvaluatableRule,
  effectType: EffectType,
  context: Record<string, unknown>,
  parameters: Record<string, string | number>
): ProducedEffect {
  if (findingEffectTypes.includes(effectType)) {
    const effect = parseFindingEffect(rule.effectPayload, effectType, rule.ruleCode);
    return {
      kind: "FINDING",
      severity: effect.severity ?? rule.severityDefault ?? defaultSeverityFor(effectType),
      title: effect.title,
      description: effect.description,
      entityType: effect.entityType
    };
  }

  if (effectType === "TASK") {
    const effect = parseTaskEffect(rule.effectPayload, rule.ruleCode);
    return {
      kind: "TASK",
      priority: effect.priority ?? rule.severityDefault ?? defaultSeverityFor(effectType),
      title: effect.title,
      description: effect.description
    };
  }

  if (effectType === "DEADLINE") {
    const effect = parseDeadlineEffect(rule.effectPayload, rule.ruleCode);
    const trigger = readContextPath(context, effect.triggerField);
    if (typeof trigger !== "string" && !(trigger instanceof Date))
      throw new RuleEvaluationError(
        "RULE_DEADLINE_TRIGGER_MISSING",
        `l'evento ${effect.triggerEvent} non ha una data: la scadenza non e' calcolabile`
      );
    const computation = computeDeadline(trigger, effect.offsetDefinition);
    return {
      kind: "DEADLINE",
      name: effect.name,
      triggerEvent: effect.triggerEvent,
      triggerDate: formatLegalDate(computation.triggerDate),
      offsetDefinition: effect.offsetDefinition,
      dueDate: formatLegalDate(computation.dueDate)
    };
  }

  const effect = parseCalculationEffect(rule.effectPayload, rule.ruleCode);
  const value: Decimal = evaluateCalculation(effect.expression, context, parameters);
  return {
    kind: "CALCULATION",
    code: effect.code,
    label: effect.label,
    value: value.toFixed(2),
    unit: effect.unit
  };
}

function describeError(error: unknown): { errorCode: string; message: string } {
  if (
    error instanceof RuleEvaluationError ||
    error instanceof RuleEffectError ||
    error instanceof LegalCalendarError
  )
    return { errorCode: error.code, message: error.message };
  if (error instanceof Error) {
    const [code] = error.message.split(":");
    return { errorCode: code ?? "RULE_EVALUATION_FAILED", message: error.message };
  }
  return { errorCode: "RULE_EVALUATION_FAILED", message: String(error) };
}

export function evaluateRules(
  rules: EvaluatableRule[],
  context: Record<string, unknown>,
  parameters: Record<string, string | number> = {}
): EvaluationResult {
  const outcomes: RuleOutcome[] = [];

  for (const rule of rules) {
    try {
      if (!isEffectType(rule.effectType))
        throw new RuleEffectError(
          "RULE_EFFECT_TYPE_UNKNOWN",
          `tipo di effetto non riconosciuto: ${rule.effectType}`
        );

      const condition = ruleExpressionSchema.safeParse(rule.conditionExpression);
      if (!condition.success)
        throw new RuleEvaluationError(
          "RULE_CONDITION_INVALID",
          `condizione non valida: ${condition.error.issues.map((issue) => issue.message).join("; ")}`
        );

      if (!evaluateExpression(condition.data, context)) {
        outcomes.push({ ruleId: rule.id, ruleCode: rule.ruleCode, status: "NOT_MATCHED" });
        continue;
      }

      outcomes.push({
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        status: "MATCHED",
        effectType: rule.effectType,
        produced: produceEffect(rule, rule.effectType, context, parameters),
        legalSourceId: rule.legalSourceId,
        legalSourceTitle: rule.legalSourceTitle
      });
    } catch (error) {
      const { errorCode, message } = describeError(error);
      outcomes.push({
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        status: "NOT_EVALUABLE",
        errorCode,
        message
      });
    }
  }

  const produced = outcomes.filter((outcome) => outcome.status === "MATCHED");
  const findings = produced
    .map((outcome) => outcome.produced)
    .filter((effect): effect is ProducedFinding => effect.kind === "FINDING");
  const tasks = produced
    .map((outcome) => outcome.produced)
    .filter((effect): effect is ProducedTask => effect.kind === "TASK");
  const deadlines = produced
    .map((outcome) => outcome.produced)
    .filter((effect): effect is ProducedDeadline => effect.kind === "DEADLINE");
  const calculations = produced
    .map((outcome) => outcome.produced)
    .filter((effect): effect is ProducedCalculation => effect.kind === "CALCULATION");

  const notEvaluable = outcomes.filter((outcome) => outcome.status === "NOT_EVALUABLE").length;
  const hasBlocker = findings.some((finding) => finding.severity === "BLOCKER");
  const hasCritical = findings.some((finding) => finding.severity === "CRITICAL");
  const hasAttention = findings.some((finding) =>
    ["WARNING", "ACTION_REQUIRED"].includes(finding.severity)
  );

  const complianceState: ComplianceState = notEvaluable
    ? "EVALUATION_INCOMPLETE"
    : hasBlocker || hasCritical
      ? "CRITICAL"
      : hasAttention || tasks.length > 0
        ? "ATTENTION_REQUIRED"
        : "COMPLETE";

  return {
    evaluatorVersion: EVALUATOR_VERSION,
    outcomes,
    findings,
    tasks,
    deadlines,
    calculations,
    complianceState,
    readyToFile: notEvaluable === 0 && !hasBlocker,
    notEvaluable
  };
}
