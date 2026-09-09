import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    })
  }

  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) return json({ error: "Token ausente" }, 401)

    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const anonKey = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("VITE_SUPABASE_ANON_KEY")
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "Config incompleta" }, 500)

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return json({ error: "Não autenticado" }, 401)

    const { data: profile } = await supabaseAuth.from("profiles").select("role, workspace_id").eq("id", user.id).single()

    const { workspace_id, new_plan_tipo } = await req.json()
    if (!workspace_id || !new_plan_tipo) return json({ error: "workspace_id e new_plan_tipo obrigatórios" }, 400)

    // Autorização:
    // - cliente_owner do workspace pode mudar seu próprio plano
    // - sócio pode mudar qualquer workspace
    if (profile?.role !== "socio" && !(profile?.role === "cliente_owner" && profile.workspace_id === workspace_id)) {
      return json({ error: "Sem permissão" }, 403)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Busca o novo plano
    const { data: newPlan } = await supabaseAdmin.from("plans").select("*").eq("tipo", new_plan_tipo).single()
    if (!newPlan) return json({ error: "Plano não encontrado" }, 404)

    // Conta membros atuais
    const { count } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("workspace_id", workspace_id)
    const currentMembers = count || 0

    if (currentMembers > newPlan.limite_colaboradores) {
      const excedente = currentMembers - newPlan.limite_colaboradores
      return json({
        error: `Você tem ${currentMembers} membro(s). O plano ${newPlan.nome} permite apenas ${newPlan.limite_colaboradores}. Remova ${excedente} membro(s) antes de fazer downgrade.`,
        code: "excede_limite",
      }, 400)
    }

    // Muda o plano
    const { error: updErr } = await supabaseAdmin.from("workspaces").update({ plan_id: newPlan.id, updated_at: new Date().toISOString() }).eq("id", workspace_id)
    if (updErr) return json({ error: updErr.message }, 500)

    return json({ success: true, plan: newPlan }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/change-plan" }
