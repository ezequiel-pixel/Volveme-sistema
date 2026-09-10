import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, AlertCircle, Truck } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const moneyCorto = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// pagos.fecha (y otras columnas de fecha) a veces vienen como
// "YYYY-MM-DD" y a veces como timestamp completo "YYYY-MM-DDTHH:mm:ss" —
// pegarle "T00:00:00" a algo que ya tenía hora arma una fecha inválida
// (el bug que hacía que Facturación diera todo en $0). Esto normaliza
// los dos casos por igual, siempre agarrando solo la parte de fecha.
const parseFecha = (fechaStr) => new Date((fechaStr || '').slice(0, 10) + 'T00:00:00')

const formatMes = (fechaStr) => {
  const d = parseFecha(fechaStr)
  return `${MESES[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`
}

const CATEGORIA_LABEL = {
  pago_staff: 'Staff',
  pago_proveedor: 'Insumos (proveedores)',
  gasto_operativo: 'Operativo',
  logistica_flete: 'Logística / Flete',
}
const CATEGORIA_COLOR = {
  pago_staff: '#8c5a45',
  pago_proveedor: '#c9a487',
  gasto_operativo: '#3f6bff',
  logistica_flete: '#ff6a1a',
}

const TABS = [
  ['facturacion', 'Facturación'],
  ['gastos', 'Gastos'],
  ['compras', 'Compras'],
  ['utilidad', 'Utilidad'],
]

export default function Reportes() {
  const [tab, setTab] = useState('utilidad')
  const [loading, setLoading] = useState(true)

  const [facturacionMensual, setFacturacionMensual] = useState([])
  const [pagosCobros, setPagosCobros] = useState([])
  const [gastosMensual, setGastosMensual] = useState([])
  const [comprasMensual, setComprasMensual] = useState([])
  const [utilidadMensual, setUtilidadMensual] = useState([])
  const [porCobrar, setPorCobrar] = useState([])
  const [fletePorEvento, setFletePorEvento] = useState([])
  const [amortizacionMesActual, setAmortizacionMesActual] = useState(0)
  const [amortizacionCargando, setAmortizacionCargando] = useState(true)

  useEffect(() => { cargarTodo() }, [])

  const [errorCarga, setErrorCarga] = useState(null)
  const inicioAnioStr = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const hace13MesesStr = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 13)
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  })()

  async function cargarTodo() {
    setLoading(true)
    setErrorCarga(null)

    const resultados = await Promise.all([
      supabase.from('vw_reportes_facturacion_mensual').select('*').gte('mes', hace13MesesStr).order('mes'),
      supabase.from('pagos').select('monto, fecha')
        .not('evento_id', 'is', null).is('staff_id', null).is('proveedor_id', null).is('compra_id', null)
        .gte('fecha', inicioAnioStr),
      supabase.from('vw_reportes_gastos_mensual').select('*').gte('mes', hace13MesesStr).order('mes'),
      supabase.from('vw_reportes_compras_mensual').select('*').gte('mes', hace13MesesStr).order('mes'),
      supabase.from('vw_reportes_utilidad_mensual').select('*').gte('mes', hace13MesesStr).order('mes'),
      supabase.from('vw_reportes_por_cobrar').select('*').order('fecha').limit(50),
      supabase.from('vw_reportes_flete_por_evento').select('*').order('fecha', { ascending: false }).limit(20),
    ])
    const [
      { data: facturacion, error: e1 },
      { data: cobros, error: e2 },
      { data: gastos, error: e3 },
      { data: compras, error: e4 },
      { data: utilidad, error: e5 },
      { data: cobrar, error: e6 },
      { data: flete, error: e7 },
    ] = resultados

    // Si alguna vista todavía no existe (no se corrió el SQL de
    // Reportes) u otro error de la base, se avisa clarito en vez de
    // mostrar todo en cero en silencio como pasaba antes.
    const primerError = [e1, e2, e3, e4, e5, e6, e7].find((e) => e)
    if (primerError) {
      setErrorCarga(primerError.message)
      setLoading(false)
      return
    }

    setFacturacionMensual(facturacion || [])
    setPagosCobros(cobros || [])
    setGastosMensual(gastos || [])
    setComprasMensual(compras || [])
    setUtilidadMensual(utilidad || [])
    setPorCobrar(cobrar || [])
    setFletePorEvento(flete || [])

    // No se espera acá — el resto de la pantalla ya tiene todo lo que
    // necesita para mostrarse. La amortización de referencia se calcula
    // aparte, en segundo plano, y actualiza ese numerito sola cuando
    // termina (puede tardar más si hay muchos eventos este mes).
    setLoading(false)
    calcularAmortizacionReferencia()
  }

  /** Amortización del mes actual — SOLO de referencia (para comparar con
   * lo que se cobra), no resta de la utilidad. No hay ninguna tabla que
   * la guarde: se recalcula corriendo el motor de pricing real sobre
   * cada evento confirmado/realizado del mes, y sumando. */
  async function calcularAmortizacionReferencia() {
    setAmortizacionCargando(true)
    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10)

    const { data: eventosDelMes } = await supabase
      .from('eventos')
      .select('id, cotizacion_id')
      .in('estado', ['confirmado', 'realizado'])
      .gte('fecha', inicioMes)
      .lte('fecha', finMes)

    if (!eventosDelMes || eventosDelMes.length === 0) { setAmortizacionMesActual(0); setAmortizacionCargando(false); return }

    const { data: configRows } = await supabase.from('config_pricing').select('*')
    const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
    const config = configArrayToObject(configRows || [])
    const amortizaciones = amortizacionesArrayToObject(amortRows || [])

    // En LOTE — 2 consultas en total, sin importar si hay 3 eventos este
    // mes o 300. Antes era una consulta por evento (aunque en paralelo,
    // seguía siendo N ida-y-vuelta a la base); ahora se traen todas las
    // cotizaciones juntas y todos los días juntos, y se arma todo en
    // memoria del lado del navegador.
    const cotizacionIds = [...new Set(eventosDelMes.map((ev) => ev.cotizacion_id).filter(Boolean))]
    if (cotizacionIds.length === 0) { setAmortizacionMesActual(0); setAmortizacionCargando(false); return }

    const [{ data: cotizacionesDelMes }, { data: diasDeEsasCotizaciones }] = await Promise.all([
      supabase.from('cotizaciones').select('*').in('id', cotizacionIds),
      supabase.from('cotizacion_dias').select('*').in('cotizacion_id', cotizacionIds).order('orden'),
    ])

    const diasPorCotizacion = {}
    for (const d of diasDeEsasCotizaciones || []) {
      (diasPorCotizacion[d.cotizacion_id] ||= []).push(d)
    }

    let total = 0
    for (const cot of cotizacionesDelMes || []) {
      const cotDias = diasPorCotizacion[cot.id] || []
      const inputs = {
        dias: cotDias.map((d) => ({
          fecha: d.fecha, horaInicio: d.hora_inicio?.slice(0, 5), horaFin: d.hora_fin?.slice(0, 5),
          cantidadBaristas: d.cantidad_baristas, tipoBarra: d.tipo_barra,
        })),
        cantidad_pax: cot.cantidad_pax || 0, nivel: cot.nivel === 'premium' ? 'Premium' : 'Esencial',
        tamano_vaso: cot.tamano_vaso, cantidad_cafes_override: cot.cantidad_cafes_override, sin_insumos: cot.sin_insumos,
        cantidad_baristas: cot.cantidad_baristas, tipo_barra: cot.tipo_barra, amortizacion_override: cot.amortizacion_override,
        cantidad_maquina_1grupo_extra: 0, cantidad_maquina_2grupos_extra: 0, cantidad_molino_extra: 0,
        costo_flete: 0, art: false, art_monto: 0, clausula_rc_monto: 0,
      }
      const r = calcularCotizacion(inputs, config, amortizaciones)
      total += r.amortizacionTotal || 0
    }
    setAmortizacionMesActual(total)
    setAmortizacionCargando(false)
  }

  // ---- KPIs de facturación (hoy / semana / mes / año) desde pagos crudo ----
  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const inicioSemana = new Date(inicioHoy); inicioSemana.setDate(inicioHoy.getDate() - inicioHoy.getDay())
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1)

  const sumaDesde = (fechaInicio) =>
    pagosCobros.filter((p) => parseFecha(p.fecha) >= fechaInicio).reduce((s, p) => s + Number(p.monto), 0)

  const kpiHoy = sumaDesde(inicioHoy)
  const kpiSemana = sumaDesde(inicioSemana)
  const kpiMes = sumaDesde(inicioMes)
  const kpiAnio = sumaDesde(inicioAnio)

  // Comparación mes actual vs mes anterior (facturación)
  const mesActualStr = inicioMes.toISOString().slice(0, 10)
  const filaMesActual = facturacionMensual.find((f) => f.mes === mesActualStr)
  const idxMesActual = facturacionMensual.findIndex((f) => f.mes === mesActualStr)
  const filaMesAnterior = idxMesActual > 0 ? facturacionMensual[idxMesActual - 1] : null
  const variacionPct = filaMesAnterior?.total_facturado
    ? (((filaMesActual?.total_facturado || 0) - filaMesAnterior.total_facturado) / filaMesAnterior.total_facturado) * 100
    : null

  // ---- Datos para gráficos ----
  const dataFacturacionChart = facturacionMensual.map((f) => ({ mes: formatMes(f.mes), total: Number(f.total_facturado) }))

  const dataUtilidadChart = utilidadMensual.map((u) => ({
    mes: formatMes(u.mes), utilidad: Number(u.utilidad), facturacion: Number(u.facturacion), gastos: Number(u.gastos) + Number(u.compras),
  }))

  const gastosPorCategoriaMesActual = {}
  for (const g of gastosMensual.filter((g) => g.mes === mesActualStr)) {
    gastosPorCategoriaMesActual[g.categoria] = (gastosPorCategoriaMesActual[g.categoria] || 0) + Number(g.total)
  }
  const dataGastosPie = Object.entries(gastosPorCategoriaMesActual).map(([cat, total]) => ({
    name: CATEGORIA_LABEL[cat] || cat, value: total, color: CATEGORIA_COLOR[cat] || '#999',
  }))

  const gastosPorMes = {}
  for (const g of gastosMensual) gastosPorMes[g.mes] = (gastosPorMes[g.mes] || 0) + Number(g.total)
  const dataGastosLinea = Object.entries(gastosPorMes).map(([mes, total]) => ({ mes: formatMes(mes), total }))

  const totalGastosMesActual = Object.values(gastosPorCategoriaMesActual).reduce((s, v) => s + v, 0)
  const idxGastosMesAnterior = Object.keys(gastosPorMes).sort().indexOf(mesActualStr) - 1
  const gastosMesAnteriorVal = idxGastosMesAnterior >= 0 ? Object.values(gastosPorMes)[idxGastosMesAnterior] : null

  const filaComprasMesActual = comprasMensual.find((c) => c.mes === mesActualStr)

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando reportes…</p>

  if (errorCarga) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudieron cargar los reportes</p>
        <p className="text-xs text-ink-mid mb-3">
          Esto casi siempre significa que el SQL de Reportes (<code>2026_09_reportes.sql</code>) todavía no se corrió en Supabase — las vistas que necesita esta pantalla no existen todavía.
        </p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{errorCarga}</p>
        <button onClick={cargarTodo} className="text-xs bg-wine text-paper rounded px-3 py-1.5 hover:bg-wine-mid transition-colors">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Reportes</p>
        <h1 className="font-display text-2xl">Cómo va Volveme</h1>
        <p className="text-sm text-ink-mid mt-1">Todo en base a plata real (percibida) — eventos, todavía sin e-commerce.</p>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 whitespace-nowrap text-xs px-3.5 py-1.5 rounded border transition-colors ${
              tab === key ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'facturacion' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Kpi icon={DollarSign} label="Hoy" valor={money(kpiHoy)} />
            <Kpi icon={DollarSign} label="Esta semana" valor={money(kpiSemana)} />
            <Kpi
              icon={DollarSign} label="Este mes" valor={money(kpiMes)}
              variacion={variacionPct}
            />
            <Kpi icon={DollarSign} label="Este año" valor={money(kpiAnio)} />
          </div>

          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Facturación mensual — últimos 12 meses</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dataFacturacionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyCorto} width={55} />
                <Tooltip formatter={(v) => money(v)} />
                <Line type="monotone" dataKey="total" stroke="#8c1c3a" strokeWidth={2.5} dot={{ r: 3 }} name="Facturación" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'gastos' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Kpi icon={Wallet} label="Gastos este mes" valor={money(totalGastosMesActual)} variacion={
              gastosMesAnteriorVal ? ((totalGastosMesActual - gastosMesAnteriorVal) / gastosMesAnteriorVal) * 100 : null
            } invertirColor />
            <Kpi icon={Truck} label="Logística/flete este mes" valor={money(gastosPorCategoriaMesActual.logistica_flete || 0)} />
            <Kpi icon={AlertCircle} label="Amortización (referencia, no resta)" valor={amortizacionCargando ? 'Calculando…' : money(amortizacionMesActual)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="border border-rule rounded-lg p-5 bg-paper-card">
              <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Por categoría — mes actual</p>
              {dataGastosPie.length === 0 ? (
                <p className="text-sm text-ink-light py-12 text-center">Sin gastos cargados este mes</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={dataGastosPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d) => moneyCorto(d.value)}>
                      {dataGastosPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="border border-rule rounded-lg p-5 bg-paper-card">
              <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Tendencia mensual</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dataGastosLinea}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyCorto} width={55} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Line type="monotone" dataKey="total" stroke="#c25242" strokeWidth={2.5} dot={{ r: 3 }} name="Gastos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light p-4 pb-2">Flete por evento — presupuestado vs pagado a Alejandro</p>
            {fletePorEvento.length === 0 ? (
              <p className="text-sm text-ink-light px-4 pb-4">Sin datos todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                    <th className="px-4 py-2.5 font-medium">Evento</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium text-right">Presupuestado</th>
                    <th className="px-4 py-2.5 font-medium text-right">Pagado real</th>
                    <th className="px-4 py-2.5 font-medium text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {fletePorEvento.map((f) => (
                    <tr key={f.evento_id} className="border-b border-rule last:border-0">
                      <td className="px-4 py-2.5 text-ink">{f.nombre}</td>
                      <td className="px-4 py-2.5 text-ink-mid">{parseFecha(f.fecha).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mid">{money(f.flete_presupuestado)}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mid">{money(f.flete_pagado_real)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${f.diferencia > 0 ? 'text-coral' : f.diferencia < 0 ? 'text-teal' : 'text-ink-light'}`}>
                        {f.diferencia > 0 ? '+' : ''}{money(f.diferencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'compras' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Kpi icon={ShoppingCart} label="Comprado este mes" valor={money(filaComprasMesActual?.total_comprado)} />
            <Kpi icon={Wallet} label="Pagado" valor={money(filaComprasMesActual?.total_pagado)} />
            <Kpi icon={AlertCircle} label="Pendiente de pago" valor={money(filaComprasMesActual?.total_pendiente)} invertirColor />
          </div>

          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Compras mensuales — comprado vs pagado</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comprasMensual.map((c) => ({ mes: formatMes(c.mes), comprado: Number(c.total_comprado), pagado: Number(c.total_pagado) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyCorto} width={55} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="comprado" fill="#c9a487" name="Comprado" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pagado" fill="#8c5a45" name="Pagado" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'utilidad' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Kpi
              icon={dataUtilidadChart.at(-1)?.utilidad >= 0 ? TrendingUp : TrendingDown}
              label="Utilidad este mes"
              valor={money(dataUtilidadChart.at(-1)?.utilidad)}
              destacado
            />
            <Kpi
              icon={AlertCircle}
              label="Margen este mes"
              valor={
                dataUtilidadChart.at(-1)?.facturacion
                  ? `${((dataUtilidadChart.at(-1).utilidad / dataUtilidadChart.at(-1).facturacion) * 100).toFixed(1)}%`
                  : '—'
              }
            />
          </div>

          <div className="border border-rule rounded-lg p-5 bg-paper-card mb-4">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Utilidad mensual — crecimiento real de la empresa</p>
            <p className="text-[11px] text-ink-light mb-4">Facturación percibida − gastos − compras. No incluye amortización de equipo (ver nota abajo).</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataUtilidadChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyCorto} width={55} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="utilidad" name="Utilidad" radius={[3, 3, 0, 0]}>
                  {dataUtilidadChart.map((d, i) => <Cell key={i} fill={d.utilidad >= 0 ? '#2e6b5e' : '#c25242'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-rule rounded-lg p-4 bg-paper-card mb-6 text-xs text-ink-light">
            <strong className="text-ink-mid">Desgaste de equipo este mes (referencia): {amortizacionCargando ? 'calculando…' : money(amortizacionMesActual)}.</strong> No
            resta de la utilidad de arriba — es plata que ya se pagó una sola vez, el día que se compró cada máquina (eso ya está
            contado en "Compras" ese mes). Este número sirve para chequear que el pricing de las cotizaciones no esté subestimando el
            desgaste real del equipo propio.
          </div>

          <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light p-4 pb-2">Por cobrar — eventos confirmados con saldo pendiente</p>
            {porCobrar.length === 0 ? (
              <p className="text-sm text-ink-light px-4 pb-4">No hay nada pendiente de cobro. 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                    <th className="px-4 py-2.5 font-medium">Evento</th>
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium text-right">Devengado</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cobrado</th>
                    <th className="px-4 py-2.5 font-medium text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {porCobrar.map((p) => (
                    <tr key={p.evento_id} className="border-b border-rule last:border-0">
                      <td className="px-4 py-2.5 text-ink">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-ink-mid">{p.cliente || '—'}</td>
                      <td className="px-4 py-2.5 text-ink-mid">{parseFecha(p.fecha).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mid">{money(p.devengado)}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mid">{money(p.percibido)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-coral">{money(p.pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, valor, variacion, invertirColor, destacado }) {
  const esPositivo = variacion != null && (invertirColor ? variacion < 0 : variacion > 0)
  const esNegativo = variacion != null && (invertirColor ? variacion > 0 : variacion < 0)
  return (
    <div className={`border rounded-lg p-4 ${destacado ? 'border-wine bg-wine/5' : 'border-rule bg-paper-card'}`}>
      <div className="flex items-center gap-1.5 text-ink-light mb-1.5">
        <Icon size={13} />
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-display text-ink">{valor}</p>
      {variacion != null && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${esPositivo ? 'text-teal' : esNegativo ? 'text-coral' : 'text-ink-light'}`}>
          {variacion > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(variacion).toFixed(1)}% vs mes anterior
        </p>
      )}
    </div>
  )
}
