import type { Config } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

type AlertRow = {
  id: string
  alert_date: string
  alert_type: string
  message?: string
  contracts?: { title: string; clients?: { name: string } }
}

function buildHtml(fullName: string, overdue: AlertRow[], upcoming: AlertRow[]): string {
  const firstName = fullName.split(' ')[0]

  const alertRow = (a: AlertRow, isOverdue: boolean) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${a.contracts?.title ?? '—'}</p>
        ${a.contracts?.clients?.name ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${a.contracts.clients.name}</p>` : ''}
        ${a.message ? `<p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">${a.message}</p>` : ''}
      </td>
      <td style="padding:10px 0 10px 16px;border-bottom:1px solid #f1f5f9;white-space:nowrap;text-align:right;">
        <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px;background:${isOverdue ? '#fee2e2' : '#fef3c7'};color:${isOverdue ? '#dc2626' : '#d97706'};">
          ${isOverdue ? 'Vencido' : formatDateBR(a.alert_date)}
        </span>
      </td>
    </tr>`

  const overdueSection = overdue.length > 0 ? `
    <h3 style="font-size:13px;font-weight:700;color:#dc2626;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px;">🔴 Vencidos (${overdue.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${overdue.map(a => alertRow(a, true)).join('')}</table>` : ''

  const upcomingSection = upcoming.length > 0 ? `
    <h3 style="font-size:13px;font-weight:700;color:#d97706;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px;">⚠️ Próximos 7 dias (${upcoming.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${upcoming.map(a => alertRow(a, false)).join('')}</table>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#0D1F3C 0%,#142F58 100%);padding:28px 32px;">
          <p style="margin:0;font-size:10px;font-weight:700;color:#B7A5A2;letter-spacing:2.5px;text-transform:uppercase;">BRAGA E DANTAS ADVOGADOS</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;">BD Contratos</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.55);">Resumo diário de alertas</p>
        </td></tr>

        <tr><td style="padding:28px 32px;">
          <p style="margin:0;font-size:15px;color:#334155;">Bom dia, <strong>${firstName}</strong>.</p>
          <p style="margin:8px 0 0;font-size:14px;color:#64748b;line-height:1.5;">Aqui estão os alertas que precisam de atenção hoje:</p>
          ${overdueSection}
          ${upcomingSection}
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center;">
            <a href="https://contratos.bragadantas.com.br/alertas"
               style="display:inline-block;background:#142F58;color:#ffffff;text-decoration:none;padding:11px 28px;border-radius:8px;font-size:13px;font-weight:600;">
              Ver todos os alertas →
            </a>
          </div>
        </td></tr>

        <tr><td style="padding:14px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">BD Contratos · Braga e Dantas Advogados · Este email é enviado automaticamente às 7h</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async (_req: Request) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const in7daysStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    // 1. Busca todos os perfis ativos (com id para cruzar com client_users)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)

    if (!profiles?.length) return new Response('No active users', { status: 200 })

    // 2. Busca todos os alertas pendentes do período (uma query só, depois filtra por usuário)
    const { data: alerts } = await supabase
      .from('contract_alerts')
      .select('id, alert_date, alert_type, message, contracts!inner(title, client_id, clients(name))')
      .eq('is_sent', false)
      .lte('alert_date', in7daysStr)
      .order('alert_date')

    if (!alerts?.length) return new Response('No urgent alerts today', { status: 200 })

    // 3. Busca vínculos cliente ↔ usuário
    const { data: clientUsers } = await supabase
      .from('client_users')
      .select('client_id, profile_id')

    // Mapa: profile_id → Set<client_id>
    const profileClientMap = new Map<string, Set<string>>()
    for (const cu of clientUsers || []) {
      if (!profileClientMap.has(cu.profile_id)) profileClientMap.set(cu.profile_id, new Set())
      profileClientMap.get(cu.profile_id)!.add(cu.client_id)
    }

    const sentAlertIds = new Set<string>()
    let sent = 0
    let failed = 0

    // 4. Para cada usuário, filtra os alertas dos seus clientes e envia
    await Promise.all(
      profiles.map(async profile => {
        const myClientIds = profileClientMap.get(profile.id)

        // Usuário sem nenhum cliente associado → pula
        if (!myClientIds || myClientIds.size === 0) return

        const myAlerts = (alerts as (AlertRow & { contracts?: { client_id?: string } & AlertRow['contracts'] })[])
          .filter(a => myClientIds.has(a.contracts?.client_id ?? ''))

        // Sem alertas relevantes para este usuário → não envia email vazio
        if (myAlerts.length === 0) return

        const overdue = myAlerts.filter(a => a.alert_date < todayStr)
        const upcoming = myAlerts.filter(a => a.alert_date >= todayStr)

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'BD Contratos <alertas@bragadantas.com.br>',
              to: profile.email,
              subject: `[BD Contratos] Resumo de Alertas — ${formatDateBR(todayStr)}`,
              html: buildHtml(profile.full_name, overdue, upcoming),
            }),
          })
          if (res.ok) {
            sent++
            myAlerts.forEach(a => sentAlertIds.add(a.id))
          } else {
            failed++
            console.error(`Resend error for ${profile.email}:`, await res.text())
          }
        } catch (err) {
          failed++
          console.error(`Fetch error for ${profile.email}:`, err)
        }
      })
    )

    // 5. Marcar como enviados apenas os alertas que de fato saíram
    if (sentAlertIds.size > 0) {
      const { error: updateError } = await supabase
        .from('contract_alerts')
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .in('id', [...sentAlertIds])
      if (updateError) console.error('Falha ao marcar alertas como enviados:', updateError)
    }

    return new Response(
      JSON.stringify({ sent, failed, total_alerts: alerts.length, marked_sent: sentAlertIds.size }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('daily-digest fatal error:', err)
    return new Response(String(err), { status: 500 })
  }
}

export const config: Config = {
  schedule: '0 10 * * *', // 07:00 BRT (UTC-3, sem horário de verão)
  timeoutSeconds: 300,    // 5 minutos — máximo permitido pelo Netlify
}
