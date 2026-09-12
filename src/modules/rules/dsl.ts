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

export const ruleExpressionSchema: z.ZodType<RuleExpression> = z.lazy(() =>
  z.union([
    z
      .object({
        field: z.string().regex(/^[a-z][a-zA-Z0-9_.]*$/),
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
      }),
    z.object({ all: z.array(ruleExpressionSchema).min(1) }),
    z.object({ any: z.array(ruleExpressionSchema).min(1) }),
    z.object({ not: ruleExpressionSchema })
  ])
);

function getValue(context: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined,
      context
    );
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
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual as JsonPrimitive);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual as JsonPrimitive);
  }
}
