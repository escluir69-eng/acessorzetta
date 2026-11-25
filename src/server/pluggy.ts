/**
 * Integração Pluggy (Open Finance) do Órion — portada do serverIntegrations.ts.
 * Credenciais de cada usuário ficam criptografadas (AES-256-GCM) em
 * firestore_docs no caminho users/{uid}/pluggySettings/pluggy{slot}.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";

type Slot = "1" | "2";

function parseSlot(value: string | undefined): Slot {
  if (value !== "1" && value !== "2") throw new Error("Conexão inválida");
  return value;
}

function secretKey(): Buffer {
  const envSecret = process.env["ORION_INTEGRATION_ENCRYPTION_KEY"];
  if (!envSecret || envSecret.length < 32) {
    throw new Error(
      "ORION_INTEGRATION_ENCRYPTION_KEY não configurada no servidor (mínimo 32 caracteres).",
    );
  }
  return createHash("sha256").update(envSecret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decrypt(value: string): string {
  const [i, t, data] = value.split(":");
  if (!i || !t || !data) throw new Error("Credencial inválida");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(i, "base64"));
  decipher.setAuthTag(Buffer.from(t, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// --- armazenamento das configurações (firestore_docs via admin) --------------

interface PluggySettingsData {
  ownerId: string;
  clientId?: string;
  clientSecret?: string;
  itemIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

function settingsPath(uid: string, slot: Slot): string {
  return `users/${uid}/pluggySettings/pluggy${slot}`;
}

async function readSettings(uid: string, slot: Slot): Promise<PluggySettingsData | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("firestore_docs")
    .select("data")
    .eq("path", settingsPath(uid, slot))
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as PluggySettingsData | undefined) ?? null;
}

async function writeSettings(uid: string, slot: Slot, data: PluggySettingsData): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("firestore_docs").upsert(
    {
      path: settingsPath(uid, slot),
      user_id: uid,
      data: data as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "path" },
  );
  if (error) throw error;
}

async function getConfig(uid: string, slot: Slot) {
  const data = await readSettings(uid, slot);
  if (!data?.clientId || !data.clientSecret) {
    throw new Error(`Configure Meu Pluggy ${slot} antes de conectar`);
  }
  return {
    clientId: decrypt(String(data.clientId)),
    clientSecret: decrypt(String(data.clientSecret)),
    itemIds: Array.isArray(data.itemIds) ? data.itemIds.map(String) : [],
  };
}

// --- Pluggy API ----------------------------------------------------------------

async function parseExternalPluggyJson(
  response: globalThis.Response,
  endpointLabel: string,
): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  const trimmed = raw.trimStart().toLowerCase();
  if (
    contentType.toLowerCase().includes("text/html") ||
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html")
  ) {
    throw new Error(
      `Pluggy retornou HTML (HTTP ${response.status}) em ${endpointLabel} em vez de JSON.`,
    );
  }

  let json: Record<string, unknown> = {};
  if (raw.trim().length > 0) {
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Pluggy retornou resposta inválida não-JSON (HTTP ${response.status}) em ${endpointLabel}.`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      `Pluggy HTTP ${response.status}: ${String(json["message"] || json["error"] || "Falha na API").slice(0, 200)}`,
    );
  }
  return json;
}

const PLUGGY_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePluggyCredentialInput(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

function validatePluggyCredentialsFormat(
  rawClientId: string,
  rawClientSecret: string,
): { ok: true; clientId: string; clientSecret: string } | { ok: false; error: string } {
  const clientId = normalizePluggyCredentialInput(rawClientId);
  const clientSecret = normalizePluggyCredentialInput(rawClientSecret);

  if (!clientId || !clientSecret || clientId.length > 250 || clientSecret.length > 500) {
    return { ok: false, error: "Informe Client ID e Client Secret válidos." };
  }
  if (!PLUGGY_UUID_REGEX.test(clientId)) {
    if (PLUGGY_UUID_REGEX.test(clientSecret)) {
      return {
        ok: false,
        error:
          "O Client ID informado não é um UUID válido e parece estar invertido com o Client Secret. No painel Meu Pluggy, o Client ID tem formato UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).",
      };
    }
    return {
      ok: false,
      error:
        "Client ID inválido: no painel Meu Pluggy, o Client ID deve ser um UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Confira se não copiou outro campo, rótulo ou espaços extras.",
    };
  }
  return { ok: true, clientId, clientSecret };
}

function translatePluggyAuthMessage(msg: string): string {
  if (/clientId must be a UUID/i.test(msg)) {
    return "O Client ID salvo não é um UUID válido para a Pluggy. Informe o Client ID (UUID) e o Client Secret corretos no formulário e clique em Atualizar.";
  }
  return msg;
}

async function pluggyJson(path: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(`https://api.pluggy.ai${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(25000),
  });
  return parseExternalPluggyJson(response, path);
}

async function keyFor(uid: string, slot: Slot) {
  const config = await getConfig(uid, slot);
  const response = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const body = (await parseExternalPluggyJson(response, "/auth")) as { apiKey?: string };
  if (!body.apiKey) throw new Error("Pluggy não retornou API Key");
  return { key: body.apiKey, config };
}

function formatAdminError(err: unknown): { status: number; message: string } {
  const msg = translatePluggyAuthMessage(err instanceof Error ? err.message : String(err));
  if (msg.includes("ORION_INTEGRATION_ENCRYPTION_KEY")) {
    return { status: 422, message: msg };
  }
  if (
    msg.includes("Configure Meu Pluggy") ||
    msg.includes("Conexão inválida") ||
    msg.includes("UUID inválido")
  ) {
    return { status: 422, message: msg };
  }
  return { status: 424, message: msg };
}

function errorResponse(e: unknown): Response {
  const formatted = formatAdminError(e);
  return Response.json({ error: formatted.message }, { status: formatted.status });
}

// --- handlers ------------------------------------------------------------------

export function handlePluggyHealth(): Response {
  const envConfigured =
    typeof process.env["ORION_INTEGRATION_ENCRYPTION_KEY"] === "string" &&
    process.env["ORION_INTEGRATION_ENCRYPTION_KEY"].length >= 32;
  return Response.json({
    ok: true,
    routesRegistered: true,
    encryptionConfigured: true,
    envEncryptionConfigured: envConfigured,
    timestamp: new Date().toISOString(),
  });
}

export async function handlePluggyStatus(uid: string): Promise<Response> {
  try {
    const slots = await Promise.all(
      (["1", "2"] as Slot[]).map(async (s) => {
        const d = await readSettings(uid, s);
        return {
          slot: s,
          configured: Boolean(d?.clientId),
          itemIds: Array.isArray(d?.itemIds) ? d.itemIds : [],
          updatedAt: typeof d?.updatedAt === "string" ? d.updatedAt : null,
        };
      }),
    );
    return Response.json({ slots, storageMode: "firestore-admin" });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handlePluggyConfig(uid: string, rawSlot: string, request: Request): Promise<Response> {
  try {
    const s = parseSlot(rawSlot);
    const body = (await request.json().catch(() => ({}))) as {
      clientId?: unknown;
      clientSecret?: unknown;
    };
    const { clientId, clientSecret } = body;
    if (typeof clientId !== "string" || typeof clientSecret !== "string") {
      return Response.json({ error: "Informe Client ID e Client Secret válidos" }, { status: 400 });
    }
    const validation = validatePluggyCredentialsFormat(clientId, clientSecret);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Verifica as credenciais ao vivo na Pluggy antes de persistir
    const verifyResp = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: validation.clientId,
        clientSecret: validation.clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const verifyBody = (await parseExternalPluggyJson(verifyResp, "/auth").catch((err) => {
      throw new Error(
        `A Pluggy recusou estas credenciais (${err instanceof Error ? err.message : String(err)}). Confira Client ID e Client Secret no painel Meu Pluggy.`,
      );
    })) as { apiKey?: string };
    if (!verifyBody.apiKey) {
      return Response.json(
        { error: "A Pluggy não retornou uma chave de sessão válida para estas credenciais." },
        { status: 422 },
      );
    }

    const prev = await readSettings(uid, s);
    const now = new Date().toISOString();
    await writeSettings(uid, s, {
      ownerId: uid,
      clientId: encrypt(validation.clientId),
      clientSecret: encrypt(validation.clientSecret),
      itemIds: Array.isArray(prev?.itemIds) ? prev.itemIds : [],
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
    return Response.json({ ok: true, storageMode: "firestore-admin" });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handlePluggyConnectToken(uid: string, rawSlot: string): Promise<Response> {
  try {
    const s = parseSlot(rawSlot);
    const { key } = await keyFor(uid, s);
    const result = await pluggyJson("/connect_token", key, {
      method: "POST",
      body: JSON.stringify({
        options: { clientUserId: `orion:${uid}:${s}` },
      }),
    });
    return Response.json({ connectToken: result["accessToken"] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handlePluggyItem(uid: string, rawSlot: string, request: Request): Promise<Response> {
  try {
    const s = parseSlot(rawSlot);
    const itemId = String(
      ((await request.json().catch(() => ({}))) as { itemId?: unknown })?.itemId || "",
    );
    if (!/^[a-zA-Z0-9-]{6,90}$/.test(itemId)) {
      return Response.json({ error: "Item inválido" }, { status: 400 });
    }
    const { key } = await keyFor(uid, s);
    const item = await pluggyJson(`/items/${encodeURIComponent(itemId)}`, key);
    const owner = item["clientUserId"];
    if (owner != null && owner !== "" && owner !== `orion:${uid}:${s}`) {
      return Response.json(
        { error: "Item não pertence a este usuário e conexão" },
        { status: 401 },
      );
    }

    const prev = await readSettings(uid, s);
    if (!prev) {
      throw new Error(`Configure Meu Pluggy ${s} antes de vincular instituição`);
    }
    const ids = [...new Set([...(Array.isArray(prev.itemIds) ? prev.itemIds : []), itemId])];
    await writeSettings(uid, s, {
      ...prev,
      itemIds: ids,
      updatedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true, storageMode: "firestore-admin" });
  } catch (e) {
    return errorResponse(e);
  }
}

interface PluggyApiAccount {
  id?: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  institution?: { name?: string };
  creditData?: {
    brand?: string;
    creditLimit?: number;
    availableCreditLimit?: number;
    balanceCloseDate?: string;
    balanceDueDate?: string;
  };
}

interface PluggyApiTransaction {
  id?: string;
  description?: string;
  amount?: number;
  date?: string;
  category?: string;
  status?: string;
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
    totalAmount?: number;
    purchaseDate?: string;
    billId?: string;
  };
}

interface SyncedBankDto {
  id: string;
  institution: string;
  name: string;
  accountType: "CHECKING" | "SAVINGS";
  number: string;
  balanceCents: number;
  color: string;
  sourceRecordId: string;
}

interface SyncedCardDto {
  id: string;
  institution: string;
  name: string;
  brand: "VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD" | "OTHER";
  number: string;
  creditLimitCents: number;
  availableCents: number;
  closingDay: number;
  dueDay: number;
  sourceRecordId: string;
}

interface SyncedTxDto {
  id: string;
  accountId: string;
  accountType: "BANK" | "CREDIT";
  accountName: string;
  institution: string;
  description: string;
  amountCents: number;
  date: string;
  category: string;
  status?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  totalAmountCents?: number;
  purchaseDate?: string;
  billId?: string;
}

async function upsertUserDoc(uid: string, sub: string, id: string, data: Record<string, unknown>): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = `users/${uid}/${sub}/${id}`;
  const { data: existing } = await supabaseAdmin
    .from("firestore_docs")
    .select("data")
    .eq("path", path)
    .eq("user_id", uid)
    .maybeSingle();
  const prev = (existing?.data as Record<string, unknown> | undefined) ?? {};
  const now = new Date().toISOString();
  const previousMonths = prev["months"] && typeof prev["months"] === "object" ? prev["months"] as Record<string, Record<string, unknown>> : null;
  const incomingMonths = data["months"] && typeof data["months"] === "object" ? data["months"] as Record<string, Record<string, unknown>> : null;
  const mergedMonths = previousMonths && incomingMonths
    ? Object.fromEntries(Object.entries(incomingMonths).map(([month, cell]) => [month, { ...(previousMonths[month] ?? {}), ...cell }]))
    : incomingMonths;
  const { error } = await supabaseAdmin.from("firestore_docs").upsert(
    {
      path,
      user_id: uid,
      data: {
        ...prev,
        ...data,
        ...(mergedMonths ? { months: mergedMonths } : {}),
        ownerId: uid,
        updatedAt: now,
        createdAt: (prev["createdAt"] as string | undefined) ?? now,
      } as unknown as Json,
      updated_at: now,
    },
    { onConflict: "path" },
  );
  if (error) throw error;
}

async function persistCardInstallmentProvision(
  uid: string,
  slot: Slot,
  accountId: string,
  cardId: string,
  cardName: string,
  transaction: SyncedTxDto,
  dueDay: number,
): Promise<void> {
  const number = transaction.installmentNumber;
  const total = transaction.totalInstallments;
  if (!number || !total || total <= 1 || number > total) return;
  const amountCents = Math.abs(transaction.amountCents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return;

  const anchor = transaction.purchaseDate || (() => {
    const date = new Date(`${transaction.date}T12:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - (number - 1));
    return date.toISOString().slice(0, 10);
  })();
  const fingerprint = [accountId, transaction.description.trim().toLocaleLowerCase("pt-BR"), anchor, total].join("|");
  const groupHash = createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);
  const sourceRecordId = `pluggy:${slot}:card-purchase:${groupHash}`;
  const installments: Array<{ period: string; dueDate: string; year: number; month: string }> = [];

  for (let installment = 1; installment <= total; installment++) {
    const date = new Date(`${anchor}T12:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + installment - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = Math.min(Math.max(1, dueDay), new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).getUTCDate());
    installments.push({ year, month, period: `${year}-${month}`, dueDate: `${year}-${month}-${String(day).padStart(2, "0")}` });
  }

  const byYear = new Map<number, Array<{ month: string; dueDate: string }>>();
  for (const installment of installments) {
    const entries = byYear.get(installment.year) ?? [];
    entries.push({ month: installment.month, dueDate: installment.dueDate });
    byYear.set(installment.year, entries);
  }

  for (const [year, yearInstallments] of byYear) {
    const months: Record<string, { expectedCents: number; paidCents: number | null; paidDate: string | null; isSettled: boolean }> = {};
    for (let month = 1; month <= 12; month++) {
      months[String(month).padStart(2, "0")] = { expectedCents: 0, paidCents: null, paidDate: null, isSettled: false };
    }
    for (const installment of yearInstallments) months[installment.month] = { expectedCents: amountCents, paidCents: null, paidDate: null, isSettled: false };
    await upsertUserDoc(uid, "annualExpenses", `card_${groupHash}_${year}`, {
      year,
      creditor: transaction.description.slice(0, 140),
      category: transaction.category.slice(0, 60) || "Cartão de crédito",
      dueDay,
      months,
      expenseKind: "debt",
      expenseSource: "card",
      sourceRecordId,
      cardId,
    });
  }

  for (let index = 0; index < installments.length; index++) {
    const installment = installments[index]!;
    const annualId = `card_${groupHash}_${installment.year}`;
    await upsertUserDoc(uid, "monthlyBills", `card_${groupHash}_${installment.period.replace("-", "")}`, {
      period: installment.period,
      creditor: transaction.description.slice(0, 140),
      category: transaction.category.slice(0, 60) || "Cartão de crédito",
      description: `Compra parcelada no cartão ${cardName}`,
      dueDate: installment.dueDate,
      expectedCents: amountCents,
      paidDate: null,
      paidCents: null,
      isSettled: false,
      sourceAnnualId: annualId,
      installmentNumber: index + 1,
      expenseKind: "debt",
      cardId,
      isCardInvoice: false,
      note: `Parcela ${index + 1}/${total} · Compra em ${anchor}`,
      sourceRecordId,
    });
  }
}

export async function handlePluggySync(uid: string, rawSlot: string): Promise<Response> {
  try {
    const s = parseSlot(rawSlot);
    const { key, config } = await keyFor(uid, s);
    let accounts = 0;
    let transactions = 0;

    const syncedBanks: SyncedBankDto[] = [];
    const syncedCards: SyncedCardDto[] = [];
    const syncedTransactions = new Map<string, SyncedTxDto>();

    for (const itemId of config.itemIds) {
      const item = await pluggyJson(`/items/${encodeURIComponent(itemId)}`, key);
      if (item["status"] === "LOGIN_ERROR") continue;
      const response = await pluggyJson(
        `/accounts?itemId=${encodeURIComponent(itemId)}&pageSize=500`,
        key,
      );
      const accountRows = Array.isArray(response["results"])
        ? (response["results"] as PluggyApiAccount[])
        : [];

      for (const a of accountRows) {
        if (!a.id || (a.type !== "BANK" && a.type !== "CREDIT")) continue;
        const accountId = `pluggy_${s}_${String(a.id).replace(/[^\w-]/g, "_")}`.slice(0, 128);
        const institution = String(a.institution?.name || a.name || "Banco conectado").slice(0, 80);
        const name = String(a.name || a.marketingName || "Conta Pluggy").slice(0, 80);
        const rawNumber = String(a.number || "").trim() || "0000";
        const sourceRecordId = `pluggy:${s}:${a.id}`.slice(0, 128);

        if (a.type === "BANK") {
          const bankDto: SyncedBankDto = {
            id: accountId,
            institution,
            name,
            accountType: a.subtype === "SAVINGS_ACCOUNT" ? "SAVINGS" : "CHECKING",
            number: rawNumber.slice(0, 20),
            balanceCents: Math.round(Number(a.balance || 0) * 100),
            color: "#173d4a",
            sourceRecordId,
          };
          syncedBanks.push(bankDto);
          await upsertUserDoc(uid, "banks", accountId, {
            institution: bankDto.institution,
            name: bankDto.name,
            number: bankDto.number,
            sourceRecordId: bankDto.sourceRecordId,
            accountType: bankDto.accountType,
            balanceCents: bankDto.balanceCents,
            color: bankDto.color,
          });
        } else {
          const credit = a.creditData || {};
          const limit = Math.max(0, Math.round(Number(credit.creditLimit || 0) * 100));
          const brand: SyncedCardDto["brand"] =
            credit.brand &&
            ["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD"].includes(credit.brand)
              ? (credit.brand as SyncedCardDto["brand"])
              : "OTHER";
          const rawCloseDay = Number(String(credit.balanceCloseDate || "").slice(-2));
          const rawDueDay = Number(String(credit.balanceDueDate || "").slice(-2));
          const cardDto: SyncedCardDto = {
            id: accountId,
            institution,
            name,
            brand,
            number: rawNumber.slice(-10) || "0000",
            creditLimitCents: limit,
            availableCents: Math.round(Number(credit.availableCreditLimit || 0) * 100),
            closingDay:
              Number.isInteger(rawCloseDay) && rawCloseDay >= 1 && rawCloseDay <= 31
                ? rawCloseDay
                : 15,
            dueDay:
              Number.isInteger(rawDueDay) && rawDueDay >= 1 && rawDueDay <= 31
                ? rawDueDay
                : 25,
            sourceRecordId,
          };
          syncedCards.push(cardDto);
          await upsertUserDoc(uid, "cards", accountId, {
            institution: cardDto.institution,
            name: cardDto.name,
            number: cardDto.number,
            sourceRecordId: cardDto.sourceRecordId,
            brand: cardDto.brand,
            creditLimitCents: cardDto.creditLimitCents,
            availableCents: cardDto.availableCents,
            closingDay: cardDto.closingDay,
            dueDay: cardDto.dueDay,
          });
        }
        accounts++;

        let next = `?accountId=${encodeURIComponent(String(a.id))}&dateFrom=${new Date(Date.now() - 95 * 86400000).toISOString().slice(0, 10)}`;
        const fallbackIso = new Date().toISOString().slice(0, 10);
        for (let page = 0; page < 5 && next; page++) {
          const tx = await pluggyJson(`/v2/transactions${next}`, key);
          const rows = Array.isArray(tx["results"]) ? (tx["results"] as PluggyApiTransaction[]) : [];
          const txDtos: SyncedTxDto[] = [];
          for (const t of rows) {
            if (!t.id || !Number.isFinite(Number(t.amount))) continue;
            const id = `pluggy_${s}_${String(t.id).replace(/[^\w-]/g, "_")}`.slice(0, 128);
            const rawDate = String(t.date || "").slice(0, 10);
            const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackIso;
            const safeDesc = String(t.description || "Movimentação").trim().slice(0, 160) || "Movimentação";
            const dto: SyncedTxDto = {
              id,
              accountId,
              accountType: a.type as "BANK" | "CREDIT",
              accountName: name.slice(0, 100),
              institution,
              description: safeDesc,
              amountCents: Math.round(Number(t.amount) * 100),
              date: safeDate,
              category: String(t.category || "Sem categoria").slice(0, 60),
              ...(typeof t.status === "string" ? { status: t.status } : {}),
              ...(Number.isInteger(t.creditCardMetadata?.installmentNumber) ? { installmentNumber: t.creditCardMetadata!.installmentNumber } : {}),
              ...(Number.isInteger(t.creditCardMetadata?.totalInstallments) ? { totalInstallments: t.creditCardMetadata!.totalInstallments } : {}),
              ...(Number.isFinite(Number(t.creditCardMetadata?.totalAmount)) ? { totalAmountCents: Math.round(Number(t.creditCardMetadata?.totalAmount) * 100) } : {}),
              ...(typeof t.creditCardMetadata?.purchaseDate === "string" ? { purchaseDate: t.creditCardMetadata.purchaseDate.slice(0, 10) } : {}),
              ...(typeof t.creditCardMetadata?.billId === "string" ? { billId: t.creditCardMetadata.billId } : {}),
              ...(a.type === "CREDIT" && Number.isInteger(t.creditCardMetadata?.installmentNumber) && Number.isInteger(t.creditCardMetadata?.totalInstallments) && Number(t.creditCardMetadata?.totalInstallments) > 1
                ? { purchaseGroupId: createHash("sha256").update([accountId, safeDesc.toLocaleLowerCase("pt-BR"), String(t.creditCardMetadata?.purchaseDate || safeDate), String(t.creditCardMetadata?.totalInstallments)].join("|")).digest("hex").slice(0, 24) }
                : {}),
            };
            txDtos.push(dto);
            syncedTransactions.set(id, dto);
            if (a.type === "CREDIT") {
              const dueDay = Number(String(a.creditData?.balanceDueDate || "").slice(-2));
              await persistCardInstallmentProvision(uid, s, accountId, accountId, name, dto, Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : 25).catch(() => undefined);
            }
            transactions++;
          }

          for (const dto of txDtos) {
            await upsertUserDoc(uid, "transactions", dto.id, {
              accountId: dto.accountId,
              accountType: dto.accountType,
              accountName: dto.accountName,
              institution: dto.institution,
              description: dto.description,
              amountCents: dto.amountCents,
              date: dto.date,
              category: dto.category,
              ...(dto.status ? { status: dto.status } : {}),
              ...(dto.installmentNumber ? { installmentNumber: dto.installmentNumber } : {}),
              ...(dto.totalInstallments ? { totalInstallments: dto.totalInstallments } : {}),
              ...(dto.totalAmountCents !== undefined ? { totalAmountCents: dto.totalAmountCents } : {}),
              ...(dto.purchaseDate ? { purchaseDate: dto.purchaseDate } : {}),
              ...(dto.billId ? { billId: dto.billId } : {}),
              ...(dto.purchaseGroupId ? { purchaseGroupId: dto.purchaseGroupId } : {}),
            });
          }

          next =
            typeof tx["next"] === "string" && tx["next"].startsWith("?") ? tx["next"] : "";
        }
        if (a.type === "CREDIT") {
          try {
            const billsResponse = await pluggyJson(`/bills?accountId=${encodeURIComponent(String(a.id))}&pageSize=500`, key);
            const bills = Array.isArray(billsResponse["results"])
              ? (billsResponse["results"] as Array<Record<string, unknown>>)
              : [];
            for (const bill of bills) {
              const billId = typeof bill["id"] === "string" ? bill["id"] : "";
              if (!billId) continue;
              const dueDateRaw = String(bill["dueDate"] || "");
              const closingDateRaw = String(bill["billClosingDate"] || "");
              const dueDate = /^\d{4}-\d{2}-\d{2}/.test(dueDateRaw) ? dueDateRaw.slice(0, 10) : "";
              const closingDate = /^\d{4}-\d{2}-\d{2}/.test(closingDateRaw) ? closingDateRaw.slice(0, 10) : "";
              const period = (dueDate || closingDate || fallbackIso).slice(0, 7);
              const snapshotId = `pluggy_${s}_bill_${billId.replace(/[^\w-]/g, "_")}`.slice(0, 128);
              const billTransactions = [...syncedTransactions.values()]
                .filter((tx) => tx.accountId === accountId && tx.billId === billId)
                .map((tx) => ({ id: tx.id, date: tx.date, description: tx.description, amount: tx.amountCents / 100, category: tx.category }));
              await upsertUserDoc(uid, "cardMonthSnapshots", snapshotId, {
                accountId,
                accountName: `${institution} · ${name}`,
                isUnlinked: false,
                period,
                capturedAt: new Date().toISOString(),
                closingDate: closingDate || null,
                dueDate: dueDate || null,
                invoiceCents: Number.isFinite(Number(bill["totalAmount"])) ? Math.round(Number(bill["totalAmount"]) * 100) : null,
                providerInvoiceId: billId,
                totalLimitCents: limit,
                availableLimitCents: Math.round(Number(credit.availableCreditLimit || 0) * 100),
                usedLimitCents: Math.max(0, limit - Math.round(Number(credit.availableCreditLimit || 0) * 100)),
                transactions: billTransactions,
                sourceRecordId: `pluggy:${s}:bill:${billId}`,
              });
            }
          } catch {
            // Algumas instituições/conexões não disponibilizam faturas pela API.
            // A sincronização de contas e transações deve continuar normalmente.
          }
        }

      }
    }

    return Response.json({
      ok: true,
      accounts,
      transactions,
      persistedOnServer: true,
      storageMode: "firestore-admin",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
