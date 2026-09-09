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

    const { data: profile } = await supabaseAuth.from("profiles").select("role, workspace_id, full_name").eq("id", user.id).single()
    if (profile?.role !== "cliente_owner") return json({ error: "Apenas o owner do workspace pode convidar" }, 403)

    const { email, credit_limit } = await req.json()
    if (!email || !email.includes("@")) return json({ error: "E-mail inválido" }, 400)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Validar limite de colaboradores do plano
    const [{ data: workspace }, { count: memberCount }] = await Promise.all([
      supabaseAdmin.from("workspaces").select("*, plans(*)").eq("id", profile.workspace_id).single(),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("workspace_id", profile.workspace_id),
    ])
    const { count: pendingCount } = await supabaseAdmin
      .from("workspace_invites").select("id", { count: "exact", head: true })
      .eq("workspace_id", profile.workspace_id).eq("status", "pending")

    const totalPrevisto = (memberCount || 0) + (pendingCount || 0)
    const limite = workspace?.plans?.limite_colaboradores ?? 0
    if (totalPrevisto >= limite) {
      return json({
        error: `Limite de colaboradores atingido (${memberCount} membros + ${pendingCount} convites pendentes = ${totalPrevisto}/${limite}). Faça upgrade do plano ou revogue convites pendentes.`,
        code: "limite_excedido",
      }, 400)
    }

    // Cria o convite
    const { data: invite, error: insErr } = await supabaseAdmin
      .from("workspace_invites")
      .insert({
        workspace_id: profile.workspace_id,
        email: email.toLowerCase(),
        invited_by: user.id,
        credit_limit: credit_limit ? parseInt(String(credit_limit)) : null,
      })
      .select()
      .single()

    if (insErr) {
      if (insErr.message.includes("unique") || insErr.message.includes("duplicate")) {
        return json({ error: "Já existe um convite pendente para este e-mail neste workspace" }, 400)
      }
      return json({ error: insErr.message }, 500)
    }

    const origin = req.headers.get("origin") || "https://seucontrato.netlify.app"
    const inviteUrl = `${origin}/invite/${invite.token}`

    // Tentar enviar email via Resend (se configurado)
    const resendKey = Netlify.env.get("RESEND_API_KEY")
    let emailSent = false
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Seu Contrato <onboarding@resend.dev>",
            to: [email],
            subject: `Convite: ${profile.full_name} te convidou para "${workspace?.nome}" no Seu Contrato`,
            html: emailTemplate({
              ownerName: profile.full_name || "",
              workspaceName: workspace?.nome || "",
              inviteUrl,
            }),
          }),
        })
        emailSent = res.ok
      } catch {
        emailSent = false
      }
    }

    return json({ success: true, invite_url: inviteUrl, email_sent: emailSent }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function emailTemplate({ ownerName, workspaceName, inviteUrl }: { ownerName: string; workspaceName: string; inviteUrl: string }) {
  return `
    <div style="font-family: Montserrat, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="color: #1E1A34;">Você foi convidado!</h1>
      <p style="color: #64748b; font-size: 15px; line-height: 1.5;">
        <strong>${ownerName}</strong> te convidou para colaborar em <strong>${workspaceName}</strong> no Seu Contrato — a plataforma de gestão contratual da CorpLaw Advogados.
      </p>
      <div style="margin: 32px 0;">
        <a href="${inviteUrl}" style="background: #00A499; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Aceitar convite</a>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">Este convite expira em 7 dias.</p>
      <p style="color: #94a3b8; font-size: 12px;">Se o botão não funcionar, copie e cole este link:<br/><a href="${inviteUrl}" style="color: #00A499;">${inviteUrl}</a></p>
    </div>
  `
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = { path: "/api/send-invite" }
