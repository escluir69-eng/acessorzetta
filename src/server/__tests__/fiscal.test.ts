import { describe, expect, it } from "vitest";
import { resolveFiscalRedirectUrl } from "@/server/fiscal";

describe("resolveFiscalRedirectUrl", () => {
  it("allows relative redirects that remain on HTTPS gov.br", () => {
    const target = resolveFiscalRedirectUrl(
      "https://portal.fazenda.gov.br/nfce",
      "/consulta/nota",
    );
    expect(target?.toString()).toBe("https://portal.fazenda.gov.br/consulta/nota");
  });

  it("allows redirects to another HTTPS gov.br host", () => {
    const target = resolveFiscalRedirectUrl(
      "https://portal.fazenda.gov.br/nfce",
      "https://consulta.sefaz.gov.br/nota",
    );
    expect(target?.hostname).toBe("consulta.sefaz.gov.br");
  });

  it.each([
    "http://portal.fazenda.gov.br/nota",
    "https://example.com/redirect",
    "//example.com/redirect",
    "https://127.0.0.1/admin",
  ])("rejects unsafe redirect target %s", (location) => {
    expect(
      resolveFiscalRedirectUrl("https://portal.fazenda.gov.br/nfce", location),
    ).toBeNull();
  });
});
