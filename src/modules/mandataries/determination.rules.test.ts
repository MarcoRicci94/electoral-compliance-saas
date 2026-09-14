import { describe, expect, it } from "vitest";
import { determineMandatary } from "@/modules/mandataries/determination";

describe("determinazione del regime del mandatario", () => {
  it("riconosce la campagna fuori dal perimetro dell'obbligo", () => {
    expect(determineMandatary({ applicable: false, requiresMandatary: null })).toEqual({
      status: "NOT_APPLICABLE",
      sourceRuleCode: undefined
    });
  });

  it("dichiara obbligatorio il mandatario citando la regola che lo impone", () => {
    expect(
      determineMandatary({
        applicable: true,
        requiresMandatary: true,
        sourceRuleCode: "IT-POL-MAND-001"
      })
    ).toEqual({ status: "REQUIRED", sourceRuleCode: "IT-POL-MAND-001" });
  });

  it("dichiara non necessario il mandatario citando la regola di eccezione", () => {
    expect(
      determineMandatary({
        applicable: true,
        requiresMandatary: false,
        sourceRuleCode: "IT-COM-MAND-EXC-001"
      })
    ).toEqual({ status: "NOT_REQUIRED", sourceRuleCode: "IT-COM-MAND-EXC-001" });
  });

  it("non conclude nulla quando la regola non e' valutabile", () => {
    expect(determineMandatary({ applicable: true, requiresMandatary: null })).toEqual({
      status: "EVALUATION_INCOMPLETE",
      reason: "Regola del mandatario non valutabile"
    });
  });

  /**
   * Una conclusione senza fonte sarebbe una decisione legale non tracciabile: deve
   * degradare a valutazione incompleta, non diventare un "non serve il mandatario".
   */
  it("rifiuta una conclusione priva di regola di riferimento", () => {
    expect(determineMandatary({ applicable: true, requiresMandatary: false }).status).toBe(
      "EVALUATION_INCOMPLETE"
    );
    expect(determineMandatary({ applicable: true, requiresMandatary: true }).status).toBe(
      "EVALUATION_INCOMPLETE"
    );
  });

  it("conserva la motivazione fornita dal valutatore", () => {
    expect(
      determineMandatary({
        applicable: true,
        requiresMandatary: null,
        reason: "Popolazione del comune non disponibile"
      })
    ).toEqual({
      status: "EVALUATION_INCOMPLETE",
      reason: "Popolazione del comune non disponibile"
    });
  });
});
