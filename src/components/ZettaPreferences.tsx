import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrion } from '@/store/orionContext';
import { accentForeground, accentSchema, type ZettaSettings } from '@/lib/domain/zettaSettings';

const Preferences = createContext<{ settings: ZettaSettings | null; avatar: string; loading: boolean; error: Error | null; save: (patch: Partial<ZettaSettings>) => Promise<void>; preview: (theme: string, color: string) => void }>({ settings: null, avatar: '', loading: true, error: null, save: async () => {}, preview: () => {} });
export const useZettaPreferences = () => useContext(Preferences);

export function ZettaPreferences({ children }: { children: ReactNode }) {
  const { user } = useOrion();
  const queryClient = useQueryClient();
  const [appearance, setAppearance] = useState<{ theme: string; color: string } | null>(null);
  const [avatar, setAvatar] = useState('');
  const query = useQuery({ queryKey: ['zetta-settings', user?.uid], enabled: Boolean(user), queryFn: async () => {
    if (!user) return null;
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.uid).maybeSingle();
    if (error) throw error;
    return data;
  } });
  useEffect(() => { setAppearance(null); }, [user?.uid]);
  useEffect(() => {
    const theme = appearance?.theme ?? query.data?.theme ?? 'system';
    const color = appearance?.color ?? query.data?.accent_color ?? '#0C1928';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
      document.documentElement.style.setProperty('--primary', accentSchema.safeParse(color).success ? color : '#0C1928');
      document.documentElement.style.setProperty('--accent-user', color);
      document.documentElement.style.setProperty('--primary-foreground', accentForeground(color));
    };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query.data?.theme, query.data?.accent_color, appearance, user?.uid]);
  useEffect(() => {
    let live = true;
    const path = query.data?.avatar_url;
    setAvatar('');
    if (path?.startsWith(`${user?.uid}/`)) void supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => { if (live) setAvatar(data?.signedUrl ?? ''); });
    return () => { live = false; };
  }, [query.data?.avatar_url, user?.uid]);
  async function save(patch: Partial<ZettaSettings>) {
    if (!user) throw new Error('Entre na sua conta para salvar.');
    const { data, error } = await supabase.from('user_settings').upsert({ ...patch, user_id: user.uid, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    queryClient.setQueryData(['zetta-settings', user.uid], data);
  }
  return <Preferences.Provider value={{ settings: query.data ?? null, loading: query.isLoading, error: query.error, avatar, save, preview: (theme, color) => setAppearance({ theme, color }) }}>{children}</Preferences.Provider>;
}