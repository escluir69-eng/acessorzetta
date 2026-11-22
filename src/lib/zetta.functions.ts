import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const testPluggyConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ clientId: z.string().uuid(), clientSecret: z.string().min(1).max(500) })).handler(async ({ data, context }) => {
  const { handlePluggyConfig } = await import('@/server/pluggy');
  const response = await handlePluggyConfig(context.userId, '1', new Request('https://zetta.local/config', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }));
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível conectar à Pluggy.');
  return { ok: true, status: response.status };
});
export const getPluggyConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { handlePluggyStatus } = await import('@/server/pluggy');
  const response = await handlePluggyStatus(context.userId);
  const result = await response.json() as { slots?: Array<{ slot: string; configured: boolean; itemIds: string[] }>; error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível consultar a conexão.');
  return result.slots ?? [];
});
export const synchronizePluggy = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { handlePluggySync } = await import('@/server/pluggy');
  const response = await handlePluggySync(context.userId, '1');
  const result = await response.json() as { accounts?: number; transactions?: number; error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível sincronizar.');
  return { accounts: result.accounts ?? 0, transactions: result.transactions ?? 0 };
});

export const testSavedPluggyConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { handlePluggyConnectToken } = await import('@/server/pluggy');
  const response = await handlePluggyConnectToken(context.userId, '1');
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível validar a conexão salva.');
  // The banking session token must never be returned by a health check.
  return { ok: true, status: response.status };
});