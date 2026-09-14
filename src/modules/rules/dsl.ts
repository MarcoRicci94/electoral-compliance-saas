import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

const operatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "exists",
  "not_exists"
]);
export type JsonPrimitive = string | number | boolean | null;
export type RuleExpression =
  | {
      field: string;
      operator: z.infer<typeof operatorSchema>;
      value?: JsonPrimitive | JsonPrimitive[];
    }
  | { all: RuleExpression[] }
  | { any: RuleExpression[] }
  | { not: RuleExpression };

/**
 * Una condizione non valutabile non e' una condizione falsa. Il chiamante deve
 * tradurre questo errore in `EVALUATION_INCOMPLETE`, mai in "regola non applicabile":
 * una soglia legale che non riesce a confrontarsi deve essere visibile, non silenziosa.
 */
export class RuleEvaluationError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RuleEvaluationError";
  }
}

const reservedPathSegments = new Set(["constructor", "prototype"]);

export const ruleExpressionSchema: z.ZodType<RuleExpression> = z.lazy(() =>
  z.union([
    z
      .object({
        field: z
          .string()
          .regex(/^[a-z][a-zA-Z0-9_.]*$/)
          .refine(
            (path) => path.split(".").every((segment) => !reservedPathSegments.has(segment)),
            "il percorso non puo' attraversare proprieta' riservate del prototipo"
          ),
        operator: operatorSchema,
        value: z
          .union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
          ])
          .optional()
      })
      .superRefine((value, context) => {
        if (!["exists", "not_exists"].includes(value.operator) && value.value === undefined)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "value obbligatorio per questo operatore"
          });
        if (["in", "not_in"].includes(value.operator) && !Array.isArray(value.value))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "gli operatori in/not_in richiedono un array"
          });
        if (["gt", "gte", "lt", "lte"].includes(value.operator) && Array.isArray(value.value))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "gli operatori di confronto non accettano un array"
          });
      }),
    z.object({ all: z.array(ruleExpressionSchema).min(1) }),
    z.object({ any: z.array(ruleExpressionSchema).min(1) }),
    z.object({ not: ruleExpressionSchema })
  ])
);

function getValue(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (reservedPathSegments.has(part))
      throw new RuleEvaluationError(
        "RULE_FIELD_PATH_FORBIDDEN",
        `percorso non consentito: ${path}`
      );
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    return (value as Record<string, unknown>)[part];
  }, context);
}

const numericStringPattern = /^-?\d+(\.\d+)?$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

function asDecimal(value: unknown): Decimal | null {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") return Number.isFinite(value) ? new Decimal(value) : null;
  if (typeof value === "string" && numericStringPattern.test(value)) return new Decimal(value);
  return null;
}

function asEpoch(value: unknown): Decimal | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Decimal(value.getTime());
  if (typeof value === "string" && isoDatePattern.test(value)) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Decimal(parsed);
  }
  return null;
}

/**
 * I confronti accettano numeri, stringhe numeriche, `Decimal` e date, perche' gli
 * importi autorevoli sono `Decimal` e viaggiano come stringa. Un confronto fra tipi
 * non confrontabili solleva un errore invece di restituire `false`.
 */
function compare(field: string, actual: unknown, expected: unknown): number {
  const actualDate = asEpoch(actual);
  const expectedDate = asEpoch(expected);
  if (actualDate && expectedDate) return actualDate.comparedTo(expectedDate);

  const actualNumber = asDecimal(actual);
  const expectedNumber = asDecimal(expected);
  if (actualNumber && expectedNumber) return actualNumber.comparedTo(expectedNumber);

  if (actual === undefined || actual === null)
    throw new RuleEvaluationError(
      "RULE_INPUT_MISSING",
      `il campo ${field} non e' valorizzato e non puo' essere confrontato`
    );
  throw new RuleEvaluationError(
    "RULE_COMPARISON_NOT_COMPARABLE",
    `il campo ${field} non e' confrontabile con il valore atteso`
  );
}

/** Uguaglianza per valore sui numeri, stretta su tutto il resto. */
function equals(actual: unknown, expected: unknown): boolean {
  const actualNumber = asDecimal(actual);
  const expectedNumber = asDecimal(expected);
  if (actualNumber && expectedNumber) return actualNumber.equals(expectedNumber);
  return actual === expected;
}

export function evaluateExpression(
  expression: RuleExpression,
  context: Record<string, unknown>
): boolean {
  if ("all" in expression) return expression.all.every((item) => evaluateExpression(item, context));
  if ("any" in expression) return expression.any.some((item) => evaluateExpression(item, context));
  if ("not" in expression) return !evaluateExpression(expression.not, context);
  const actual = getValue(context, expression.field);
  const expected = expression.value;
  switch (expression.operator) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "not_exists":
      return actual === undefined || actual === null;
    case "eq":
      return equals(actual, expected);
    case "neq":
      return !equals(actual, expected);
    case "gt":
      return compare(expression.field, actual, expected) > 0;
    case "gte":
      return compare(expression.field, actual, expected) >= 0;
    case "lt":
      return compare(expression.field, actual, expected) < 0;
    case "lte":
      return compare(expression.field, actual, expected) <= 0;
    case "in":
      if (!Array.isArray(expected))
        throw new RuleEvaluationError("RULE_OPERAND_NOT_A_LIST", "in richiede un array");
      return expected.some((item) => equals(actual, item));
    case "not_in":
      if (!Array.isArray(expected))
        throw new RuleEvaluationError("RULE_OPERAND_NOT_A_LIST", "not_in richiede un array");
      return !expected.some((item) => equals(actual, item));
  }
}
