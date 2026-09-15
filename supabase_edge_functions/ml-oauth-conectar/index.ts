// ============================================================================
// Edge Function: ml-oauth-conectar
//
// Recibe el "code" que Mercado Libre manda al redirigir después de que
// el vendedor autoriza la conexión, lo cambia por un access_token +
// refresh_token, y los guarda en ml_conexion. Corre en la
// infraestructura de Supabase — las credenciales secretas de ML
// (Client Secret) viven acá como variable de entorno, nunca en React.
//
// CÓMO SE DESPLIEGA:
//   1. Supabase → Edge Functions → Create a new function
//   2. Nombre: ml-oauth-conectar
//   3. Pegás este código
//   4. En "Secrets" de la función, agregás:
//      ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI
//      (los 2 primeros salen de tu app registrada en
//      developers.mercadolibre.com.ar; el tercero es la URL pública
//      de ESTA misma función, algo como
//      https://<tu-proyecto>.supabase.co/functions/v1/ml-oauth-conectar
//      — tiene que coincidir EXACTO con lo que pusiste al registrar
//      la app en ML, carácter por carácter)
//   5. Deploy
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    if (!code) {
      return new Response('Falta el parámetro "code" — esta función se llama sola desde el redirect de Mercado Libre, no se abre directo.', { status: 400 })
    }

    const clientId = Deno.env.get('ML_CLIENT_ID')!
    const clientSecret = Deno.env.get('ML_CLIENT_SECRET')!
    const redirectUri = Deno.env.get('ML_REDIRECT_URI')!

    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      return new Response(`Mercado Libre rechazó el intercambio de token: ${JSON.stringify(tokenData)}`, { status: 400 })
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const expiraEn = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { error } = await supabaseAdmin.from('ml_conexion').upsert({
      id: 1,
      ml_user_id: String(tokenData.user_id),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expira_en: expiraEn,
      conectado_en: new Date().toISOString(),
    })
    if (error) {
      return new Response(`Se obtuvo el token pero no se pudo guardar: ${error.message}`, { status: 500 })
    }

    // Página simple de confirmación — el vendedor ve esto en el
    // navegador después de autorizar en Mercado Libre.
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Mercado Libre conectado</h2>
        <p>Ya podés cerrar esta pestaña y volver al sistema.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (err) {
    return new Response(`Error inesperado: ${err.message}`, { status: 500 })
  }
})
