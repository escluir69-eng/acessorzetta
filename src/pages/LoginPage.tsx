import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Apple, ArrowRight, Eye, EyeOff, Home, Link2, Mail, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ZettaLogo } from '@/components/ZettaLogo';
import { GoogleLogo } from '@/components/GoogleLogo';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useOrion } from '@/store/orionContext';
import home from '@/assets/zetta-smart-home.png.asset.json';

type Mode = 'login' | 'signup' | 'forgot' | 'magic';
export function LoginPage() {
  const { user, authReady } = useOrion();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [other, setOther] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (authReady && user) void navigate({ to: '/painel', replace: true }); }, [authReady, user, navigate]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setNotice('');
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice('Se houver uma conta com este e-mail, você receberá o link para redefinir sua senha.');
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: false } });
        if (error) throw error;
        setNotice('Confira seu e-mail para continuar com o link de acesso.');
      } else if (mode === 'signup') {
        const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setNotice('Confira seu e-mail e confirme o cadastro antes de entrar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível acessar sua conta.'); }
    finally { setLoading(false); }
  }
  async function social(provider: 'google' | 'apple') {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível continuar com este provedor.'); }
    finally { setLoading(false); }
  }
  const titles = { login: 'Bem-vindo de volta', signup: 'Sua vida, mais conectada', forgot: 'Recupere seu acesso', magic: 'Entre com um link' };
  return <div className="zetta-login grid min-h-dvh lg:grid-cols-2">
    <aside className="zetta-login-story flex flex-col bg-brand-night text-brand-ice">
      <div className="px-6 pt-7 sm:px-10 lg:px-12 lg:pt-10"><ZettaLogo tone="light" /></div>
      <img src={home.url} alt="Casa inteligente conectada a um globo por órbitas douradas" className="zetta-home mx-auto w-full object-contain" />
      <div className="mt-auto px-6 pb-7 sm:px-10 lg:px-12 lg:pb-10">
        <h1 className="max-w-xl font-display text-3xl font-medium leading-tight sm:text-4xl">Inteligência conectada para sua vida e patrimônio.</h1>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[Sparkles, 'Assistente Pessoal'], [Home, 'Automação Residencial'], [Link2, 'Alexa & WhatsApp'], [Wallet, 'Open Finance']].map(([Icon, label]) => { const Item = Icon as typeof Home; return <div key={String(label)} className="zetta-micro flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-brand-gold/30 px-2 py-3 text-center text-xs"><Item className="size-5 text-brand-gold" /><span>{String(label)}</span></div>; })}</div>
      </div>
    </aside>
    <main className="flex items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-16">
      <div className="w-full max-w-sm">
        <ZettaLogo variant="icon" className="mx-auto size-24" />
        <h2 className="mt-6 text-center font-display text-3xl font-medium">{titles[mode]}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{mode === 'login' ? 'Seu espaço pessoal está esperando por você.' : mode === 'signup' ? 'Crie sua conta Zetta.' : 'Informe o e-mail da sua conta.'}</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="zetta-field">E-mail<div className="relative mt-2"><Mail className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" /><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail" className="zetta-input pl-10" /></div></label>
          {(mode === 'login' || mode === 'signup') && <label className="zetta-field">Senha<div className="relative mt-2"><input required minLength={6} type={visible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="zetta-input pr-12" /><Button type="button" variant="ghost" size="icon" title={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)} className="absolute top-1 right-1 text-muted-foreground">{visible ? <EyeOff /> : <Eye />}</Button></div></label>}
          {mode === 'login' && <div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => { setMode('forgot'); setNotice(''); }}>Esqueci minha senha</Button></div>}
          {notice && <p role="status" className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">{notice}</p>}
          <Button type="submit" disabled={loading} className="h-12 w-full">{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}<ArrowRight className="text-brand-gold" /></Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou continue com<span className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" disabled={loading} onClick={() => void social('google')} className="google-button h-12 w-full"><GoogleLogo />Continuar com Google</Button>
        <Button variant="link" onClick={() => setOther(!other)} className="mt-4 h-auto min-h-10 w-full whitespace-normal text-center">Vincular / Entrar com outro método</Button>
        {other && <div className="mt-2 grid gap-2"><Button variant="outline" disabled={loading} onClick={() => void social('apple')} className="h-12"><Apple />Continuar com Apple</Button><Button variant="outline" onClick={() => { setMode('magic'); setNotice(''); }}><Mail />Receber link por e-mail</Button><p className="text-center text-xs text-muted-foreground">Para vincular contas, entre e acesse Segurança no seu perfil.</p></div>}
        <div className="mt-6 text-center text-sm text-muted-foreground">{mode === 'login' ? <>Ainda não tem conta? <Button variant="link" className="h-auto p-0" onClick={() => { setMode('signup'); setNotice(''); }}>Criar conta</Button></> : <Button variant="link" onClick={() => { setMode('login'); setNotice(''); }}>Voltar para entrar</Button>}</div>
        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5 text-brand-gold" />Zetta · Seu patrimônio, sua privacidade.</div>
      </div>
    </main>
  </div>;
}
