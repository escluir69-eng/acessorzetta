/**
 * Rotas fiscais do Órion: consulta de NFC-e em portais *.gov.br e OCR de
 * notas fiscais via Lovable AI Gateway (modelo multimodal com visão).
 */
import { generateResponse } from "@lovable.dev/ai-gateway";

function isAllowedFiscalGovUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".gov.br")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBrDecimalToCents(raw: string): number {
  const match = raw.replace(/\./g, "").match(/(\d+),(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number(match[2]);
}

function extractPublicNfceHtml(html: string) {
  const lower = html.toLowerCase();
  const hasCaptcha =
    lower.includes("g-recaptcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("cf-turnstile") ||
    lower.includes("captcha") ||
    lower.includes("gov.br/oauth2") ||
    lower.includes("acesso negado");

  if (hasCaptcha) {
    return { requiresHumanAction: true as const };
  }

  const storeMatch =
    html.match(/id=["']u20["'][^>]*>([^<]+)</i) ||
    html.match(/class=["'][^"']*txtTopo[^"']*["'][^>]*>([^<]+)</i);
  const store = storeMatch?.[1] ? decodeHtmlEntities(storeMatch[1]) : "";

  const cnpjMatch = html.match(/CNPJ:\s*([\d./-]{14,20})/i);
  const cnpj = cnpjMatch?.[1]?.trim() ?? "";

  const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})?/);
  const issuedAt = dateMatch?.[3] && dateMatch[2] && dateMatch[1]
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    : "";
  const issuedTime = dateMatch?.[4] ?? "";

  const totalMatch =
    html.match(/Valor\s+a\s+pagar[\s\S]{0,180}?R\$\s*([\d.,]+)/i) ||
    html.match(/Valor\s+total[\s\S]{0,180}?R\$\s*([\d.,]+)/i);
  const totalCents = totalMatch?.[1] ? parseBrDecimalToCents(totalMatch[1]) : 0;

  const items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    totalCents: number;
  }> = [];

  const rowRegex = /<tr[^>]*id=["']Item\s*\+\s*\d+["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null && items.length < 150) {
    const rowHtml = rowMatch[1] ?? "";
    if (!rowHtml) continue;
    const titleMatch = rowHtml.match(/class=["'][^"']*txtTit[^"']*["'][^>]*>([^<]+)</i);
    const qtyMatch = rowHtml.match(/Qtde\.?:?\s*<\/strong>\s*([\d.,]+)/i);
    const unitMatch = rowHtml.match(/UN:?\s*<\/strong>\s*([a-zA-Z0-9]+)/i);
    const unitPriceMatch = rowHtml.match(/Vl\.\s*Unit\.?:?\s*<\/strong>\s*([\d.,]+)/i);
    const totalItemMatch = rowHtml.match(/class=["'][^"']*valor[^"']*["'][^>]*>([^<]+)</i);

    const description = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).slice(0, 250) : "";
    if (!description) continue;
    const quantity = qtyMatch?.[1] ? Number(qtyMatch[1].replace(/\./g, "").replace(",", ".")) || 1 : 1;
    const unit = unitMatch?.[1] ? unitMatch[1].trim().slice(0, 12) : "un";
    const unitPriceCents = unitPriceMatch?.[1] ? parseBrDecimalToCents(unitPriceMatch[1]) : 0;
    const itemTotalCents = totalItemMatch?.[1]
      ? parseBrDecimalToCents(totalItemMatch[1])
      : Math.round(quantity * unitPriceCents);
    items.push({
      description,
      quantity,
      unit,
      unitPriceCents: unitPriceCents || (quantity > 0 ? Math.round(itemTotalCents / quantity) : 0),
      totalCents: itemTotalCents,
    });
  }

  return {
    requiresHumanAction: false as const,
    store,
    cnpj,
    issuedAt,
    issuedTime,
    totalCents,
    items,
  };
}

export async function handleFiscalLookup(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  try {
    const rawUrl = String(body?.url || "").trim();
    const safeUrl = isAllowedFiscalGovUrl(rawUrl);
    if (!safeUrl) {
      return Response.json(
        { error: "Informe uma URL HTTPS oficial de portal fiscal (*.gov.br)." },
        { status: 400 },
      );
    }

    const upstream = await fetch(safeUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OrionFiscalConsulta/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    const finalUrl = upstream.url || safeUrl.toString();
    const contentType = upstream.headers.get("content-type") || "";
    const text = await upstream.text();

    if (!upstream.ok) {
      return Response.json({
        status: "requires_human_action",
        portalUrl: finalUrl,
        message: `O portal estadual respondeu HTTP ${upstream.status}. Consulte manualmente no portal oficial e importe o XML, PDF ou foto.`,
      });
    }

    if (contentType.includes("xml") || text.trim().startsWith("<?xml") || text.includes("<infNFe")) {
      return Response.json({
        status: "xml",
        portalUrl: finalUrl,
        xml: text.slice(0, 1_500_000),
      });
    }

    const extracted = extractPublicNfceHtml(text);
    if (extracted.requiresHumanAction) {
      return Response.json({
        status: "requires_human_action",
        portalUrl: finalUrl,
        message:
          "O portal estadual exige validação humana (CAPTCHA ou login). Abra o portal oficial e importe o XML, PDF ou foto da nota.",
      });
    }

    if (!extracted.store && extracted.items.length === 0 && extracted.totalCents === 0) {
      return Response.json({
        status: "partial",
        portalUrl: finalUrl,
        message:
          "Documento identificado, mas os produtos ainda não puderam ser extraídos automaticamente desse layout de portal.",
      });
    }

    return Response.json({
      status: extracted.items.length > 0 ? "extracted" : "partial",
      portalUrl: finalUrl,
      receipt: {
        store: extracted.store,
        cnpj: extracted.cnpj,
        issuedAt: extracted.issuedAt,
        issuedTime: extracted.issuedTime,
        totalCents: extracted.totalCents,
        items: extracted.items,
      },
    });
  } catch (e) {
    return Response.json({
      status: "requires_human_action",
      portalUrl: String(body?.url || ""),
      message:
        e instanceof Error
          ? `Não foi possível consultar o portal automaticamente (${e.message}). Consulte manualmente e anexe o XML, PDF ou foto.`
          : "Consulta automática indisponível no momento.",
    });
  }
}

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    docType: { type: "string" },
    store: { type: "string" },
    cnpj: { type: "string" },
    emitterAddress: { type: "string" },
    issuedAt: { type: "string" },
    issuedTime: { type: "string" },
    accessKey: { type: "string" },
    number: { type: "string" },
    series: { type: "string" },
    paymentMethod: { type: "string" },
    discountCents: { type: "integer" },
    totalCents: { type: "integer" },
    lowConfidenceFields: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          ean: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          unitPriceCents: { type: "integer" },
          discountCents: { type: "integer" },
          totalCents: { type: "integer" },
        },
      },
    },
  },
} as const;

function extractOutputText(response: unknown): string {
  const r = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof r.output_text === "string" && r.output_text.trim()) return r.output_text.trim();
  for (const item of r.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return "";
}

export async function handleFiscalOcr(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mimeType?: unknown;
      base64?: unknown;
    };
    const { mimeType, base64 } = body;
    if (
      typeof mimeType !== "string" ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mimeType) ||
      typeof base64 !== "string" ||
      base64.length > 11_000_000
    ) {
      return Response.json({ error: "Anexe foto ou PDF até 8 MB" }, { status: 400 });
    }

    if (mimeType === "application/pdf") {
      return Response.json(
        {
          error:
            "OCR de PDF ainda não está disponível nesta versão. Fotografe a nota ou envie uma imagem (JPG/PNG/WebP).",
        },
        { status: 422 },
      );
    }

    const response = await generateResponse({
      model: "openai/gpt-6-astra",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64}`,
              detail: "high",
            },
            {
              type: "input_text",
              text: "Extraia os dados reais desta nota fiscal brasileira (NFC-e, NF-e, DANFE, NFS-e ou cupom). Retorne SOMENTE campos legíveis no documento, com totalCents, discountCents e unitPriceCents em inteiros de centavos, issuedAt em YYYY-MM-DD, issuedTime em HH:MM e accessKey com 44 dígitos. Não invente dados ausentes ou ilegíveis; liste quaisquer campos incertos em lowConfidenceFields.",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fiscal_receipt",
          strict: false,
          schema: RECEIPT_SCHEMA,
        },
      },
    });

    const output = extractOutputText(response);
    if (!output) {
      throw new Error("OCR não retornou dados");
    }
    return Response.json({ receipt: JSON.parse(output) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 424 },
    );
  }
}
