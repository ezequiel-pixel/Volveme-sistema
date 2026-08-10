// Motor de costeo de eventos — Volveme
// Replica exacta de la lógica del Excel "Volveme_Cotizador_Simple.xlsx"
// Determinístico: mismos inputs siempre dan el mismo resultado.

const VOLUMEN_POR_TAMANO = {
  '6oz': 'volumen_vaso_6oz',
  '8oz': 'volumen_vaso_8oz',
  '12oz': 'volumen_vaso_12oz',
}

const COSTO_VASO_X50_POR_TAMANO = {
  '6oz': 'costo_vaso_6oz_x50',
  '8oz': 'costo_vaso_8oz_x50',
  '12oz': 'costo_vaso_12oz_x50',
}

export function calcularCotizacion(inputs, config, amortizaciones) {
  const c = config

  const cafePorBebida = c.gramos_espresso * (c.precio_kilo_cafe / 1000)

  const volumenVaso = c[VOLUMEN_POR_TAMANO[inputs.tamano_vaso]]
  const volumenLecheAgua = Math.max(volumenVaso - c.volumen_espresso_ml, 0)

  const costoLechePorMl = c.costo_litro_leche / 1000
  const costoAguaPorMl = c.precio_bidon_agua_20l / 20000
  const proporcion = inputs.proporcion_con_leche_override ?? c.proporcion_con_leche
  const costoLecheAguaPorBebida =
    volumenLecheAgua * proporcion * costoLechePorMl +
    volumenLecheAgua * (1 - proporcion) * costoAguaPorMl

  const costoVasoPorBebida = c[COSTO_VASO_X50_POR_TAMANO[inputs.tamano_vaso]] / 50
  const azucarPorBebida = c.sobres_azucar_por_bebida * (c.costo_azucar_caja_x800 / 800)
  const edulcorantePorBebida = c.costo_edulcorante_caja_x200 / 200
  const removedorPorBebida = c.costo_removedor_por_bebida

  const costoEsencialPorBebida =
    cafePorBebida + costoLecheAguaPorBebida + costoVasoPorBebida +
    azucarPorBebida + edulcorantePorBebida + removedorPorBebida

  const bebidasEstimadas = inputs.cantidad_pax * c.consumo_por_persona
  const bebidasReales = inputs.cantidad_cafes_override || bebidasEstimadas

  let insumosEsenciales = bebidasReales * costoEsencialPorBebida
  const recargoPremium = inputs.nivel === 'Premium' ? insumosEsenciales * 0.25 : 0
  const costoCalcos = inputs.calcos ? bebidasReales * c.costo_calco_unidad : 0
  const costoLogo3d = inputs.logo_3d ? bebidasReales * c.costo_logo3d_unidad : 0

  const totalInsumos = insumosEsenciales + recargoPremium + costoCalcos + costoLogo3d

  const sueldoBaristas =
    inputs.cantidad_baristas * inputs.duracion_horas * inputs.cantidad_dias * c.sueldo_barista_hora
  const viaticosBaristas = inputs.cantidad_baristas * c.extra_viaticos_barista
  const totalManoDeObra = sueldoBaristas + viaticosBaristas

  const amortizacionDia = inputs.amortizacion_override ?? amortizaciones[inputs.tipo_barra] ?? 0
  const amortizacionTotal = amortizacionDia * inputs.cantidad_dias

  const alquilerMaquinaExtra = inputs.alquiler_maquina_extra
    ? c.tarifa_maquina_extra_dia * inputs.cantidad_dias : 0
  const alquilerMolinoExtra = inputs.alquiler_molino_extra
    ? c.tarifa_molino_extra_dia * inputs.cantidad_dias : 0

  const flete = inputs.costo_flete || 0
  const art = inputs.art ? inputs.art_monto || 0 : 0
  const clausulaRc = inputs.clausula_rc_monto || 0

  const costoTotal =
    totalInsumos + totalManoDeObra + amortizacionTotal +
    alquilerMaquinaExtra + alquilerMolinoExtra + flete + art + clausulaRc

  const multiplicador = inputs.multiplicador || c.multiplicador_precio
  const ivaPct = inputs.iva_pct ?? c.iva_pct

  const precioNeto = costoTotal * multiplicador
  const ivaMonto = precioNeto * ivaPct
  const precioFinal = precioNeto + ivaMonto

  const utilidad = precioNeto - costoTotal
  const margenPct = precioNeto > 0 ? utilidad / precioNeto : 0
  const consumoPromedioPorPersona = inputs.cantidad_pax > 0 ? precioFinal / inputs.cantidad_pax : 0

  return {
    costoEsencialPorBebida, bebidasEstimadas, bebidasReales,
    insumosEsenciales, recargoPremium, costoCalcos, costoLogo3d, totalInsumos,
    sueldoBaristas, viaticosBaristas, totalManoDeObra,
    amortizacionDia, amortizacionTotal, alquilerMaquinaExtra, alquilerMolinoExtra,
    flete, art, clausulaRc,
    costoTotal, precioNeto, ivaMonto, precioFinal, utilidad, margenPct, consumoPromedioPorPersona,
  }
}

export function configArrayToObject(configRows) {
  return Object.fromEntries(configRows.map((r) => [r.clave, Number(r.valor)]))
}

export function amortizacionesArrayToObject(rows) {
  return Object.fromEntries(rows.map((r) => [r.tipo, Number(r.monto_dia)]))
}
