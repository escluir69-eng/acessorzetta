import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ZettaLogo } from '@/components/ZettaLogo';

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Redefinir senha — Zetta' }, { name: 'description', content: 'Recupere com segurança o acesso à sua conta Zetta.' }, { property: 'og:title', content: 'Redefinir senha — Zetta' }, { property: 'og:description', content: 'Recupere com segurança o acesso à sua conta Zetta.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ResetPassword,
});
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('type') === 'recovery') {
      void supabase.auth.getUser().then(({ data, error }) => { if (!error && data.user) setRecovery(true); });
    }
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!recovery) return;
    if (password !== confirmation) { setMessage('As senhas não coincidem.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setMessage(error ? error.message : 'Sua senha foi atualizada.');
    if (!error) setDone(true);
  }
  return <main className="grid min-h-dvh place-items-center bg-background p-6"><div className="w-full max-w-sm"><ZettaLogo variant="vertical" className="mb-8" /><h1 className="text-3xl">Nova senha</h1>{recovery && !done ? <form className="mt-6 space-y-4" onSubmit={submit}><label className="zetta-field">Nova senha<input className="zetta-input mt-2" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label className="zetta-field">Confirmar senha<input className="zetta-input mt-2" type="password" required minLength={6} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><Button className="w-full" disabled={busy}>Salvar nova senha</Button></form> : !done && <p className="mt-4 text-sm text-muted-foreground">Abra o link de recuperação recebido por e-mail para definir uma nova senha.</p>}{message && <p role="status" className="mt-4 text-sm">{message}</p>}<Button asChild variant="link" className="mt-4"><Link to="/login">Voltar para entrar</Link></Button></div></main>;
}
