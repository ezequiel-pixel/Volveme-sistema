import { supabase } from './supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from './pricingEngine'

const DIAS_URGENTE = 7

/**
 * El corazón "inteligente" de Stock y Compras: toma todos los eventos
 * CONFIRMADOS a futuro, corre cada uno por el mismo motor de precios
 * que usa el cotizador (no una copia de la lógica, la función real),
 * y suma cuánto café/leche/agua/vasos hace falta — separado en dos
 * franjas: "urgente" (próximos 7 días) y "total" (todo lo confirmado
 * a futuro). Lo compara contra el stock cargado en Insumos.
 *
 * Pensado para un ritmo de 2+ eventos por día con varias máquinas en
 * simultáneo — por eso agrega TODOS los eventos confirmados sin
 * importar cuántos caen el mismo día, no asume un evento a la vez.
 */
export async function calcularNecesidadesInsumos() {
  const hoy = new Date()
  const hoyStr = hoy.toISOString().slice(0, 10)
  const limiteUrgente = new Date(hoy.getTime() + DIAS_URGENTE * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: eventosProximos } = await supabase
    .from('eventos')
    .select('*, clientes(nombre)')
    .eq('estado', 'confirmado')
    .gte('fecha', hoyStr)
    .not('cotizacion_id', 'is', null)
    .order('fecha')

  const { data: configRows } = await supabase.from('config_pricing').select('*')
  const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
  const config = configArrayToObject(configRows || [])
  const amortizaciones = amortizacionesArrayToObject(amortRows || [])

  const totalGeneral = { gramosCafe: 0, litrosLeche: 0, litrosAgua: 0, cantidadVasos: 0 }
  const totalUrgente = { gramosCafe: 0, litrosLeche: 0, litrosAgua: 0, cantidadVasos: 0 }
  let eventosContemplados = 0
  let eventosUrgentes = 0
  const eventosConDetalle = []

  for (const ev of eventosProximos || []) {
    const { data: cot } = await supabase.from('cotizaciones').select('*').eq('id', ev.cotizacion_id).single()
    if (!cot) continue
    const { data: cotDias } = await supabase
      .from('cotizacion_dias').select('*').eq('cotizacion_id', cot.id).order('orden')

    const inputsRecalculo = {
      dias: (cotDias || []).map((d) => ({
        fecha: d.fecha, horaInicio: d.hora_inicio?.slice(0, 5), horaFin: d.hora_fin?.slice(0, 5),
      })),
      cantidad_pax: cot.cantidad_pax || 0,
      nivel: cot.nivel === 'premium' ? 'Premium' : 'Esencial',
      tamano_vaso: cot.tamano_vaso,
      cantidad_cafes_override: cot.cantidad_cafes_override,
      sin_insumos: cot.sin_insumos,
      cantidad_baristas: cot.cantidad_baristas,
      tipo_barra: cot.tipo_barra,
      amortizacion_override: cot.amortizacion_override,
      cantidad_maquina_1grupo_extra: cot.cantidad_maquina_1grupo_extra,
      cantidad_maquina_2grupos_extra: cot.cantidad_maquina_2grupos_extra,
      cantidad_molino_extra: cot.cantidad_molino_extra,
      calcos: cot.calcos,
      logo_3d: cot.logo_3d,
      costo_flete: cot.costo_flete,
      art: cot.art,
      art_monto: cot.art_monto,
      clausula_rc_monto: cot.clausula_rc_monto,
      multiplicador: cot.multiplicador,
      iva_pct: cot.iva_pct,
    }

    const r = calcularCotizacion(inputsRecalculo, config, amortizaciones)
    const esUrgente = ev.fecha <= limiteUrgente

    if (!cot.sin_insumos) {
      totalGeneral.gramosCafe += r.gramosCafeTotal || 0
      totalGeneral.litrosLeche += r.litrosLecheTotal || 0
      if (esUrgente) {
        totalUrgente.gramosCafe += r.gramosCafeTotal || 0
        totalUrgente.litrosLeche += r.litrosLecheTotal || 0
      }
    }
    totalGeneral.litrosAgua += (r.litrosAguaTotal || 0) + (r.aguaOperativaLitrosTotal || 0)
    totalGeneral.cantidadVasos += r.cantidadVasos || 0
    if (esUrgente) {
      totalUrgente.litrosAgua += (r.litrosAguaTotal || 0) + (r.aguaOperativaLitrosTotal || 0)
      totalUrgente.cantidadVasos += r.cantidadVasos || 0
      eventosUrgentes += 1
    }

    eventosContemplados += 1
    eventosConDetalle.push({ evento: ev, esUrgente, cantidadVasos: r.cantidadVasos || 0 })
  }

  const { data: insumosData } = await supabase.from('insumos').select('*').eq('activo', true)
  const stockPorCategoria = (categoria) =>
    (insumosData || []).filter((i) => i.categoria === categoria).reduce((s, i) => s + (Number(i.stock_actual) || 0), 0)

  function armar(categoria, divisor = 1) {
    const necesario = totalGeneral[categoria] / divisor
    const necesarioUrgente = totalUrgente[categoria] / divisor
    const stock = stockPorCategoria(mapaCategoria[categoria])
    return {
      necesario,
      necesarioUrgente,
      stock,
      faltaTotal: Math.max(0, necesario - stock),
      faltaUrgente: Math.max(0, necesarioUrgente - stock),
    }
  }
  const mapaCategoria = { gramosCafe: 'cafe', litrosLeche: 'leche', litrosAgua: 'agua', cantidadVasos: 'vasos' }

  return {
    eventosContemplados,
    eventosUrgentes,
    eventosConDetalle,
    diasUrgente: DIAS_URGENTE,
    cafe: { ...armar('gramosCafe', 1000), unidad: 'kg' },
    leche: { ...armar('litrosLeche'), unidad: 'L' },
    agua: { ...armar('litrosAgua'), unidad: 'L' },
    vasos: { ...armar('cantidadVasos'), unidad: 'u.' },
  }
}
