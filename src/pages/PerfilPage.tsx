import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera, Check, CheckCircle2, ChevronRight, Copy, Download, Eye, EyeOff, Fingerprint, KeyRound, Landmark, Link2, LoaderCircle, LogOut, Mail, Monitor, Moon, Palette, QrCode, RefreshCw, Save, ShieldCheck, Smartphone, Sun, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/layout/AppShell';
import { GoogleLogo } from '@/components/GoogleLogo';
import { OrionImportPanel } from '@/components/OrionImportPanel';
import { PluggySettings } from '@/components/PluggySettings';
import { useZettaPreferences } from '@/components/ZettaPreferences';
import { useOrion } from '@/store/orionContext';
import { supabase } from '@/integrations/supabase/client';
import { ACCENT_COLORS, accentSchema, avatarSchema, maskDocument, pixDefaults } from '@/lib/domain/zettaSettings';
import { getPluggyConnection, synchronizePluggy, testPluggyConnection } from '@/lib/zetta.functions';
import { downloadBlob } from '@/lib/domain/invoice';
import { makeZettaPixPreview } from '@/lib/domain/zettaPix';

const tabs = [ { id: 'personal', label: 'Dados pessoais', icon: UserRound }, { id: 'appearance', label: 'Aparência', icon: Palette }, { id: 'security', label: 'Segurança e acesso', icon: ShieldCheck }, { id: 'banks', label: 'Integrações bancárias', icon: Landmark }, { id: 'pix', label: 'Pix rápido', icon: QrCode }, { id: 'privacy', label: 'Dados e privacidade', icon: Fingerprint } ] as const;
type Tab = typeof tabs[number]['id'];
export function PerfilPage() {
  const { user, state, signOutUser, updateProfile, updatePixRecipient, exportBackupJson, clearAllUserData } = useOrion();
  const { settings, avatar, save, preview, loading, error } = useZettaPreferences();
  const [tab, setTab] = useState<Tab>('personal');
  const [name, setName] = useState('');
  const [preferred, setPreferred] = useState('');
  const [document, setDocument] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [theme, setTheme] = useState('system');
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [pixType, setPixType] = useState('EMAIL');
  const [pixKey, setPixKey] = useState('');
  const [pixName, setPixName] = useState('');
  const [pixCity, setPixCity] = useState('');
  const [prefix, setPrefix] = useState('ZETTA');
  const [qr, setQr] = useState('');
  const [payload, setPayload] = useState('');
  const [qrError, setQrError] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const testConnection = useServerFn(testPluggyConnection);
  const readConnection = useServerFn(getPluggyConnection);
  const syncConnection = useServerFn(synchronizePluggy);
  const identities = useQuery({ queryKey: ['zetta-identities', user?.uid], enabled: Boolean(user) && tab === 'security', queryFn: async () => { const { data, error } = await supabase.auth.getUserIdentities(); if (error) throw error; return data?.identities ?? []; } });
  const pluggy = useQuery({ queryKey: ['zetta-pluggy', user?.uid], enabled: Boolean(user) && tab === 'banks', queryFn: () => readConnection() });
  useEffect(() => {
    setName(settings?.full_name || state.profile.name); setPreferred(settings?.preferred_name ?? ''); setDocument(maskDocument(settings?.document ?? '')); setWhatsapp(settings?.whatsapp ?? ''); setTheme(settings?.theme ?? 'system'); setColor(settings?.accent_color ?? ACCENT_COLORS[0]); setAutoSync(settings?.pluggy_auto_sync ?? false);
    setPixType(settings?.pix_key_type ?? 'EMAIL'); setPixKey(settings?.pix_key || state.pixRecipient.key); setPixName(settings?.pix_merchant_name || pixDefaults(state.pixRecipient.name, state.pixRecipient.city).name); setPixCity(settings?.pix_merchant_city || pixDefaults(state.pixRecipient.name, state.pixRecipient.city).city); setPrefix(settings?.pix_txid_prefix || 'ZETTA');
  }, [settings, state.profile.name, state.pixRecipient]);
  useEffect(() => {
    let live = true; setQr(''); setPayload(''); setQrError('');
    if (tab !== 'pix' || !pixKey || !pixName || !pixCity) return;
    const timer = window.setTimeout(() => { void makeZettaPixPreview({ key: pixKey, name: pixName, city: pixCity, prefix }).then(result => { if (live) { setQr(result.qr); setPayload(result.payload); } }).catch(err => { if (live) setQrError(err instanceof Error ? err.message : 'Dados Pix inválidos.'); }); }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [tab, pixKey, pixName, pixCity, prefix]);
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível concluir.'); } finally { setBusy(false); } }
  async function savePersonal(e: FormEvent) { e.preventDefault(); await run(async () => { await save({ full_name: name.trim(), preferred_name: preferred.trim(), document: document.replace(/\D/g, ''), whatsapp: whatsapp.trim() }); await updateProfile({ ...state.profile, name: name.trim(), email: user?.email ?? state.profile.email }); toast.success('Dados pessoais salvos.'); }); }
  async function uploadAvatar(file?: File) {
    if (!file || !user) return;
    await run(async () => {
      avatarSchema.parse(file);
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
      if (error) throw error;
      try { await save({ avatar_url: path }); } catch (err) { await supabase.storage.from('avatars').remove([path]); throw err; }
      if (settings?.avatar_url.startsWith(`${user.uid}/`)) await supabase.storage.from('avatars').remove([settings.avatar_url]);
      toast.success('Foto de perfil atualizada.');
    });
  }
  async function linkGoogle() {
    await run(async () => {
      const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: `${window.location.origin}/login`, queryParams: { prompt: 'select_account' } } });
      if (error) { if (/manual|linking|disabled/i.test(error.message)) throw new Error('A vinculação manual ainda não está habilitada para esta conta. Seu acesso atual foi preservado.'); throw error; }
    });
  }
  async function savePix(e: FormEvent) {
    e.preventDefault(); await run(async () => {
      await makeZettaPixPreview({ key: pixKey, name: pixName, city: pixCity, prefix });
      const merchant = pixDefaults(pixName, pixCity);
      await save({ pix_key_type: pixType, pix_key: pixKey.trim(), pix_merchant_name: merchant.name, pix_merchant_city: merchant.city, pix_txid_prefix: prefix });
      await updatePixRecipient({ ...state.pixRecipient, key: pixKey.trim(), name: merchant.name, city: merchant.city });
      toast.success('Dados do recebedor Pix salvos.');
    });
  }
  const activeTab = tabs.find(t => t.id === tab);
  return <AppShell title="Perfil e configurações" subtitle="Sua conta Zetta" actions={<Button variant="outline" onClick={() => void signOutUser()}><LogOut />Sair</Button>}>
    <div className="zetta-settings">
      <div className="flex flex-wrap items-center gap-5 border-b border-border pb-7">
        <div className="relative"><div className="grid size-20 place-items-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">{(avatar || state.profile.photoUrl) ? <img src={avatar || state.profile.photoUrl} alt="Sua foto de perfil" className="size-full object-cover" /> : (preferred || name || 'Z').slice(0, 2).toUpperCase()}</div><Button size="icon" variant="outline" title="Alterar foto" aria-label="Alterar foto" onClick={() => upload.current?.click()} disabled={busy} className="absolute -right-1 -bottom-1 rounded-full bg-card"><Camera /></Button><input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void uploadAvatar(e.target.files?.[0])} /></div>
        <div className="min-w-0 flex-1"><h2 className="!mb-1 !text-3xl">{settings?.preferred_name || settings?.full_name || state.profile.name || 'Sua conta'}</h2><p className="break-all text-sm text-muted-foreground">{user?.email}</p><div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-brand-gold" />Conta pessoal · Acesso privado</div></div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-success" />Lovable Cloud</span>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[225px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Configurações" className="flex max-w-full gap-1 overflow-x-auto border-b border-border py-4 lg:sticky lg:top-28 lg:block lg:self-start lg:space-y-1 lg:border-0 lg:py-6">{tabs.map(t => <Button key={t.id} variant={t.id === tab ? 'secondary' : 'ghost'} onClick={() => { setTab(t.id); setStatus(''); }} className={`h-11 shrink-0 justify-start gap-3 px-3 text-xs lg:w-full ${t.id === tab ? 'border-l-2 border-accent-user text-primary' : 'text-muted-foreground'}`}><t.icon />{t.label}{t.id === tab && <ChevronRight className="ml-auto hidden lg:block" />}</Button>)}</nav>
        <div className="min-w-0 max-w-4xl pb-10">
          {loading && <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Carregando suas preferências…</p>}
          {error && <p role="alert" className="py-4 text-sm text-destructive">Não foi possível carregar suas preferências. {error.message}</p>}
          {!loading && tab === 'personal' && <>
            <section><h2>Dados pessoais</h2><form onSubmit={savePersonal} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className="zetta-field">Nome completo<input className="zetta-input mt-2" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label><label className="zetta-field">Como a Zetta deve te chamar<input className="zetta-input mt-2" value={preferred} onChange={e => setPreferred(e.target.value)} placeholder="Seu nome preferido" /></label><label className="zetta-field">CPF / CNPJ<input className="zetta-input mt-2" inputMode="numeric" value={document} onChange={e => setDocument(maskDocument(e.target.value))} placeholder="000.000.000-00" /></label><label className="zetta-field">WhatsApp<input className="zetta-input mt-2" type="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/[^+\d ()-]/g, '').slice(0, 20))} placeholder="+55 (11) 99999-9999" /></label></div><Button disabled={busy} type="submit"><Save />Salvar alterações</Button></form></section>
            <section><h2>Assistente e contas conectadas</h2><div className="divide-y divide-border">{[{ icon: Smartphone, name: 'WhatsApp', text: 'Não conectado' }, { icon: Link2, name: 'Alexa', text: settings?.alexa_linked ? 'Vínculo registrado · Conexão não verificada' : 'Não conectada' }].map(item => <div key={item.name} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><item.icon className="size-5 text-brand-gold" /><span className="text-sm font-semibold">{item.name}</span></div><span className="text-xs text-muted-foreground">{item.text}</span></div>)}</div></section>
          </>}
          {!loading && tab === 'appearance' && <>
            <section><h2>Aparência</h2><h3>Tema</h3><div className="mt-4 grid grid-cols-3 gap-3">{[{ id: 'light', label: 'Claro', icon: Sun }, { id: 'dark', label: 'Escuro', icon: Moon }, { id: 'system', label: 'Sistema', icon: Monitor }].map(t => <Button key={t.id} variant="outline" aria-pressed={theme === t.id} onClick={() => { setTheme(t.id); preview(t.id, color); }} className={`h-24 flex-col gap-3 ${theme === t.id ? 'border-primary ring-1 ring-primary' : ''}`}><t.icon className="!size-6" />{t.label}</Button>)}</div></section>
            <section><h2>Cor da sua conta</h2><div className="flex flex-wrap gap-3">{ACCENT_COLORS.map(c => <Button key={c} size="icon" variant="ghost" aria-label={`Cor ${c}`} title={c} aria-pressed={color.toLowerCase() === c.toLowerCase()} onClick={() => { setColor(c); preview(theme, c); }} style={{ '--swatch': c } as CSSProperties} className="zetta-swatch size-11 rounded-full border-4 border-background ring-1 ring-border hover:ring-primary">{color.toLowerCase() === c.toLowerCase() && <Check className="text-brand-ice" />}</Button>)}</div><div className="mt-6 flex max-w-xs items-end gap-3"><label className="zetta-field flex-1">Cor personalizada<input className="zetta-input mt-2 font-mono" value={color} maxLength={7} onChange={e => { setColor(e.target.value); if (accentSchema.safeParse(e.target.value).success) preview(theme, e.target.value); }} /></label><input type="color" aria-label="Selecionar cor personalizada" value={accentSchema.safeParse(color).success ? color : ACCENT_COLORS[0]} onChange={e => { setColor(e.target.value); preview(theme, e.target.value); }} className="size-11 cursor-pointer rounded-md border border-border bg-background p-1" /></div><Button disabled={busy} className="mt-6" onClick={() => void run(async () => { accentSchema.parse(color); await save({ theme, accent_color: color }); toast.success('Aparência salva na sua conta.'); })}><Save />Salvar aparência</Button></section>
          </>}
          {!loading && tab === 'security' && <>
            <section><h2>Contas de acesso</h2><div className="flex items-center gap-3 border-b border-border pb-5"><Mail className="size-5 text-brand-gold" /><div className="min-w-0"><h3>E-mail principal</h3><p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p></div></div>{identities.isLoading && <p className="py-4 text-sm">Consultando contas…</p>}{identities.error && <p role="alert" className="py-3 text-sm text-destructive">{identities.error.message}</p>}{identities.data?.map(identity => <div key={identity.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4"><div className="flex min-w-0 items-center gap-3">{identity.provider === 'google' ? <GoogleLogo /> : <KeyRound className="size-4" />}<div className="min-w-0"><h3 className="capitalize">{identity.provider === 'email' ? 'E-mail e senha' : identity.provider}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{String(identity.identity_data?.['email'] ?? user?.email ?? '')}</p></div></div>{(identities.data?.length ?? 0) > 1 && identity.provider !== 'email' ? <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { if (!window.confirm('Desconectar este método de acesso?')) return; const { error } = await supabase.auth.unlinkIdentity(identity); if (error) throw error; await identities.refetch(); toast.success('Método desconectado.'); })}><Link2 />Desconectar</Button> : <span className="text-xs text-muted-foreground">Conectado</span>}</div>)}{!identities.data?.some(i => i.provider === 'google') && <Button className="google-button mt-5" variant="outline" disabled={busy} onClick={() => void linkGoogle()}><GoogleLogo />Vincular conta Google</Button>}</section>
            <section><h2>Alterar senha</h2><form className="max-w-lg space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword }); if (error) throw error; setCurrentPassword(''); setNewPassword(''); toast.success('Senha alterada.'); }); }}><label className="zetta-field">Senha atual<input className="zetta-input mt-2" type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label><label className="zetta-field">Nova senha<input className="zetta-input mt-2" type="password" required minLength={6} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><Button type="submit" disabled={busy}><KeyRound />Atualizar senha</Button></form></section>
          </>}
          {!loading && tab === 'banks' && <>
            <section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="!mb-0">Pluggy · Open Finance</h2><span className="text-xs text-muted-foreground">{pluggy.isLoading ? 'Consultando…' : pluggy.data?.some(s => s.configured) ? 'Credenciais cadastradas' : 'Não configurado'}</span></div>{pluggy.error && <p className="mt-4 text-sm text-destructive">{pluggy.error.message}</p>}<form className="mt-6 space-y-5" onSubmit={e => { e.preventDefault(); void run(async () => { setStatus(''); const result = await testConnection({ data: { clientId: clientId.trim(), clientSecret } }); setStatus(`Conexão validada · HTTP ${result.status} · Credenciais salvas com segurança.`); setClientId(''); setClientSecret(''); await pluggy.refetch(); }); }}><label className="zetta-field">Client ID<div className="relative mt-2"><input className="zetta-input pr-12 font-mono" value={clientId} onChange={e => setClientId(e.target.value)} required placeholder="Client ID da Pluggy" autoComplete="off" /><Button variant="ghost" size="icon" type="button" title="Copiar Client ID" aria-label="Copiar Client ID" className="absolute top-1 right-1" onClick={() => void navigator.clipboard.writeText(clientId).then(() => toast.success('Client ID copiado.')).catch(() => toast.error('Não foi possível copiar.'))}><Copy /></Button></div></label><label className="zetta-field">Client Secret<div className="relative mt-2"><input className="zetta-input !pr-24" type={showSecret ? 'text' : 'password'} required value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client Secret da Pluggy" autoComplete="off" /><div className="absolute top-1 right-1 flex"><Button type="button" size="icon" variant="ghost" title={showSecret ? 'Ocultar segredo' : 'Mostrar segredo'} aria-label={showSecret ? 'Ocultar segredo' : 'Mostrar segredo'} onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff /> : <Eye />}</Button><Button type="button" size="icon" variant="ghost" title="Copiar Client Secret" aria-label="Copiar Client Secret" onClick={() => void navigator.clipboard.writeText(clientSecret).then(() => toast.success('Segredo copiado.')).catch(() => toast.error('Não foi possível copiar.'))}><Copy /></Button></div></div></label><Button disabled={busy}><ShieldCheck />{busy ? 'Validando…' : 'Testar conexão e salvar'}</Button></form>{status && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0" />{status}</p>}</section>
            <section><div className="flex flex-wrap items-center justify-between gap-4"><div><h3>Sincronização automática</h3><p className="mt-1 text-xs text-muted-foreground">Sincronizar ao abrir a Zetta, uma vez ao dia.</p></div><Switch aria-label="Sincronização automática" checked={autoSync} disabled={busy} onCheckedChange={v => { setAutoSync(v); void run(async () => { await save({ pluggy_auto_sync: v }); toast.success('Preferência de sincronização salva.'); }); }} /></div><div className="mt-6 flex flex-wrap gap-3"><Button variant="outline" disabled={busy || !pluggy.data?.some(s => s.configured)} onClick={() => void run(async () => { const result = await syncConnection(); setStatus(`${result.accounts} contas e ${result.transactions} movimentações sincronizadas.`); })}><RefreshCw />Sincronizar agora</Button><PluggySettings /></div></section>
          </>}
          {!loading && tab === 'pix' && <section><h2>Pix rápido</h2><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]"><form onSubmit={savePix} className="min-w-0 space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className="zetta-field">Tipo de chave<select className="zetta-input mt-2" value={pixType} onChange={e => { setPixType(e.target.value); setPixKey(''); }}>{[['CPF','CPF'],['CNPJ','CNPJ'],['EMAIL','E-mail'],['PHONE','Telefone'],['RANDOM','Aleatória']].map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="zetta-field">Chave Pix<input required className="zetta-input mt-2" value={pixKey} type={pixType === 'EMAIL' ? 'email' : 'text'} inputMode={pixType === 'CPF' || pixType === 'CNPJ' ? 'numeric' : 'text'} onChange={e => setPixKey(pixType === 'CPF' || pixType === 'CNPJ' ? e.target.value.replace(/\D/g,'').slice(0,pixType === 'CPF' ? 11 : 14) : e.target.value.slice(0,77))} /></label></div><label className="zetta-field">Nome do beneficiário<input required maxLength={25} className="zetta-input mt-2" value={pixName} onChange={e => setPixName(pixDefaults(e.target.value, pixCity).name)} /><span className="mt-1 block text-right text-[10px] text-muted-foreground">{pixName.length}/25</span></label><div className="grid gap-5 sm:grid-cols-2"><label className="zetta-field">Cidade<input required maxLength={15} className="zetta-input mt-2" value={pixCity} onChange={e => setPixCity(pixDefaults(pixName, e.target.value).city)} /><span className="mt-1 block text-right text-[10px] text-muted-foreground">{pixCity.length}/15</span></label><label className="zetta-field">Prefixo TxID<input className="zetta-input mt-2" maxLength={20} value={prefix} onChange={e => setPrefix(e.target.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase())} /></label></div><Button disabled={busy} type="submit"><Save />Salvar dados Pix</Button></form><div className="self-start rounded-lg border border-border bg-card p-5 text-center"><div className="text-[10px] font-semibold uppercase text-muted-foreground">Prévia · Pix de R$ 50,00</div><div className="mt-4 grid aspect-square place-items-center">{qr ? <img src={qr} alt="QR Code Pix de teste no valor de cinquenta reais" className="w-full" /> : <QrCode className="size-20 text-muted-foreground/40" />}</div><p className="mt-3 text-2xl font-semibold tabular-nums">R$ 50,00</p><p className="mt-2 break-words text-xs text-muted-foreground">{pixName || 'Beneficiário'}<br />{pixCity || 'Cidade'}</p><span className="mt-3 block text-[10px] text-muted-foreground">Apenas prévia · Nenhuma cobrança enviada</span>{payload && <Button variant="ghost" size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(payload).then(() => toast.success('Pix de teste copiado.')).catch(() => toast.error('Não foi possível copiar.'))}><Copy />Copiar Pix de teste</Button>}{qrError && <p role="alert" className="mt-3 text-xs text-destructive">{qrError}</p>}</div></div></section>}
          {!loading && tab === 'privacy' && <><section><h2>Seus dados</h2><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => { downloadBlob(new Blob([exportBackupJson()], { type: 'application/json' }), 'zetta-backup.json'); toast.success('Backup exportado.'); }}><Download />Exportar backup</Button><Button variant="outline" onClick={() => setConfirmClear(true)}><Trash2 />Limpar meus registros</Button></div>{confirmClear && <div role="alert" className="mt-5 border-l-2 border-destructive pl-4"><p className="mb-3 text-sm text-destructive">Apagar todos os registros financeiros, agenda e cadastros? Esta ação não pode ser desfeita.</p><div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={busy} onClick={() => void run(async () => { await clearAllUserData(); setConfirmClear(false); toast.success('Registros apagados.'); })}>Apagar registros</Button><Button variant="outline" onClick={() => setConfirmClear(false)}>Cancelar</Button></div></div>}</section><OrionImportPanel /></>}
          {busy && <span role="status" className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Salvando…</span>}
        </div>
      </div>
    </div>
  </AppShell>;
}
