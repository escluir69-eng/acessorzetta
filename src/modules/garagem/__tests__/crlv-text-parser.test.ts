import { describe, expect, it } from "vitest";
import { parseCrlvText } from "../utils/crlv-text-parser";

describe("parseCrlvText", () => {
  it("extracts plate, RENAVAM, chassis and years from copied CRLV text", () => {
    const parsed = parseCrlvText(`REPÚBLICA FEDERATIVA DO BRASIL
      PLACA ABC1D23
      RENAVAM: 01234567890
      CHASSI: 9BWZZZ377VT004251
      ANO FAB / ANO MOD 2018/2019`);
    expect(parsed.plate).toBe("ABC1D23");
    expect(parsed.renavam).toBe("01234567890");
    expect(parsed.chassis).toBe("9BWZZZ377VT004251");
    expect(parsed.manufactureYear).toBe(2018);
    expect(parsed.modelYear).toBe(2019);
  });

  it("handles old Mercosul plate format with dash and empty text", () => {
    expect(parseCrlvText("PLACA ABC-1234").plate).toBe("ABC1234");
    expect(parseCrlvText("").plate).toBeUndefined();
  });

  it("does not return out-of-range model years", () => {
    const parsed = parseCrlvText("ANO FAB / ANO MOD 1800/1800");
    expect(parsed.manufactureYear).toBeUndefined();
    expect(parsed.modelYear).toBeUndefined();
  });
});
