import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

// Endpoint PÚBLICO — recebe token, retorna info do convite (sem auth)
export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" },
    })
  }

  try {
    const { token } = await req.json()
    if (!token) return json({ error: "Token obrigatório" }, 400)

    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Config incompleta" }, 500)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("*, workspaces(nome), profiles!workspace_invites_invited_by_fkey(full_name)")
      .eq("token", token)
      .maybeSingle()

    if (!invite) return json({ error: "Convite não encontrado ou inválido" }, 404)

    if (invite.status === "accepted") return json({ error: "Este convite já foi aceito" }, 400)
    if (invite.status === "revoked") return json({ error: "Este convite foi cancelado" }, 400)
    if (new Date(invite.expires_at) < new Date()) {
      // Marca como expirado (idempotente)
      await supabaseAdmin.from("workspace_invites").update({ status: "expired" }).eq("id", invite.id)
      return json({ error: "Este convite expirou. Peça um novo ao dono da conta." }, 400)
    }

    // Verifica se já existe conta com esse email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === invite.email.toLowerCase())

    return json({
      success: true,
      email: invite.email,
      workspace_nome: invite.workspaces?.nome,
      inviter_name: invite.profiles?.full_name,
      expires_at: invite.expires_at,
      has_account: !!existingUser,
    }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/validate-invite" }
