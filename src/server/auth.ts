/** Verifica o token de sessão enviado pelo app e retorna o uid do usuário. */
export async function requireUserId(request: Request): Promise<string | null> {
  const bearer = request.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return null;
  const token = bearer.slice(7).trim();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export function unauthorized(message = "Sessão necessária"): Response {
  return Response.json({ error: message }, { status: 401 });
}
