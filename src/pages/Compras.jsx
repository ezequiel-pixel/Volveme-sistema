import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularNecesidadesInsumos } from '../lib/necesidadesInsumos'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import PanelNecesidades from '../components/PanelNecesidades'
import { Plus, Pencil, Trash2, X, Search, PackageCheck, MessageCircle } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const ESTADO_LABEL = { pendiente: 'Pendiente', comprado: 'Comprado', recibido: 'Recibido' }
const ESTADO_STYLE = {
  pendiente: 'bg-paper-warm text-ink-mid',
  comprado: 'bg-blue-light text-blue-dark',
  recibido: 'bg-wine text-paper',
}

const VACIO = {
  id: null,
  insumo_id: '',
  proveedor_id: '',
  cantidad_paquetes: 1,
  precio_unitario_pagado: '',
  fecha_compra: new Date().toISOString().slice(0, 10),
  estado: 'pendiente',
  notas: '',
}

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [insumos, setInsumos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [form, setForm] = useState(null)
  const [necesidades, setNecesidades] = useState(null)
  const [cargandoNecesidades, setCargandoNecesidades] = useState(true)

  async function cargar() {
    setLoading(true)
    const { data: comprasData } = await supabase
      .from('compras')
      .select('*, insumos(nombre, categoria, unidad_medida, cantidad_por_paquete, proveedor_id), proveedores(nombre_fantasia, telefono, alias_pago)')
      .order('fecha_compra', { ascending: false })
    setCompras(comprasData || [])

    const { data: insumosData } = await supabase.from('insumos').select('*').eq('activo', true).order('nombre')
    setInsumos(insumosData || [])

    const { data: proveedoresData } = await supabase.from('proveedores').select('*').order('nombre_fantasia')
    setProveedores(proveedoresData || [])
    setLoading(false)
  }

  /** El corazón "inteligente" del módulo: toma todos los eventos
   * confirmados a futuro, corre CADA UNO por el mismo motor de precios
   * que usa el cotizador (para no duplicar lógica en dos lugares), y
  async function cargarNecesidades() {
    setCargandoNecesidades(true)
    const r = await calcularNecesidadesInsumos()
    setNecesidades(r)
    setCargandoNecesidades(false)
  }

  useEffect(() => {
    cargar()
    cargarNecesidades()
  }, [])

  async function guardar() {
    const payload = {
      insumo_id: form.insumo_id || null,
      proveedor_id: form.proveedor_id || null,
      cantidad_paquetes: Number(form.cantidad_paquetes) || 1,
      precio_unitario_pagado: Number(form.precio_unitario_pagado) || 0,
      fecha_compra: form.fecha_compra,
      estado: form.estado,
      notas: form.notas || null,
    }
    if (form.id) {
      await supabase.from('compras').update(payload).eq('id', form.id)
    } else {
      await supabase.from('compras').insert(payload)
    }
    setForm(null)
    cargar()
  }

  async function eliminar(compra) {
    if (!confirm('¿Eliminar esta compra? Si ya estaba marcada como recibida, esto NO revierte el stock que sumó — ajustalo a mano en Insumos si hace falta.')) return
    await supabase.from('compras').delete().eq('id', compra.id)
    cargar()
  }

  /** Marca la compra como recibida Y suma el stock al insumo — en un
   * solo paso, para no tener que ir a Insumos a hacerlo a mano.
   * Solo suma si todavía no estaba en 'recibido' (evita duplicar el
   * stock si el botón se aprieta de nuevo por error). */
  async function marcarRecibido(compra) {
    if (compra.estado === 'recibido') return
    await supabase.from('compras').update({ estado: 'recibido' }).eq('id', compra.id)

    if (compra.insumo_id) {
      const { data: insumo } = await supabase.from('insumos').select('*').eq('id', compra.insumo_id).single()
      if (insumo) {
        const sumar = (Number(compra.cantidad_paquetes) || 0) * (Number(insumo.cantidad_por_paquete) || 1)
        await supabase.from('insumos').update({ stock_actual: (Number(insumo.stock_actual) || 0) + sumar }).eq('id', insumo.id)
      }
    }
    cargar()
    cargarNecesidades()
  }

  const filtrado = compras.filter((c) => {
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
    if (busqueda) {
      const texto = `${c.insumos?.nombre || ''} ${c.proveedores?.nombre_fantasia || ''}`.toLowerCase()
      if (!texto.includes(busqueda.toLowerCase())) return false
    }
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Compras</p>
          <h1 className="font-display text-2xl">Compras y proveedores</h1>
        </div>
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Registrar compra
        </button>
      </div>

      <PanelNecesidades necesidades={necesidades} cargando={cargandoNecesidades} />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 overflow-x-auto flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'pendiente', 'comprado', 'recibido'].map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded border transition-colors ${
                filtroEstado === e ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink hover:text-ink'
              }`}
            >
              {e === 'todos' ? 'Todas' : ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0 w-full sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="input pl-8 text-sm" />
        </div>
      </div>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}
      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">No hay compras que coincidan.</p>
      )}

      {!loading && filtrado.length > 0 && (
        <>
          <div className="hidden md:block border border-rule rounded-lg overflow-hidden bg-paper-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                  <th className="px-4 py-2.5 font-medium">Insumo</th>
                  <th className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cantidad</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total pagado</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((c) => (
                  <tr key={c.id} className="border-b border-rule last:border-0 hover:bg-paper/60">
                    <td className="px-4 py-3 font-medium text-ink">{c.insumos?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-ink-mid">
                      {c.proveedores?.nombre_fantasia
                        ? (
                          <span className="flex items-center gap-1.5">
                            {c.proveedores.nombre_fantasia}
                            {c.proveedores.telefono && (
                              <a href={armarLinkWhatsapp(c.proveedores.telefono, `¡Hola! Consultando por el pedido de ${c.insumos?.nombre || ''}.`)} target="_blank" rel="noreferrer" className="text-ink-light hover:text-wine">
                                <MessageCircle size={13} />
                              </a>
                            )}
                          </span>
                        )
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-mid">{new Date(c.fecha_compra + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3 text-right text-ink-mid">{c.cantidad_paquetes} {c.insumos?.tipo_paquete || ''}</td>
                    <td className="px-4 py-3 text-right text-ink">{money(c.cantidad_paquetes * c.precio_unitario_pagado)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_STYLE[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {c.estado !== 'recibido' && (
                          <button onClick={() => marcarRecibido(c)} className="flex items-center gap-1 text-xs text-wine hover:underline" title="Marca como recibido y suma el stock">
                            <PackageCheck size={13} /> Recibido
                          </button>
                        )}
                        <button onClick={() => setForm({ ...VACIO, ...c, insumo_id: c.insumo_id || '' })} className="text-ink-light hover:text-ink"><Pencil size={14} /></button>
                        <button onClick={() => eliminar(c)} className="text-ink-light hover:text-coral"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtrado.map((c) => (
              <div key={c.id} className="border border-rule rounded-lg p-4 bg-paper-card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-ink">{c.insumos?.nombre || '—'}</p>
                    <p className="text-xs text-ink-light">{c.proveedores?.nombre_fantasia || '—'} · {new Date(c.fecha_compra + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${ESTADO_STYLE[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                </div>
                <p className="text-sm text-ink-mid mb-3">{c.cantidad_paquetes} {c.insumos?.tipo_paquete} — {money(c.cantidad_paquetes * c.precio_unitario_pagado)}</p>
                <div className="flex items-center gap-4 pt-2 border-t border-rule">
                  {c.estado !== 'recibido' && (
                    <button onClick={() => marcarRecibido(c)} className="text-xs text-wine">Marcar recibido</button>
                  )}
                  <button onClick={() => setForm({ ...VACIO, ...c, insumo_id: c.insumo_id || '' })} className="text-xs text-ink-mid">Editar</button>
                  <button onClick={() => eliminar(c)} className="text-xs text-ink-mid hover:text-coral">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {form && (
        <FormModal
          form={form}
          setForm={setForm}
          insumos={insumos}
          proveedores={proveedores}
          onGuardar={guardar}
          onCerrar={() => setForm(null)}
        />
      )}
    </div>
  )
}

function FormModal({ form, setForm, insumos, proveedores, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }
  function elegirInsumo(insumoId) {
    const insumo = insumos.find((i) => String(i.id) === String(insumoId))
    // Al elegir el insumo, precarga el proveedor que tiene por default
    // (lo podés cambiar igual, por si esta vez le compraste a otro).
    setForm((f) => ({ ...f, insumo_id: insumoId, proveedor_id: insumo?.proveedor_id || f.proveedor_id }))
  }
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Registrar'} compra</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Insumo</label>
            <select className="input" value={form.insumo_id} onChange={(e) => elegirInsumo(e.target.value)}>
              <option value="">Elegir…</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} — {i.tipo_paquete}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Proveedor</label>
            <select className="input" value={form.proveedor_id || ''} onChange={(e) => set('proveedor_id', e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_fantasia}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Cantidad de paquetes</label>
              <input className="input" type="number" min="0" step="0.01" value={form.cantidad_paquetes} onChange={(e) => set('cantidad_paquetes', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Precio por paquete</label>
              <input className="input" type="number" min="0" value={form.precio_unitario_pagado} onChange={(e) => set('precio_unitario_pagado', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Fecha</label>
              <input className="input" type="date" value={form.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Estado</label>
              <select className="input" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="comprado">Comprado</option>
                <option value="recibido">Recibido</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onGuardar} className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors">Guardar</button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
