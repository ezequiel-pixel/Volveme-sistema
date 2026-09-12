import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, Search, Trash2, Pencil } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const UNIDAD_LABEL = { barra_cafe: 'Barra de café', productos: 'Productos', compartido: 'Compartido' }
const UNIDAD_COLOR = {
  barra_cafe: 'bg-peach text-orange',
  productos: 'bg-blue-light text-blue-dark',
  compartido: 'bg-paper-warm text-ink-mid',
}

const VACIO = {
  id: null,
  unidad_negocio: 'barra_cafe',
  capex: false,
  categoria: '',
  tipo_gasto: '',
  descripcion: '',
  evento_o_cliente: '',
  monto_ars: '',
  monto_usd: '',
  tipo_cambio: '',
  moneda_original: 'ARS',
  medio_pago: '',
  responsable: '',
  estado_pago: 'pagado',
  porcentaje_imputado_barra: '',
  mes: new Date().toISOString().slice(0, 7) + '-01',
  fecha: new Date().toISOString().slice(0, 10),
  facturado: '',
  notas: '',
}

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroUnidad, setFiltroUnidad] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const [form, setForm] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from('gastos_generales').select('*').order('fecha', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setGastos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    const payload = {
      unidad_negocio: form.unidad_negocio,
      capex: form.capex,
      categoria: form.categoria.trim(),
      tipo_gasto: form.tipo_gasto || null,
      descripcion: form.descripcion.trim(),
      evento_o_cliente: form.evento_o_cliente || null,
      monto_ars: Number(form.monto_ars) || 0,
      monto_usd: form.monto_usd ? Number(form.monto_usd) : null,
      tipo_cambio: form.tipo_cambio ? Number(form.tipo_cambio) : null,
      moneda_original: form.moneda_original,
      medio_pago: form.medio_pago || null,
      responsable: form.responsable || null,
      estado_pago: form.estado_pago,
      porcentaje_imputado_barra: form.unidad_negocio === 'compartido' && form.porcentaje_imputado_barra !== ''
        ? Number(form.porcentaje_imputado_barra) : null,
      mes: form.mes,
      fecha: form.fecha || null,
      facturado: form.facturado || null,
      notas: form.notas || null,
      fuente: form.id ? undefined : 'Carga manual',
    }
    const { error: err } = form.id
      ? await supabase.from('gastos_generales').update(payload).eq('id', form.id)
      : await supabase.from('gastos_generales').insert(payload)
    if (err) { alert('No se pudo guardar: ' + err.message); return }
    setForm(null)
    cargar()
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar "${g.descripcion}" (${money(g.monto_ars)})?`)) return
    const { error: err } = await supabase.from('gastos_generales').delete().eq('id', g.id)
    if (err) { alert('No se pudo eliminar: ' + err.message); return }
    cargar()
  }

  function abrirEdicion(g) {
    setForm({
      ...g,
      monto_ars: g.monto_ars ?? '',
      monto_usd: g.monto_usd ?? '',
      tipo_cambio: g.tipo_cambio ?? '',
      porcentaje_imputado_barra: g.porcentaje_imputado_barra ?? '',
      evento_o_cliente: g.evento_o_cliente || '',
      medio_pago: g.medio_pago || '',
      responsable: g.responsable || '',
      facturado: g.facturado || '',
      notas: g.notas || '',
      tipo_gasto: g.tipo_gasto || '',
      mes: g.mes,
      fecha: g.fecha || '',
    })
  }

  // ---- Meses disponibles para el filtro, ordenados descendente ----
  const mesesDisponibles = [...new Set(gastos.map((g) => g.mes))].sort().reverse()

  const gastosFiltrados = gastos.filter((g) => {
    if (filtroMes !== 'todos' && g.mes !== filtroMes) return false
    if (filtroUnidad !== 'todos' && g.unidad_negocio !== filtroUnidad) return false
    if (busqueda && !`${g.descripcion} ${g.categoria} ${g.evento_o_cliente || ''}`.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalFiltrado = gastosFiltrados.reduce((s, g) => s + Number(g.monto_ars), 0)

  function formatMes(mesStr) {
    const [y, m] = mesStr.split('-')
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    return `${MESES[Number(m) - 1]} ${y}`
  }

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudieron cargar los gastos</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL de "gastos_generales" todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Gastos</p>
          <h1 className="font-display text-2xl">Gastos de la empresa</h1>
          <p className="text-sm text-ink-mid mt-1">Sueldos, marketing, legales, compras de producto, infraestructura — todo lo que no está atado a un evento puntual.</p>
        </div>
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Nuevo gasto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select className="input sm:w-48" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map((m) => <option key={m} value={m}>{formatMes(m)}</option>)}
        </select>
        <select className="input sm:w-48" value={filtroUnidad} onChange={(e) => setFiltroUnidad(e.target.value)}>
          <option value="todos">Todas las unidades</option>
          <option value="barra_cafe">Barra de café</option>
          <option value="productos">Productos</option>
          <option value="compartido">Compartido</option>
        </select>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            className="input pl-9" placeholder="Buscar por descripción, categoría, evento…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-ink-light">{gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''}</p>
        <p className="text-sm font-medium text-ink">Total: {money(totalFiltrado)}</p>
      </div>

      {/* Tabla */}
      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Unidad</th>
              <th className="px-4 py-2.5 font-medium">Categoría</th>
              <th className="px-4 py-2.5 font-medium">Descripción</th>
              <th className="px-4 py-2.5 font-medium">Responsable</th>
              <th className="px-4 py-2.5 font-medium text-right">Monto</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-light">Sin gastos para este filtro.</td></tr>
            )}
            {gastosFiltrados.map((g) => (
              <tr key={g.id} className="border-b border-rule last:border-0 hover:bg-paper/60">
                <td className="px-4 py-3 text-ink-mid whitespace-nowrap">{g.fecha ? new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${UNIDAD_COLOR[g.unidad_negocio]}`}>{UNIDAD_LABEL[g.unidad_negocio]}</span>
                  {g.capex && <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-coral-light text-coral">CAPEX</span>}
                </td>
                <td className="px-4 py-3 text-ink-mid">{g.categoria}</td>
                <td className="px-4 py-3 text-ink">
                  {g.descripcion}
                  {g.evento_o_cliente && <span className="block text-[11px] text-ink-light">{g.evento_o_cliente}</span>}
                </td>
                <td className="px-4 py-3 text-ink-mid">{g.responsable || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-ink whitespace-nowrap">{money(g.monto_ars)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${g.estado_pago === 'pagado' ? 'bg-teal-light text-teal-dark' : 'bg-coral-light text-coral'}`}>
                    {g.estado_pago === 'pagado' ? 'Pagado' : 'No pagado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => abrirEdicion(g)} className="text-ink-light hover:text-wine"><Pencil size={13} /></button>
                    <button onClick={() => eliminar(g)} className="text-ink-light hover:text-coral"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Nuevo'} gasto</h2>
              <button onClick={() => setForm(null)} className="text-ink-light hover:text-ink"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ink-mid mb-1">Descripción *</label>
                <input className="input" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Unidad de negocio</label>
                  <select className="input" value={form.unidad_negocio} onChange={(e) => setForm((f) => ({ ...f, unidad_negocio: e.target.value }))}>
                    <option value="barra_cafe">Barra de café</option>
                    <option value="productos">Productos</option>
                    <option value="compartido">Compartido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Categoría *</label>
                  <input className="input" placeholder="Sueldos, Marketing…" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
                </div>
              </div>

              {form.unidad_negocio === 'compartido' && (
                <div>
                  <label className="block text-xs text-ink-mid mb-1">% de este gasto que es de Barra de café (vacío = 50/50)</label>
                  <input type="number" min="0" max="1" step="0.05" className="input" placeholder="0.5"
                    value={form.porcentaje_imputado_barra}
                    onChange={(e) => setForm((f) => ({ ...f, porcentaje_imputado_barra: e.target.value }))} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Monto (ARS) *</label>
                  <input type="number" className="input" value={form.monto_ars} onChange={(e) => setForm((f) => ({ ...f, monto_ars: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Tipo de gasto</label>
                  <select className="input" value={form.tipo_gasto} onChange={(e) => setForm((f) => ({ ...f, tipo_gasto: e.target.value }))}>
                    <option value="">—</option>
                    <option value="fijo">Fijo</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Mes</label>
                  <input type="month" className="input" value={form.mes?.slice(0, 7)} onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value + '-01' }))} />
                </div>
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Fecha exacta</label>
                  <input type="date" className="input" value={form.fecha || ''} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Medio de pago</label>
                  <input className="input" placeholder="Transferencia, Efectivo…" value={form.medio_pago} onChange={(e) => setForm((f) => ({ ...f, medio_pago: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Responsable</label>
                  <input className="input" placeholder="Quién pagó" value={form.responsable} onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-mid mb-1">Evento / Cliente (opcional)</label>
                <input className="input" value={form.evento_o_cliente} onChange={(e) => setForm((f) => ({ ...f, evento_o_cliente: e.target.value }))} />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-mid">
                  <input type="checkbox" checked={form.capex} onChange={(e) => setForm((f) => ({ ...f, capex: e.target.checked }))} />
                  Es CAPEX (inversión, no gasto corriente)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-mid">
                  <input type="checkbox" checked={form.estado_pago === 'pagado'} onChange={(e) => setForm((f) => ({ ...f, estado_pago: e.target.checked ? 'pagado' : 'no_pagado' }))} />
                  Ya está pagado
                </label>
              </div>

              <div>
                <label className="block text-xs text-ink-mid mb-1">Notas</label>
                <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={guardar}
                disabled={!form.descripcion || !form.categoria || !form.monto_ars}
                className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
              >
                Guardar
              </button>
              <button onClick={() => setForm(null)} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
