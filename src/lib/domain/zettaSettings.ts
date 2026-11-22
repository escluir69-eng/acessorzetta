import { z } from 'zod';
import { pixMerchantText } from './contracts';
import type { Database } from '@/integrations/supabase/types';

export type ZettaSettings = Database['public']['Tables']['user_settings']['Row'];
export const ACCENT_COLORS = ['#0C1928', '#173D4A', '#B99555', '#276477', '#3C6B54', '#854D5E', '#785C88', '#A44C36', '#4268A2', '#64706C'] as const;
export const avatarSchema = z.object({ size: z.number().max(5 * 1024 * 1024, 'A foto deve ter até 5 MB.'), type: z.enum(['image/jpeg', 'image/png', 'image/webp'], { errorMap: () => ({ message: 'Use uma foto JPG, PNG ou WebP.' }) }) });
export const accentSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Informe uma cor hexadecimal válida.');
export function pixDefaults(name: string, city: string) { return { name: pixMerchantText(name, 25), city: pixMerchantText(city, 15) }; }
export function maskDocument(raw: string) {
  const n = raw.replace(/\D/g, '').slice(0, 14);
  return n.length <= 11 ? n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2') : n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,4})$/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
export function accentForeground(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (((n >> 16) & 255) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) / 255;
  return luminance > .58 ? 'var(--brand-night)' : 'var(--brand-ice)';
}