import { expect, test } from "vitest";
import { parseFiscalInput } from "@/lib/fiscalDocuments";
test("http QR consults", () => {
  const p = parseFiscalInput("http://www.fazenda.pr.gov.br/nfce/qrcode?p=41231234|2|1|1|ABC");
  expect(p.canAttemptAutoConsult).toBe(true);
  expect(p.sourceUrl.startsWith("https://")).toBe(true);
});
