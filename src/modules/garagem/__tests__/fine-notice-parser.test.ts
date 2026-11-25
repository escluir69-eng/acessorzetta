import { describe, expect, it } from "vitest";
import { parseFineNoticeText } from "../utils/fine-notice-parser";

describe("parseFineNoticeText", () => {
  it("extracts the main fields from pasted notification text", () => {
    const parsed = parseFineNoticeText(`Código da infração: 745-50
      Data da infração: 22/11/2026
      Hora: 08:40
      Pontos: 5
      Valor da multa: R$ 195,23
      Local da infração: Avenida Central, Brasília
      Descrição da infração: Velocidade acima do limite`);
    expect(parsed.infractionCode).toBe("745-50");
    expect(parsed.date).toBe("2026-11-22");
    expect(parsed.time).toBe("08:40");
    expect(parsed.points).toBe(5);
    expect(parsed.amount).toBe(195.23);
    expect(parsed.location).toContain("AVENIDA CENTRAL");
    expect(parsed.description).toContain("VELOCIDADE");
  });

  it("returns an empty object for unrelated text", () => {
    expect(parseFineNoticeText("texto sem dados de multa")).toEqual({});
  });
});
