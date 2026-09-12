// ============================================================================
// Edge Function: invitar-usuario
//
// Corre en la infraestructura de Supabase, NO en el navegador — por eso
// puede usar la Service Role Key con seguridad (esa clave nunca sale de
// acá, nunca llega al código de React). Solo un Superadmin puede
// invocarla; cualquier otro rol se rechaza adentro de la función.
//
// CÓMO SE DESPLIEGA (desde el dashboard de Supabase, sin instalar nada):
//   1. Supabase → Edge Functions → Create a new function
//   2. Nombre: invitar-usuario
//   3. Pegás este código completo
//   4. Deploy
//   5. Ya queda accesible en https://<tu-proyecto>.supabase.co/functions/v1/invitar-usuario
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Falta el token de autorización.')

    // Cliente con la Service Role Key — solo existe acá adentro,
    // como variable de entorno de la función, nunca en el navegador.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Quién está llamando a esta función — se identifica con SU propio
    // token (el de la sesión ya logueada en el navegador), no con la
    // Service Role Key.
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: errUser } = await supabaseAdmin.auth.getUser(token)
    if (errUser || !user) throw new Error('Sesión inválida.')

    const { data: perfilLlamador } = await supabaseAdmin
      .from('perfiles').select('rol').eq('id', user.id).single()

    if (perfilLlamador?.rol !== 'superadmin') {
      throw new Error('Solo Superadmin puede invitar usuarios.')
    }

    const { email, rol, nombre, staff_id } = await req.json()
    if (!email || !rol) throw new Error('Falta email o rol.')
    if (!['superadmin', 'operacion', 'barista', 'logistica'].includes(rol)) {
      throw new Error('Rol inválido.')
    }

    // Esto es lo que antes había que hacer a mano desde el dashboard —
    // manda el mail de invitación real.
    const { data: invitado, error: errInvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (errInvite) throw errInvite

    // Le asigna el rol de una — no hace falta que el dueño entre a
    // Usuarios después a completarlo a mano, ya queda listo.
    const { error: errPerfil } = await supabaseAdmin.from('perfiles').upsert({
      id: invitado.user.id,
      rol,
      nombre: nombre || email,
      staff_id: rol === 'barista' ? (staff_id || null) : null,
    })
    if (errPerfil) throw errPerfil

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
