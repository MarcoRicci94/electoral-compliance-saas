import { describe, expect, it } from "vitest";
import { determineMandatary } from "@/modules/mandataries/determination";

describe("determinazione del mandatario", () => {
  it("fallisce in sicurezza se manca una regola attiva", () => {
    expect(determineMandatary({ applicable: true, requiresMandatary: null }).status).toBe(
      "EVALUATION_INCOMPLETE"
    );
  });

  it("non decide senza il codice della regola sorgente", () => {
    expect(determineMandatary({ applicable: true, requiresMandatary: true }).status).toBe(
      "EVALUATION_INCOMPLETE"
    );
  });
});
