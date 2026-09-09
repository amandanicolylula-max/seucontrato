import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  try {
    // Verify the requesting user is authenticated and is admin
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Client with anon key to verify the requesting user
    const anonKey = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("VITE_SUPABASE_ANON_KEY")
    const supabaseAuth = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: requestingUser } } = await supabaseAuth.auth.getUser()
    if (!requestingUser) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check if requesting user is admin
    const { data: requestingProfile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", requestingUser.id)
      .single()

    if (!requestingProfile || !["socio", "administrador"].includes(requestingProfile.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar usuários" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Now use service role key to create the user
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { email, password, full_name, role, supervisor_id } = await req.json()

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, full_name, role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Estagiário obrigatoriamente tem supervisor
    if (role === "assistente" && !supervisor_id) {
      return new Response(JSON.stringify({ error: "Estagiário precisa ter supervisor definido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Trigger `handle_new_user` lê role e full_name de user_metadata
    // e insere no profile automaticamente.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Se estagiário, vincula supervisor (UPDATE explícito — sem race porque server-side é sequencial)
    if (data.user && role === "assistente" && supervisor_id) {
      const { error: supervisorError } = await supabaseAdmin
        .from("profiles")
        .update({ supervisor_id })
        .eq("id", data.user.id)

      if (supervisorError) {
        // Rollback: deleta o usuário criado
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return new Response(JSON.stringify({ error: "Falha ao vincular supervisor: " + supervisorError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: data.user.id, email: data.user.email, role },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export const config: Config = {
  path: "/api/create-user"
}
