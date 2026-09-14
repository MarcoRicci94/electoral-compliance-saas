import { z } from "zod";
import { calculationExpressionSchema } from "@/modules/rules/calculation";

/**
 * Effetti delle regole.
 *
 * Un `effectPayload` malformato non viene interpretato in modo indulgente: la
 * regola diventa non valutabile. Una regola giuridica applicata a meta' e' peggio
 * di una regola non applicata, perche' produce un esito che sembra affidabile.
 */
export const effectTypes = [
  "REQUIREMENT",
  "WARNING",
  "BLOCKER",
  "INFORMATION",
  "TASK",
  "DEADLINE",
  "CALCULATION"
] as const;
export type EffectType = (typeof effectTypes)[number];

export const severityValues = [
  "INFO",
  "ACTION_REQUIRED",
  "WARNING",
  "CRITICAL",
  "BLOCKER"
] as const;

const findingEffectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(severityValues).optional(),
  entityType: z.string().min(1).optional()
});

const taskEffectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(severityValues).optional(),
  /** Termine collegato: la data effettiva la calcola la scadenza, non il task. */
  dueFromDeadline: z.string().min(1).optional()
});

const deadlineEffectSchema = z.object({
  name: z.string().min(1),
  /** Percorso nel contesto da cui leggere la data dell'evento che fa decorrere il termine. */
  triggerEvent: z.string().min(1),
  triggerField: z.string().min(1),
  offsetDefinition: z.string().min(1)
});

const calculationEffectSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  expression: calculationExpressionSchema,
  unit: z.string().min(1).optional()
});

export type FindingEffect = z.infer<typeof findingEffectSchema>;
export type TaskEffect = z.infer<typeof taskEffectSchema>;
export type DeadlineEffect = z.infer<typeof deadlineEffectSchema>;
export type CalculationEffect = z.infer<typeof calculationEffectSchema>;

export class RuleEffectError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RuleEffectError";
  }
}

export function isEffectType(value: string): value is EffectType {
  return (effectTypes as readonly string[]).includes(value);
}

function parse<T>(schema: z.ZodType<T>, payload: unknown, effectType: string, ruleCode: string): T {
  const result = schema.safeParse(payload);
  if (!result.success)
    throw new RuleEffectError(
      "RULE_EFFECT_PAYLOAD_INVALID",
      `effetto ${effectType} non valido per la regola ${ruleCode}: ${result.error.issues
        .map((issue) => `${issue.path.join(".") || "(radice)"} ${issue.message}`)
        .join("; ")}`
    );
  return result.data;
}

export function parseFindingEffect(payload: unknown, effectType: string, ruleCode: string) {
  return parse(findingEffectSchema, payload, effectType, ruleCode);
}

export function parseTaskEffect(payload: unknown, ruleCode: string) {
  return parse(taskEffectSchema, payload, "TASK", ruleCode);
}

export function parseDeadlineEffect(payload: unknown, ruleCode: string) {
  return parse(deadlineEffectSchema, payload, "DEADLINE", ruleCode);
}

export function parseCalculationEffect(payload: unknown, ruleCode: string) {
  return parse(calculationEffectSchema, payload, "CALCULATION", ruleCode);
}

/** Gli effetti che producono un rilievo, distinti da quelli che producono altro. */
export const findingEffectTypes: readonly EffectType[] = [
  "REQUIREMENT",
  "WARNING",
  "BLOCKER",
  "INFORMATION"
];

const defaultSeverityByEffect: Record<EffectType, (typeof severityValues)[number]> = {
  REQUIREMENT: "ACTION_REQUIRED",
  WARNING: "WARNING",
  BLOCKER: "BLOCKER",
  INFORMATION: "INFO",
  TASK: "ACTION_REQUIRED",
  DEADLINE: "INFO",
  CALCULATION: "INFO"
};

export function defaultSeverityFor(effectType: EffectType) {
  return defaultSeverityByEffect[effectType];
}
