export interface FineNoticeExtract {
  infractionCode?: string;
  date?: string;
  time?: string;
  points?: number;
  amount?: number;
  description?: string;
  location?: string;
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export function parseFineNoticeText(text: string): FineNoticeExtract {
  const normalized = normalize(text);
  const result: FineNoticeExtract = {};
  const code = normalized.match(/(?:COD(?:IGO)?\s*(?:DA\s*)?INFRACAO|INFRACAO)\s*[:\-]?\s*(\d{3,6}(?:[-.]\d{1,2})?)/);
  if (code?.[1]) result.infractionCode = code[1].replace(/\./g, "-");

  const dateMatch = normalized.match(/(?:DATA\s*(?:DA\s*)?INFRACAO|DATA)\s*[:\-]?\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch?.[1] && dateMatch?.[2] && dateMatch?.[3]) {
    result.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  const timeMatch = normalized.match(/(?:HORA)\s*[:\-]?\s*(\d{2}:\d{2})/);
  if (timeMatch?.[1]) result.time = timeMatch[1];

  const pointsMatch = normalized.match(/(?:PONTOS)\s*[:\-]?\s*(3|4|5|7)/);
  if (pointsMatch?.[1]) result.points = Number(pointsMatch[1]);

  const amountMatch = normalized.match(/(?:VALOR\s*(?:DA\s*)?(?:MULTA|INFRACAO)|VALOR)\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2}|\d+(?:\.\d{2})?)/);
  if (amountMatch?.[1]) {
    const raw = amountMatch[1];
    const amount = raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
    if (Number.isFinite(amount) && amount > 0) result.amount = amount;
  }

  const locationMatch = normalized.match(/(?:LOCAL\s*(?:DA\s*)?INFRACAO|LOCAL)\s*[:\-]?\s*([^\n]{3,120})/);
  if (locationMatch?.[1]) result.location = locationMatch[1].trim();

  const descriptionMatch = normalized.match(/(?:DESCRICAO\s*(?:DA\s*)?INFRACAO|DESCRICAO)\s*[:\-]?\s*([^\n]{3,240})/);
  if (descriptionMatch?.[1]) result.description = descriptionMatch[1].trim();

  return result;
}
