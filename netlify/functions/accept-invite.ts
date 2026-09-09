import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

// Endpoint PÚBLICO (recebe token + opcionalmente credenciais para criar conta)
// Se authHeader presente → adiciona usuário existente ao workspace
// Se não → cria nova conta com o email do convite + password fornecida
export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    })
  }

  try {
    const { token, password, full_name } = await req.json()
    if (!token) return json({ error: "Token obrigatório" }, 400)

    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Config incompleta" }, 500)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (!invite) return json({ error: "Convite inválido" }, 404)
    if (invite.status !== "pending") return json({ error: "Convite não está mais válido" }, 400)
    if (new Date(invite.expires_at) < new Date()) return json({ error: "Convite expirado" }, 400)

    // Verifica se já existe usuário
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === invite.email.toLowerCase())

    let userId: string

    if (existingUser) {
      // Já tem conta — precisa estar logado com este email
      const authHeader = req.headers.get("authorization")
      if (!authHeader) {
        return json({ error: "Faça login com " + invite.email + " para aceitar o convite", need_login: true, email: invite.email }, 401)
      }

      const supabaseAuth = createClient(supabaseUrl, Netlify.env.get("VITE_SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user: loggedUser } } = await supabaseAuth.auth.getUser()
      if (!loggedUser || loggedUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
        return json({ error: "Você precisa estar logado com o e-mail " + invite.email, need_login: true, email: invite.email }, 401)
      }

      userId = existingUser.id

      // Atualiza role e workspace_id do profile existente
      await supabaseAdmin.from("profiles").update({
        role: invite.role,
        workspace_id: invite.workspace_id,
      }).eq("id", userId)
    } else {
      // Nova conta — precisa de password + full_name
      if (!password || password.length < 6) return json({ error: "Senha (mín 6 caracteres) é obrigatória para criar a conta" }, 400)
      if (!full_name || !full_name.trim()) return json({ error: "Nome completo é obrigatório" }, 400)

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: invite.role,
        },
      })

      if (createErr || !newUser.user) {
        return json({ error: createErr?.message || "Erro ao criar conta" }, 400)
      }

      userId = newUser.user.id

      // Vincula ao workspace via UPDATE (o trigger handle_new_user cria com workspace_id null pra members)
      await supabaseAdmin.from("profiles").update({
        workspace_id: invite.workspace_id,
      }).eq("id", userId)
    }

    // Cria/atualiza member_credit_limit
    if (invite.credit_limit !== null) {
      await supabaseAdmin.from("member_credit_limits").upsert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        limite_mensal: invite.credit_limit,
        consumido_mes: 0,
      })
    } else {
      await supabaseAdmin.from("member_credit_limits").upsert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        limite_mensal: null,
        consumido_mes: 0,
      })
    }

    // Marca convite como aceito
    await supabaseAdmin.from("workspace_invites").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    }).eq("id", invite.id)

    return json({ success: true, workspace_id: invite.workspace_id, user_created: !existingUser }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/accept-invite" }
