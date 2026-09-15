// ============================================================================
// Edge Function: ml-sincronizar-ventas
//
// Trae las órdenes pagas más recientes de Mercado Libre y las carga en
// ventas/venta_items — el trigger de stock que ya existe hace el resto
// (descuenta solo). Salta las que ya estén cargadas (por
// numero_orden_externo, para no duplicar si se corre dos veces).
//
// Requiere que ml_conexion ya tenga un token (ver ml-oauth-conectar) y
// que los productos que se venden en ML tengan su ml_item_id cargado
// — sin eso, un ítem de una orden real no tiene forma de saber a qué
// producto del catálogo corresponde, y esa línea se salta con un aviso.
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

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Cualquier usuario logueado del sistema puede disparar una
    // sincronización — no hace falta ser superadmin para esto.
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: errUser } = await supabaseAdmin.auth.getUser(token)
    if (errUser || !user) throw new Error('Sesión inválida.')

    const { data: conexion, error: errConexion } = await supabaseAdmin.from('ml_conexion').select('*').eq('id', 1).single()
    if (errConexion || !conexion?.access_token) {
      throw new Error('Mercado Libre no está conectado todavía — hay que conectar la cuenta primero.')
    }

    // Refresca el token si está vencido o vence en menos de 5 minutos
    let accessToken = conexion.access_token
    if (new Date(conexion.expira_en).getTime() < Date.now() + 5 * 60 * 1000) {
      const clientId = Deno.env.get('ML_CLIENT_ID')!
      const clientSecret = Deno.env.get('ML_CLIENT_SECRET')!
      const refreshRes = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: conexion.refresh_token,
        }),
      })
      const refreshData = await refreshRes.json()
      if (!refreshRes.ok) throw new Error(`No se pudo refrescar el token de ML: ${JSON.stringify(refreshData)}`)
      accessToken = refreshData.access_token
      await supabaseAdmin.from('ml_conexion').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expira_en: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      }).eq('id', 1)
    }

    // Trae las órdenes pagas de los últimos 30 días
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ordersRes = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${conexion.ml_user_id}&order.status=paid&order.date_created.from=${desde}&sort=date_desc&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const ordersData = await ordersRes.json()
    if (!ordersRes.ok) throw new Error(`Mercado Libre rechazó la consulta de órdenes: ${JSON.stringify(ordersData)}`)

    const ordenes = ordersData.results || []
    let cargadas = 0, saltadasDuplicadas = 0, itemsSinMapear = []

    // Traigo el mapa ml_item_id -> producto_id una sola vez, no por orden
    const { data: productosML } = await supabaseAdmin.from('productos').select('id, ml_item_id, nombre').not('ml_item_id', 'is', null)
    const mapaProductos = Object.fromEntries((productosML || []).map((p) => [p.ml_item_id, p]))

    for (const orden of ordenes) {
      const numeroOrden = String(orden.id)
      const { data: existente } = await supabaseAdmin.from('ventas').select('id').eq('numero_orden_externo', numeroOrden).eq('canal', 'mercado_libre').maybeSingle()
      if (existente) { saltadasDuplicadas++; continue }

      const items = []
      for (const oi of orden.order_items || []) {
        const producto = mapaProductos[oi.item.id]
        if (!producto) { itemsSinMapear.push(`${oi.item.id} (${oi.item.title})`); continue }
        items.push({ producto_id: producto.id, cantidad: oi.quantity, precio_unitario: oi.unit_price })
      }
      if (items.length === 0) continue // ningún ítem de esta orden se pudo mapear, no se carga nada

      const { data: venta, error: errVenta } = await supabaseAdmin.from('ventas').insert({
        canal: 'mercado_libre',
        numero_orden_externo: numeroOrden,
        cliente_nombre: orden.buyer?.nickname || null,
        total_venta: orden.total_amount,
        fecha: orden.date_created?.slice(0, 10),
      }).select().single()
      if (errVenta) continue

      await supabaseAdmin.from('venta_items').insert(items.map((it) => ({ ...it, venta_id: venta.id })))
      cargadas++
    }

    await supabaseAdmin.from('ml_conexion').update({ ultima_sincronizacion: new Date().toISOString() }).eq('id', 1)

    return new Response(JSON.stringify({
      ok: true,
      ordenes_encontradas: ordenes.length,
      cargadas,
      saltadas_ya_existian: saltadasDuplicadas,
      items_sin_mapear: [...new Set(itemsSinMapear)],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
