import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, DollarSign } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function horasEntre(inicio, fin) {
  if (!inicio || !fin) return 0
  const [h1, m1] = inicio.slice(0, 5).split(':').map(Number)
  const [h2, m2] = fin.slice(0, 5).split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60)
}

export default function Facturacion() {
  const [tab, setTab] = useState('cobros')
  const [loading, setLoading] = useState(true)

  const [cobros, setCobros] = useState([])
  const [pagosStaff, setPagosStaff] = useState([])
  const [pagosProveedores, setPagosProveedores] = useState([])

  const [formPago, setFormPago] = useState(null)

  async function cargarTodo() {
    setLoading(true)
    await Promise.all([cargarCobros(), cargarPagosStaff(), cargarPagosProveedores()])
    setLoading(false)
  }

  useEffect(() => { cargarTodo() }, [])

  // ---- Cobros a clientes: lo que corresponde (precio_final de la
  // cotización) contra lo que ya se registró como cobrado. ----
  async function cargarCobros() {
    const { data: eventos } = await supabase
      .from('eventos')
      .select('*, clientes(nombre)')
      .in('estado', ['confirmado', 'realizado'])
      .not('cotizacion_id', 'is', null)
      .order('fecha', { ascending: false })

    const { data: pagosData } = await supabase.from('pagos').select('*').eq('tipo', 'cobro_cliente')

    const filas = []
    for (const ev of eventos || []) {
      const { data: cot } = await supabase.from('cotizaciones').select('precio_final').eq('id', ev.cotizacion_id).single()
      const esperado = cot?.precio_final || 0
      const cobrado = (pagosData || []).filter((p) => p.evento_id === ev.id).reduce((s, p) => s + Number(p.monto), 0)
      filas.push({ evento: ev, esperado, cobrado, pendiente: esperado - cobrado })
    }
    setCobros(filas)
  }

  // ---- Pagos a staff: horas reales asignadas × tarifa/hora de cada
  // persona, contra lo que ya se le pagó. ----
  async function cargarPagosStaff() {
    const { data: asignaciones } = await supabase
      .from('evento_staff')
      .select('*, staff(*), eventos(id, nombre, fecha, estado, clientes(nombre))')
      .in('estado', ['asignado', 'confirmado'])

    const { data: pagosData } = await supabase.from('pagos').select('*').eq('tipo', 'pago_staff')

    const filas = []
    for (const a of asignaciones || []) {
      if (!a.eventos || !['confirmado', 'realizado'].includes(a.eventos.estado)) continue
      const { data: dias } = await supabase.from('evento_dias').select('*').eq('evento_id', a.evento_id).order('orden')

      let horas = 0
      if (a.fecha) {
        const dia = (dias || []).find((d) => d.fecha === a.fecha)
        horas = dia ? horasEntre(dia.hora_inicio, dia.hora_fin) : 0
      } else {
        horas = (dias || []).reduce((s, d) => s + horasEntre(d.hora_inicio, d.hora_fin), 0)
      }

      const tarifa = Number(a.staff?.tarifa_hora) || 0
      const esperado = horas * tarifa + (Number(a.costo_extra) || 0)
      const pagado = (pagosData || [])
        .filter((p) => p.evento_id === a.evento_id && p.staff_id === a.staff_id)
        .reduce((s, p) => s + Number(p.monto), 0)

      filas.push({ asignacion: a, horas, esperado, pagado, pendiente: esperado - pagado })
    }
    setPagosStaff(filas)
  }

  // ---- Pagos a proveedores: lo que salió de cada compra contra lo
  // ya pagado. ----
  async function cargarPagosProveedores() {
    const { data: comprasData } = await supabase
      .from('compras')
      .select('*, insumos(nombre)')
      .in('estado', ['comprado', 'recibido'])

    const { data: pagosData } = await supabase.from('pagos').select('*').eq('tipo', 'pago_proveedor')

    const filas = (comprasData || []).map((c) => {
      const esperado = (Number(c.cantidad_paquetes) || 0) * (Number(c.precio_unitario_pagado) || 0)
      const pagado = (pagosData || []).filter((p) => p.compra_id === c.id).reduce((s, p) => s + Number(p.monto), 0)
      return { compra: c, esperado, pagado, pendiente: esperado - pagado }
    })
    setPagosProveedores(filas)
  }

  async function registrarPago() {
    await supabase.from('pagos').insert({
      tipo: formPago.tipo,
      evento_id: formPago.evento_id || null,
      staff_id: formPago.staff_id || null,
      compra_id: formPago.compra_id || null,
      descripcion: formPago.descripcion || null,
      monto: Number(formPago.monto) || 0,
      fecha: formPago.fecha,
      medio_pago: formPago.medio_pago || null,
      notas: formPago.notas || null,
    })
    setFormPago(null)
    cargarTodo()
  }

  const totalPorCobrar = cobros.reduce((s, f) => s + Math.max(0, f.pendiente), 0)
  const totalPorPagarStaff = pagosStaff.reduce((s, f) => s + Math.max(0, f.pendiente), 0)
  const totalPorPagarProveedores = pagosProveedores.reduce((s, f) => s + Math.max(0, f.pendiente), 0)

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Facturación</p>
        <h1 className="font-display text-2xl">Facturación y pagos</h1>
      </div>

      {/* Resumen — 3 números clave, siempre visibles */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1">Por cobrar</p>
          <p className="font-display text-xl sm:text-2xl text-wine">{money(totalPorCobrar)}</p>
        </div>
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1">Por pagar — staff</p>
          <p className="font-display text-xl sm:text-2xl text-wine">{money(totalPorPagarStaff)}</p>
        </div>
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1">Por pagar — proveedores</p>
          <p className="font-display text-xl sm:text-2xl text-wine">{money(totalPorPagarProveedores)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ['cobros', 'Cobros a clientes'],
          ['staff', 'Pagos a staff'],
          ['proveedores', 'Pagos a proveedores'],
        ].map(([key, label]) => (
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

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && tab === 'cobros' && (
        <TablaCobros filas={cobros} onRegistrar={(f) => setFormPago({
          tipo: 'cobro_cliente', evento_id: f.evento.id, descripcion: f.evento.clientes?.nombre || f.evento.nombre,
          monto: '', fecha: new Date().toISOString().slice(0, 10), medio_pago: '', notas: '',
        })} />
      )}

      {!loading && tab === 'staff' && (
        <TablaStaff filas={pagosStaff} onRegistrar={(f) => setFormPago({
          tipo: 'pago_staff', evento_id: f.asignacion.evento_id, staff_id: f.asignacion.staff_id,
          descripcion: `${f.asignacion.staff?.nombre} — ${f.asignacion.eventos?.nombre}`,
          monto: '', fecha: new Date().toISOString().slice(0, 10), medio_pago: 'Mercado Pago', notas: '',
        })} />
      )}

      {!loading && tab === 'proveedores' && (
        <TablaProveedores filas={pagosProveedores} onRegistrar={(f) => setFormPago({
          tipo: 'pago_proveedor', compra_id: f.compra.id, descripcion: `${f.compra.proveedor || ''} — ${f.compra.insumos?.nombre || ''}`,
          monto: '', fecha: new Date().toISOString().slice(0, 10), medio_pago: '', notas: '',
        })} />
      )}

      {formPago && <FormPago form={formPago} setForm={setFormPago} onGuardar={registrarPago} onCerrar={() => setFormPago(null)} />}
    </div>
  )
}

function EstadoPago({ pendiente }) {
  if (pendiente <= 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-wine text-paper">Al día</span>
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-coral-light text-coral">Pendiente</span>
}

function TablaCobros({ filas, onRegistrar }) {
  if (filas.length === 0) return <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">No hay eventos confirmados o realizados con cotización todavía.</p>
  return (
    <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
            <th className="px-4 py-2.5 font-medium">Evento</th>
            <th className="px-4 py-2.5 font-medium">Fecha</th>
            <th className="px-4 py-2.5 font-medium text-right">Corresponde</th>
            <th className="px-4 py-2.5 font-medium text-right">Cobrado</th>
            <th className="px-4 py-2.5 font-medium text-right">Pendiente</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.evento.id} className="border-b border-rule last:border-0 hover:bg-paper/60">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{f.evento.clientes?.nombre || f.evento.nombre}</p>
                <EstadoPago pendiente={f.pendiente} />
              </td>
              <td className="px-4 py-3 text-ink-mid">{new Date(f.evento.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.esperado)}</td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.cobrado)}</td>
              <td className="px-4 py-3 text-right font-medium text-ink">{money(Math.max(0, f.pendiente))}</td>
              <td className="px-4 py-3 text-right">
                {f.pendiente > 0 && (
                  <button onClick={() => onRegistrar(f)} className="flex items-center gap-1 text-xs text-wine hover:underline ml-auto">
                    <Plus size={13} /> Registrar cobro
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaStaff({ filas, onRegistrar }) {
  if (filas.length === 0) return <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">No hay staff asignado a eventos confirmados o realizados todavía.</p>
  return (
    <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
            <th className="px-4 py-2.5 font-medium">Persona</th>
            <th className="px-4 py-2.5 font-medium">Evento</th>
            <th className="px-4 py-2.5 font-medium text-right">Horas</th>
            <th className="px-4 py-2.5 font-medium text-right">Corresponde</th>
            <th className="px-4 py-2.5 font-medium text-right">Pagado</th>
            <th className="px-4 py-2.5 font-medium text-right">Pendiente</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-rule last:border-0 hover:bg-paper/60">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{f.asignacion.staff?.nombre || '—'}</p>
                {f.asignacion.staff?.alias_mercado_pago && (
                  <p className="text-xs text-ink-light">MP: {f.asignacion.staff.alias_mercado_pago}</p>
                )}
              </td>
              <td className="px-4 py-3 text-ink-mid">{f.asignacion.eventos?.clientes?.nombre || f.asignacion.eventos?.nombre || '—'}</td>
              <td className="px-4 py-3 text-right text-ink-mid">
                {f.horas.toFixed(1)}hs
                {f.asignacion.costo_extra > 0 && (
                  <p className="text-[11px] text-orange">+{money(f.asignacion.costo_extra)} {f.asignacion.costo_extra_desc || 'extra'}</p>
                )}
              </td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.esperado)}</td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.pagado)}</td>
              <td className="px-4 py-3 text-right font-medium text-ink">{money(Math.max(0, f.pendiente))}</td>
              <td className="px-4 py-3 text-right">
                {f.pendiente > 0 && (
                  <button onClick={() => onRegistrar(f)} className="flex items-center gap-1 text-xs text-wine hover:underline ml-auto">
                    <Plus size={13} /> Pagar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaProveedores({ filas, onRegistrar }) {
  if (filas.length === 0) return <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">No hay compras registradas como "comprado" o "recibido" todavía.</p>
  return (
    <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
            <th className="px-4 py-2.5 font-medium">Insumo</th>
            <th className="px-4 py-2.5 font-medium">Proveedor</th>
            <th className="px-4 py-2.5 font-medium text-right">Corresponde</th>
            <th className="px-4 py-2.5 font-medium text-right">Pagado</th>
            <th className="px-4 py-2.5 font-medium text-right">Pendiente</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.compra.id} className="border-b border-rule last:border-0 hover:bg-paper/60">
              <td className="px-4 py-3 font-medium text-ink">{f.compra.insumos?.nombre || '—'}</td>
              <td className="px-4 py-3 text-ink-mid">{f.compra.proveedor || '—'}</td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.esperado)}</td>
              <td className="px-4 py-3 text-right text-ink-mid">{money(f.pagado)}</td>
              <td className="px-4 py-3 text-right font-medium text-ink">{money(Math.max(0, f.pendiente))}</td>
              <td className="px-4 py-3 text-right">
                {f.pendiente > 0 && (
                  <button onClick={() => onRegistrar(f)} className="flex items-center gap-1 text-xs text-wine hover:underline ml-auto">
                    <Plus size={13} /> Pagar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormPago({ form, setForm, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl flex items-center gap-2"><DollarSign size={18} /> Registrar pago</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-ink-mid">{form.descripcion}</p>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Monto</label>
            <input className="input" type="number" min="0" autoFocus value={form.monto} onChange={(e) => set('monto', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Fecha</label>
              <input className="input" type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Medio de pago</label>
              <input className="input" placeholder="Transferencia, MP…" value={form.medio_pago} onChange={(e) => set('medio_pago', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onGuardar} disabled={!form.monto} className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50">Guardar</button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
