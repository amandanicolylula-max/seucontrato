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
    if (!profile?.workspace_id) return json({ error: "Sem workspace vinculado" }, 400)

    const { amount, ref_type, ref_id, descricao } = await req.json()
    const qty = parseInt(String(amount))
    if (isNaN(qty) || qty <= 0) return json({ error: "Quantidade inválida" }, 400)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabaseAdmin.rpc("consume_credits", {
      p_workspace_id: profile.workspace_id,
      p_user_id: user.id,
      p_amount: qty,
      p_ref_type: ref_type || null,
      p_ref_id: ref_id || null,
      p_descricao: descricao || null,
    })

    if (error) return json({ error: error.message }, 500)
    if (!data?.success) return json({ error: data?.error || "Falha ao consumir créditos", data }, 400)

    return json({ success: true, saldo_restante: data.saldo_restante }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/consume-credits" }
