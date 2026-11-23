export interface CrlvTextExtract {
  plate?: string;
  renavam?: string;
  chassis?: string;
  manufactureYear?: number;
  modelYear?: number;
}

const cleanText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export function parseCrlvText(text: string): CrlvTextExtract {
  const normalized = cleanText(text).replace(/\s+/g, " ");
  const result: CrlvTextExtract = {};

  const plateMatches = normalized.match(/\b[A-Z]{3}[- ]?[0-9][A-Z0-9][0-9]{2}\b/g) ?? [];
  const validPlate = plateMatches.find((plate) => /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/.test(plate.replace(/ /g, "")));
  if (validPlate) result.plate = validPlate.replace(/[ -]/g, "");

  const renavamMatch = normalized.match(/RENAVAM\s*[:\-]?\s*(\d{9,11})/);
  if (renavamMatch?.[1]) result.renavam = renavamMatch[1];

  const chassisMatch = normalized.match(/(?:CHASSI|VIN)\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{17})/);
  if (chassisMatch?.[1]) result.chassis = chassisMatch[1];

  const yearMatch = normalized.match(/ANO\s*(?:FAB(?:RICACAO)?\s*\/\s*)?MODELO\s*[:\-]?\s*(\d{4})\s*\/\s*(\d{4})/);
  if (yearMatch?.[1] && yearMatch?.[2]) {
    const manufactureYear = Number(yearMatch[1]);
    const modelYear = Number(yearMatch[2]);
    if (manufactureYear >= 1960 && manufactureYear <= new Date().getFullYear() + 1) {
      result.manufactureYear = manufactureYear;
    }
    if (modelYear >= 1960 && modelYear <= new Date().getFullYear() + 1) {
      result.modelYear = modelYear;
    }
  }

  return result;
}
