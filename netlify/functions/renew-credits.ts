import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

// Scheduled function — roda diariamente às 03:00 BRT
export default async (_req: Request) => {
  try {
    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Config incompleta" }, 500)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.rpc("renew_monthly_credits")
    if (error) {
      console.error("renew-credits error:", error)
      return json({ error: error.message }, 500)
    }

    console.log(`renew-credits: ${data} workspaces renovados`)
    return json({ success: true, workspaces_renewed: data }, 200)
  } catch (err) {
    console.error("renew-credits fatal error:", err)
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

export const config: Config = {
  schedule: "0 6 * * *", // 06:00 UTC = 03:00 BRT (funções scheduled não aceitam path custom)
}
