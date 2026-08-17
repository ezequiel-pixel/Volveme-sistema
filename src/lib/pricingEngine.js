// Motor de costeo de eventos — Volveme
// Replica exacta de la lógica del Excel "Volveme_Cotizador_Simple.xlsx"
// Determinístico: mismos inputs siempre dan el mismo resultado.

const COSTO_VASO_X50_POR_TAMANO = {
  '6oz': 'costo_vaso_6oz_x50',
  '8oz': 'costo_vaso_8oz_x50',
  '12oz': 'costo_vaso_12oz_x50',
}

// Tamaño real de cada vaso en ml, para calcular agua OPERATIVA (la de
// verdad usar en barra: caldera, dilución de americanos, limpieza de
// lanza de vapor) — no confundir con el agua de RECETA (ml_agua_por_bebida
// de la config), que es un volumen mucho más chico.
const VASO_ML_POR_TAMANO = {
  '6oz': 177,
  '8oz': 237,
  '12oz': 355,
}

function horasEntreHorarios(dia) {
  // Si el día tiene "cantidad de horas" cargada directamente (sin horario
  // específico), usamos ese valor tal cual. Si no, calculamos la diferencia
  // entre hora de inicio y fin como antes.
  if (dia.duracionHoras !== undefined && dia.duracionHoras !== null && dia.duracionHoras !== '') {
    return Number(dia.duracionHoras) || 0
  }
  if (!dia.horaInicio || !dia.horaFin) return 0
  const [h1, m1] = dia.horaInicio.split(':').map(Number)
  const [h2, m2] = dia.horaFin.split(':').map(Number)
  let minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (minutos < 0) minutos += 24 * 60 // cruza medianoche
  return minutos / 60
}

export function calcularCotizacion(inputs, config, amortizaciones) {
  const c = config
  const dias = inputs.dias && inputs.dias.length ? inputs.dias : [{ horaInicio: '08:00', horaFin: '08:00' }]
  const cantidadDias = dias.length
  const totalHoras = dias.reduce((sum, d) => sum + horasEntreHorarios(d), 0)

  const cafePorBebida = c.gramos_espresso * (c.precio_kilo_cafe / 1000)

  // Modelo ADITIVO — replica exacta del Excel: dos cantidades fijas de ml
  // (leche y agua) que se SUMAN por bebida, no un volumen de vaso que se
  // reparte entre las dos. Antes el código restaba volumen_espresso_ml al
  // tamaño del vaso y repartía el resto por una "proporción" — daba un
  // número distinto al que realmente usa el Excel de costos.
  const costoLechePorMl = c.costo_litro_leche / 1000
  const costoAguaPorMl = c.precio_bidon_agua_20l / 20000
  const costoLecheAguaPorBebida =
    c.ml_leche_por_bebida * costoLechePorMl + c.ml_agua_por_bebida * costoAguaPorMl

  const costoVasoPorBebida = c[COSTO_VASO_X50_POR_TAMANO[inputs.tamano_vaso]] / 50
  const azucarPorBebida = c.sobres_azucar_por_bebida * (c.costo_azucar_caja_x800 / 800)
  const edulcorantePorBebida = c.costo_edulcorante_caja_x200 / 200
  const removedorPorBebida = c.costo_removedor_por_bebida

  const costoEsencialPorBebida =
    cafePorBebida + costoLecheAguaPorBebida + costoVasoPorBebida +
    azucarPorBebida + edulcorantePorBebida + removedorPorBebida

  // Los pax son "por día" — si el evento dura 2 días, las mismas 200
  // personas toman café los 2 días, así que el consumo real es el doble.
  // Antes esto calculaba insumos para 200 personas UNA sola vez sin
  // importar la cantidad de días del evento, subestimando café, leche,
  // vasos, azúcar, etc. en cualquier evento de más de un día.
  const bebidasEstimadas = inputs.cantidad_pax * c.consumo_por_persona * cantidadDias
  const bebidasReales = inputs.cantidad_cafes_override || bebidasEstimadas

  // ---- CANTIDADES FÍSICAS EXACTAS DE CADA INSUMO (para la ficha operativa) ----
  const gramosCafeTotal = c.gramos_espresso * bebidasReales
  const kilosCafeTotal = gramosCafeTotal / 1000
  const mlLecheTotal = c.ml_leche_por_bebida * bebidasReales
  const litrosLecheTotal = mlLecheTotal / 1000
  const mlAguaTotal = c.ml_agua_por_bebida * bebidasReales
  const litrosAguaTotal = mlAguaTotal / 1000
  // OJO: esto es solo el agua que va mezclada EN la bebida (para
  // americanos, etc.) — no el agua operativa real de barra (rellenar
  // caldera, backflush, limpieza, hielo, lavado de manos), que en la
  // práctica es bastante más. Este número de bidones es un piso, no el
  // cálculo real de cuánta agua llevar a un evento grande.
  const bidonAguaLitros = 20
  const cantidadBidonesAgua = Math.ceil(litrosAguaTotal / bidonAguaLitros)

  // ---- AGUA OPERATIVA (la real de barra, no la de receta) ----
  // 40ml fijos por bebida (agua de máquina — purgado, backflush, limpieza
  // de grupo, universal para cualquier bebida) + el tamaño completo del
  // vaso (dilución de americanos, limpieza de lanza de vapor en bebidas
  // con leche). Se asume que la mayoría de las bebidas de un evento son
  // americano o con leche (no espresso solo), así el número no se queda
  // corto. Siempre se calcula y siempre se cobra — no depende de
  // "sin_insumos", porque el agua operativa la pone Volveme siempre.
  const aguaOperativaMlPorBebida = 40 + (VASO_ML_POR_TAMANO[inputs.tamano_vaso] || 0)
  const aguaOperativaLitrosTotal = (aguaOperativaMlPorBebida * bebidasReales) / 1000
  const cantidadBidonesOperativos = Math.ceil(aguaOperativaLitrosTotal / bidonAguaLitros)
  const costoAguaOperativa = cantidadBidonesOperativos * c.precio_bidon_agua_20l

  const cantidadVasos = Math.ceil(bebidasReales)
  const cajasVasos = cantidadVasos / 50
  const sobresAzucarTotal = Math.ceil(c.sobres_azucar_por_bebida * bebidasReales)
  const sobresEdulcoranteTotal = Math.ceil(bebidasReales)
  const removedoresTotal = Math.ceil(bebidasReales)
  const calcosTotal = inputs.calcos ? Math.ceil(bebidasReales) : 0
  const logo3dTotal = inputs.logo_3d ? Math.ceil(bebidasReales) : 0

  let insumosEsenciales = bebidasReales * costoEsencialPorBebida
  const recargoPremiumPct = c.recargo_premium_pct ?? 0.25
  const recargoPremium = inputs.nivel === 'Premium' ? insumosEsenciales * recargoPremiumPct : 0
  const costoCalcos = inputs.calcos ? bebidasReales * c.costo_calco_unidad : 0
  const costoLogo3d = inputs.logo_3d ? bebidasReales * c.costo_logo3d_unidad : 0

  // "Sin insumos" — para eventos donde Volveme pone equipo, staff y
  // logística pero el café/leche/vasos los pone el cliente o un
  // proveedor aparte (ej: eventos muy grandes tipo La Rural). Las
  // cantidades físicas (kilosCafeTotal, litrosLecheTotal, etc.) se
  // siguen calculando igual — quedan como referencia informativa — pero
  // no se cobran: totalInsumos da $0 y no entra al costo del evento.
  const totalInsumosCalculado = insumosEsenciales + recargoPremium + costoCalcos + costoLogo3d
  const totalInsumos = inputs.sin_insumos ? 0 : totalInsumosCalculado

  const sueldoBaristas =
    inputs.cantidad_baristas * totalHoras * c.sueldo_barista_hora
  const viaticosBaristas = inputs.cantidad_baristas * c.extra_viaticos_barista * cantidadDias
  const extraBaristaMonto = inputs.extra_barista_monto || 0
  const totalManoDeObra = sueldoBaristas + viaticosBaristas + extraBaristaMonto

  const amortizacionDia =
    inputs.amortizacion_override ??
    amortizaciones[inputs.tipo_barra] ??
    c.amortizacion_equipo_default ??
    0
  const amortizacionTotal = amortizacionDia * cantidadDias

  // Alquiler de equipo extra — por tipo específico y cantidad (antes
  // era un simple on/off "alquiler máquina extra" genérico). Cada
  // cantidad puede ser 0, 1 o 2, y se cobra por día del evento.
  const cantidadMaquina1Grupo = Number(inputs.cantidad_maquina_1grupo_extra) || 0
  const cantidadMaquina2Grupos = Number(inputs.cantidad_maquina_2grupos_extra) || 0
  const cantidadMolinoExtra = Number(inputs.cantidad_molino_extra) || 0

  const alquilerMaquina1Grupo = cantidadMaquina1Grupo * (c.tarifa_maquina_1grupo_dia ?? 200000) * cantidadDias
  const alquilerMaquina2Grupos = cantidadMaquina2Grupos * (c.tarifa_maquina_2grupos_dia ?? 330000) * cantidadDias
  const alquilerMolinoExtra = cantidadMolinoExtra * (c.tarifa_molino_dia ?? 130000) * cantidadDias

  const alquilerEquipoExtra = alquilerMaquina1Grupo + alquilerMaquina2Grupos + alquilerMolinoExtra

  const flete = inputs.costo_flete || 0
  // "Seguro" y "ART" son el mismo concepto — el ART sigue siendo
  // opcional (se tilda solo si el evento lo requiere), pero ahora con
  // base $2.000 en vez de $0 cuando se tilda.
  const art = inputs.art ? (inputs.art_monto !== '' && inputs.art_monto != null ? Number(inputs.art_monto) : (c.art_monto_default ?? 2000)) : 0
  const clausulaRc = inputs.clausula_rc_monto || 0

  // "Transporte" de la planilla de Cami es el mismo concepto que Flete
  // (no se duplica). "Impresión" es el mismo concepto que Calcos (ya
  // sumado dentro de totalInsumos vía costoCalcos). "Seguro" es el mismo
  // concepto que ART (arriba). El único costo fijo genuinamente nuevo es
  // Extra distancia — 100% manual, sin default, lo carga Eze por evento.
  const extraDistancia = Number(inputs.extra_distancia) || 0

  const costoTotalSinImprevistos =
    totalInsumos + totalManoDeObra + amortizacionTotal +
    alquilerEquipoExtra + flete + art + clausulaRc +
    extraDistancia + costoAguaOperativa

  // Colchón de imprevistos — 5% por default, aplicado sobre el costo
  // total antes del margen (misma lógica que la planilla de costos real).
  const imprevistosPct = inputs.imprevistos_pct ?? c.imprevistos_pct ?? 0.05
  const imprevistosMonto = costoTotalSinImprevistos * imprevistosPct
  const costoTotal = costoTotalSinImprevistos + imprevistosMonto

  const multiplicador = inputs.multiplicador || c.multiplicador_precio
  const ivaPct = inputs.iva_pct ?? c.iva_pct

  const precioNeto = costoTotal * multiplicador
  const ivaMonto = precioNeto * ivaPct
  // El precio que se cotiza NO incluye IVA — se calcula el IVA y se
  // guarda por si hace falta para facturación/contabilidad, pero no se
  // suma al precio final que se le muestra al cliente.
  const precioFinal = precioNeto

  const utilidad = precioNeto - costoTotal
  const margenPct = precioNeto > 0 ? utilidad / precioNeto : 0
  const consumoPromedioPorPersona = inputs.cantidad_pax > 0 ? precioFinal / inputs.cantidad_pax : 0

  return {
    cantidadDias, totalHoras,
    costoEsencialPorBebida, bebidasEstimadas, bebidasReales,
    // cantidades físicas exactas
    gramosCafeTotal, kilosCafeTotal, litrosLecheTotal, litrosAguaTotal, cantidadBidonesAgua,
    aguaOperativaLitrosTotal, cantidadBidonesOperativos, costoAguaOperativa,
    cantidadVasos, cajasVasos, sobresAzucarTotal, sobresEdulcoranteTotal,
    removedoresTotal, calcosTotal, logo3dTotal,
    // costos
    insumosEsenciales, recargoPremium, costoCalcos, costoLogo3d, totalInsumos,
    sueldoBaristas, viaticosBaristas, extraBaristaMonto, totalManoDeObra,
    amortizacionDia, amortizacionTotal,
    cantidadMaquina1Grupo, cantidadMaquina2Grupos, cantidadMolinoExtra,
    alquilerMaquina1Grupo, alquilerMaquina2Grupos, alquilerMolinoExtra, alquilerEquipoExtra,
    flete, art, clausulaRc,
    extraDistancia,
    costoTotalSinImprevistos, imprevistosPct, imprevistosMonto,
    costoTotal, precioNeto, ivaMonto, precioFinal, utilidad, margenPct, consumoPromedioPorPersona,
  }
}

export function configArrayToObject(configRows) {
  return Object.fromEntries(configRows.map((r) => [r.clave, Number(r.valor)]))
}

export function amortizacionesArrayToObject(rows) {
  return Object.fromEntries(rows.map((r) => [r.tipo, Number(r.monto_dia)]))
}
