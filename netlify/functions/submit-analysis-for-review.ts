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

    const { analysis_id } = await req.json()
    if (!analysis_id) return json({ error: "analysis_id obrigatório" }, 400)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Busca análise + profile do autor
    const [{ data: analysis }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("contract_analyses").select("*").eq("id", analysis_id).single(),
      supabaseAdmin.from("profiles").select("role, supervisor_id").eq("id", user.id).single(),
    ])

    if (!analysis) return json({ error: "Análise não encontrada" }, 404)
    if (!profile) return json({ error: "Perfil não encontrado" }, 404)

    // Só o autor da análise pode submeter
    if (analysis.created_by !== user.id) {
      return json({ error: "Apenas o autor da análise pode enviá-la para revisão" }, 403)
    }

    // Só faz sentido se é estagiário com supervisor
    if (profile.role !== "assistente") {
      return json({ error: "Fluxo de revisão é apenas para estagiários" }, 400)
    }
    if (!profile.supervisor_id) {
      return json({ error: "Você precisa ter um supervisor definido" }, 400)
    }

    // Só pode enviar se estiver em rascunho_estagiario
    if (analysis.status !== "rascunho_estagiario") {
      return json({ error: `Status atual (${analysis.status}) não permite envio para revisão` }, 400)
    }

    const { error: updErr } = await supabaseAdmin
      .from("contract_analyses")
      .update({
        status: "aguardando_revisao",
        reviewer_id: profile.supervisor_id,
        submitted_for_review_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis_id)

    if (updErr) return json({ error: updErr.message }, 500)

    return json({ success: true, reviewer_id: profile.supervisor_id }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/submit-analysis-for-review" }
