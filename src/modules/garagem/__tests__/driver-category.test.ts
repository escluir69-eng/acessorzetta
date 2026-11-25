import { describe, expect, it } from "vitest";
import { resolveDriverCnhCategory, splitDriverCnhCategory } from "../utils/driver-category";
import { driverSchema } from "../schemas/garage.schemas";

describe("categorias combinadas da CNH", () => {
  it.each([["B", "AB"], ["C", "AC"], ["D", "AD"], ["E", "AE"]])(
    "combina categoria A com %s",
    (base, expected) => {
      expect(resolveDriverCnhCategory(base, true)).toBe(expected);
    },
  );

  it("mantém A independente e categorias principais sem A", () => {
    expect(resolveDriverCnhCategory("NENHUMA", true)).toBe("A");
    expect(resolveDriverCnhCategory("B", false)).toBe("B");
    expect(resolveDriverCnhCategory("NENHUMA", false)).toBe("");
  });

  it.each(["A", "AB", "AC", "AD", "AE", "B", "C", "D", "E"])(
    "aceita %s no schema Zod e rejeita categorias desconhecidas",
    (category) => {
      expect(driverSchema.safeParse({
        name: "Condutor",
        cnhNumber: "123456789",
        cnhCategory: category,
        cnhExpiry: "2028-05-10",
        allowedVehicleIds: [],
        active: true,
      }).success).toBe(true);
      expect(driverSchema.safeParse({
        name: "Condutor",
        cnhNumber: "123456789",
        cnhCategory: "AX",
        cnhExpiry: "2028-05-10",
        allowedVehicleIds: [],
        active: true,
      }).success).toBe(false);
    },
  );

  it.each(["A", "AB", "AC", "AD", "AE", "B", "C", "D", "E"])(
    "reabre a categoria %s sem alterar sua composição",
    (category) => {
      const parts = splitDriverCnhCategory(category);
      expect(resolveDriverCnhCategory(parts.baseCategory, parts.hasCategoryA)).toBe(category);
    },
  );
});
