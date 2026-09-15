// ============================================================================
// Edge Function: crear-cotizacion-desde-web
//
// La recibe el formulario "Pedí presupuesto" de volveme.condamind.com/eventos
// (o cualquier otro formulario de leads) y arma una cotización REAL —
// corriendo el mismo motor de precios que usa el resto del sistema
// (se importa DIRECTO de pricingEngine.js en GitHub, no se duplica la
// lógica en un archivo aparte — así nunca se desincroniza).
//
// La cotización queda SIEMPRE en estado 'pendiente_envio' — es un
// borrador para que alguien la revise antes de mandarla, no se envía
// sola. El formulario web probablemente no manda todos los datos que
// el motor de precios necesita (tamaño de vaso, tipo de barra exacto,
// etc.) — los que faltan se completan con valores por defecto
// razonables, documentados en las notas de la cotización para que
// quien la revise sepa qué se asumió.
//
// CÓMO SE DESPLIEGA:
//   1. Supabase → Edge Functions → Create a new function
//   2. Nombre: crear-cotizacion-desde-web
//   3. Pegás este código
//   4. En Secrets: WEBHOOK_SECRET (una clave inventada por vos, cualquier
//      texto largo random — el sitio tiene que mandar esa misma clave
//      en cada request, para que no cualquiera en internet pueda crear
//      cotizaciones falsas)
//   5. Deploy
//
// LO QUE FALTA DEL LADO DEL SITIO (esto es la parte que depende del
// programador, como ya hablamos): que el formulario de /eventos, al
// enviarse, haga un POST acá con los datos — eso todavía no existe,
// hay que coordinarlo.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from 'https://raw.githubusercontent.com/ezequiel-pixel/Volveme-sistema/main/src/lib/pricingEngine.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secretRecibido = req.headers.get('x-webhook-secret')
    if (secretRecibido !== Deno.env.get('WEBHOOK_SECRET')) {
      return new Response(JSON.stringify({ error: 'Clave inválida.' }), { status: 401, headers: corsHeaders })
    }

    const body = await req.json()
    // Campos que se esperan del formulario — ajustar nombres acá si el
    // sitio los manda con otro nombre de campo.
    const {
      nombre, email, telefono,
      tipo_evento, fecha_evento, duracion_horas, cantidad_pax,
    } = body

    if (!nombre || !fecha_evento) {
      return new Response(JSON.stringify({ error: 'Faltan datos mínimos: nombre y fecha_evento son obligatorios.' }), { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Busca o crea el cliente por email/teléfono
    let clienteId = null
    if (email) {
      const { data: existente } = await supabaseAdmin.from('clientes').select('id').eq('email', email).maybeSingle()
      clienteId = existente?.id || null
    }
    if (!clienteId) {
      const { data: nuevoCliente, error: errCliente } = await supabaseAdmin.from('clientes').insert({ nombre, email, telefono }).select().single()
      if (errCliente) throw new Error(`No se pudo crear el cliente: ${errCliente.message}`)
      clienteId = nuevoCliente.id
    }

    // Config del motor de precios — misma fuente que usa el resto del sistema
    const [{ data: configRows }, { data: amortRows }] = await Promise.all([
      supabaseAdmin.from('config_pricing').select('*'),
      supabaseAdmin.from('amortizacion_tipo_barra').select('*'),
    ])
    const config = configArrayToObject(configRows)
    const amortizaciones = amortizacionesArrayToObject(amortRows)

    // Valores que el formulario web probablemente NO manda — defaults
    // razonables, documentados en las notas para que se revisen a mano.
    const pax = cantidad_pax || 30
    const tamanoVaso = '8oz'
    const tipoBarraDefault = 'Barra chica 1 grupo'
    const cantidadBaristas = pax > 60 ? 2 : 1

    const inputs = {
      dias: [{ duracionHoras: duracion_horas || 4 }],
      tamano_vaso: tamanoVaso,
      cantidad_pax: pax,
      cantidad_baristas: cantidadBaristas,
      tipo_barra: tipoBarraDefault,
    }

    const resultado = calcularCotizacion(inputs, config, amortizaciones)

    const { data: cotizacion, error: errCot } = await supabaseAdmin.from('cotizaciones').insert({
      cliente_id: clienteId,
      nombre_evento: tipo_evento ? `${tipo_evento} — ${nombre}` : nombre,
      fecha_evento,
      cantidad_pax: pax,
      precio_final: resultado.precioFinal ?? resultado.total ?? null,
      estado: 'pendiente_envio',
      notas: `Cotización automática desde el formulario web. Se asumió: vaso ${tamanoVaso}, ${cantidadBaristas} barista(s), tipo de barra ${tipoBarraDefault}, ${pax} bebidas (1 por invitado)${!cantidad_pax ? ' — cantidad de invitados no vino en el formulario, se usó 30 por defecto' : ''}. REVISAR antes de enviar.`,
    }).select().single()
    if (errCot) throw new Error(`No se pudo crear la cotización: ${errCot.message}`)

    return new Response(JSON.stringify({ ok: true, cotizacion_id: cotizacion.id, precio_estimado: cotizacion.precio_final }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
