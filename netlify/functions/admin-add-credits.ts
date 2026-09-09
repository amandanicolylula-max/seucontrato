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

    // Verifica role — só sócio pode adicionar cortesia
    const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "socio") return json({ error: "Apenas sócios podem adicionar créditos cortesia" }, 403)

    const { workspace_id, quantidade, descricao } = await req.json()
    const qty = parseInt(String(quantidade))
    if (!workspace_id || isNaN(qty) || qty <= 0) return json({ error: "workspace_id e quantidade (>0) obrigatórios" }, 400)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Atualiza saldo_avulso + cria transaction
    const { data: bal } = await supabaseAdmin.from("credit_balances").select("saldo_avulso").eq("workspace_id", workspace_id).single()
    if (!bal) return json({ error: "Workspace sem credit_balance" }, 404)

    const { error: updErr } = await supabaseAdmin
      .from("credit_balances")
      .update({ saldo_avulso: bal.saldo_avulso + qty, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
    if (updErr) return json({ error: updErr.message }, 500)

    const { error: txErr } = await supabaseAdmin.from("credit_transactions").insert({
      workspace_id,
      user_id: user.id,
      tipo: "bonus_corplaw",
      quantidade: qty,
      descricao: descricao || `Cortesia CorpLaw (${qty} créditos)`,
    })
    if (txErr) return json({ error: txErr.message }, 500)

    return json({ success: true, novo_saldo_avulso: bal.saldo_avulso + qty }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/admin-add-credits" }
