import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

export type CalculationExpression =
  | { constant: string }
  | { field: string }
  | {
      operation: "add" | "subtract" | "multiply" | "divide" | "min" | "max";
      items: CalculationExpression[];
    };

export const calculationExpressionSchema: z.ZodType<CalculationExpression> = z.lazy(() =>
  z.union([
    z.object({ constant: z.string().min(1) }),
    z.object({ field: z.string().regex(/^[a-z][a-zA-Z0-9_.]*$/) }),
    z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide", "min", "max"]),
      items: z.array(calculationExpressionSchema).min(1)
    })
  ])
);

function valueAt(context: Record<string, unknown>, path: string): Decimal {
  const value = path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      context
    );
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error(`CALCULATION_INPUT_MISSING:${path}`);
  return new Decimal(value);
}

export function evaluateCalculation(
  expression: CalculationExpression,
  context: Record<string, unknown>,
  constants: Record<string, string | number>
): Decimal {
  if ("constant" in expression) {
    const value = constants[expression.constant];
    if (value === undefined)
      throw new Error(`CALCULATION_PARAMETER_MISSING:${expression.constant}`);
    return new Decimal(value);
  }
  if ("field" in expression) return valueAt(context, expression.field);
  const values: Decimal[] = expression.items.map((item) =>
    evaluateCalculation(item, context, constants)
  );
  const [first, ...remaining] = values;
  if (!first) throw new Error("CALCULATION_EMPTY_OPERATION");

  switch (expression.operation) {
    case "add":
      return values.reduce((result: Decimal, value: Decimal) => result.plus(value), new Decimal(0));
    case "subtract":
      return remaining.reduce((result: Decimal, value: Decimal) => result.minus(value), first);
    case "multiply":
      return values.reduce(
        (result: Decimal, value: Decimal) => result.times(value),
        new Decimal(1)
      );
    case "divide":
      return remaining.reduce((result: Decimal, value: Decimal) => {
        if (value.isZero()) throw new Error("CALCULATION_DIVIDE_BY_ZERO");
        return result.div(value);
      }, first);
    case "min":
      return Decimal.min(...values);
    case "max":
      return Decimal.max(...values);
  }
}
