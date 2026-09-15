import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Package, Truck, Tag, CheckCircle2, AlertTriangle, ShoppingBag, Globe, Store } from 'lucide-react'

const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const COSTO_BOLSA = 200
const MINIMO_INTERIOR = 100000

const PUNTOS_ML = {
  kiosko_mirko: { label: 'Kiosko Mirko', direccion: 'Paraná 1413' },
  encomiendas: { label: 'Encomiendas', direccion: 'Av. Maipú 3028' },
}

const ETAPAS = ['pendiente_embalar', 'embalado', 'etiqueta_impresa', 'despachado']
const ETAPA_LABEL = { pendiente_embalar: 'Pendiente de embalar', embalado: 'Embalado', etiqueta_impresa: 'Etiqueta impresa', despachado: 'Despachado' }

export default function Logistica() {
  const [ventas, setVentas] = useState([])
  const [zonas, setZonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: v, error: err1 }, { data: z, error: err2 }] = await Promise.all([
      supabase.from('ventas').select('*, venta_items(cantidad, productos(nombre, sku_interno))')
        .eq('estado', 'confirmada').neq('estado_logistico', 'despachado').order('creado_en'),
      supabase.from('zonas_falco').select('*').order('partido'),
    ])
    if (err1 || err2) { setError((err1 || err2).message); setLoading(false); return }
    setVentas(v || [])
    setZonas(z || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function avanzarEtapa(venta) {
    const idx = ETAPAS.indexOf(venta.estado_logistico)
    const siguiente = ETAPAS[idx + 1]
    if (!siguiente) return
    const payload = { estado_logistico: siguiente }
    if (siguiente === 'embalado') payload.costo_embalaje = COSTO_BOLSA
    const { error: err } = await supabase.from('ventas').update(payload).eq('id', venta.id)
    if (err) { alert('No se pudo actualizar: ' + err.message); return }
    if (siguiente === 'despachado') {
      setVentas((prev) => prev.filter((x) => x.id !== venta.id))
    } else {
      setVentas((prev) => prev.map((x) => (x.id === venta.id ? { ...x, ...payload } : x)))
    }
  }

  async function actualizarCampo(venta, campo, valor) {
    setVentas((prev) => prev.map((x) => (x.id === venta.id ? { ...x, [campo]: valor } : x)))
    const { error: err } = await supabase.from('ventas').update({ [campo]: valor }).eq('id', venta.id)
    if (err) alert('No se pudo guardar: ' + err.message)
  }

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Logística</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL del módulo todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Productos</p>
        <h1 className="font-display text-2xl">Logística — paquetes pendientes</h1>
      </div>

      {ventas.length === 0 && (
        <p className="text-sm text-ink-light py-12 text-center border border-rule rounded-2xl">Todo despachado — no hay paquetes pendientes.</p>
      )}

      <div className="space-y-3">
        {ventas.map((venta) => {
          const zonaMatch = venta.partido ? zonas.find((z) => z.partido === venta.partido) : null
          const esInterior = venta.canal === 'ecommerce_propio' && venta.partido && !zonaMatch
          const alertaMinimo = esInterior && venta.total_venta < MINIMO_INTERIOR

          return (
            <div key={venta.id} className="rounded-2xl border border-rule bg-paper-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs text-ink-mid mb-1">
                    {venta.canal === 'mercado_libre' && <ShoppingBag size={12} />}
                    {venta.canal === 'ecommerce_propio' && <Globe size={12} />}
                    {venta.canal === 'b2b' && <Store size={12} />}
                    {venta.canal === 'mercado_libre' ? 'Mercado Libre' : venta.canal === 'ecommerce_propio' ? 'E-commerce propio' : 'B2B'}
                    {venta.cliente_nombre && ` · ${venta.cliente_nombre}`}
                  </span>
                  <p className="text-sm text-ink">
                    {(venta.venta_items || []).map((it) => `${it.cantidad}× ${it.productos?.nombre}`).join(', ')}
                  </p>
                </div>
                <span className="text-sm font-medium text-ink flex-shrink-0">{money(venta.total_venta)}</span>
              </div>

              {/* Etapa actual + botón de avanzar */}
              <div className="flex items-center gap-2 mb-3">
                {ETAPAS.map((e, i) => (
                  <div key={e} className={`flex-1 h-1.5 rounded-full ${ETAPAS.indexOf(venta.estado_logistico) >= i ? 'bg-teal-dark' : 'bg-paper-warm'}`} />
                ))}
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-mid">{ETAPA_LABEL[venta.estado_logistico]}</span>
                <button
                  onClick={() => avanzarEtapa(venta)}
                  className="flex items-center gap-1.5 text-xs bg-wine text-paper rounded-full px-3 py-1.5 hover:bg-wine-mid transition-colors"
                >
                  {venta.estado_logistico === 'pendiente_embalar' && <><Package size={13} /> Marcar embalado (+{money(COSTO_BOLSA)})</>}
                  {venta.estado_logistico === 'embalado' && <><Tag size={13} /> Marcar etiqueta impresa</>}
                  {venta.estado_logistico === 'etiqueta_impresa' && <><CheckCircle2 size={13} /> Marcar despachado</>}
                </button>
              </div>

              {/* Destino según canal */}
              {venta.canal === 'mercado_libre' && (
                <div className="pt-3 border-t border-rule">
                  <p className="text-xs text-ink-light mb-1.5">Punto de entrega</p>
                  <div className="flex gap-2">
                    {Object.entries(PUNTOS_ML).map(([key, p]) => (
                      <button
                        key={key}
                        onClick={() => actualizarCampo(venta, 'punto_entrega_ml', key)}
                        className={`flex-1 text-left text-xs rounded-lg px-3 py-2 border transition-colors ${
                          venta.punto_entrega_ml === key ? 'border-wine bg-wine text-paper' : 'border-rule text-ink-mid hover:border-wine'
                        }`}
                      >
                        <p className="font-medium">{p.label}</p>
                        <p className="opacity-80">{p.direccion}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {venta.canal === 'ecommerce_propio' && (
                <div className="pt-3 border-t border-rule">
                  <p className="text-xs text-ink-light mb-1.5">Partido del cliente</p>
                  <select
                    className="input text-sm mb-2"
                    value={venta.partido || ''}
                    onChange={(e) => actualizarCampo(venta, 'partido', e.target.value)}
                  >
                    <option value="">Elegir partido…</option>
                    {zonas.map((z) => <option key={z.partido} value={z.partido}>{z.partido} ({z.franja})</option>)}
                    <option value="__interior__">Interior del país (no está en el mapa Falco)</option>
                  </select>

                  {zonaMatch && (
                    <div className="rounded-lg bg-teal-light/40 px-3 py-2 text-xs text-ink">
                      <p className="font-medium">Entregar a la moto — antes de las 14hs — Rawson 3726 4°A</p>
                      <p className="text-ink-mid mt-0.5">{zonaMatch.franja} · costo Falco {money(zonaMatch.costo)}</p>
                    </div>
                  )}
                  {venta.partido === '__interior__' && (
                    <div className={`rounded-lg px-3 py-2 text-xs ${alertaMinimo ? 'bg-coral-light text-coral' : 'bg-paper-warm text-ink-mid'}`}>
                      <p className="font-medium">Interior del país — Andreani / Correo Argentino (definir cuál)</p>
                      {alertaMinimo && (
                        <p className="flex items-center gap-1 mt-1"><AlertTriangle size={12} /> Venta de {money(venta.total_venta)} — por debajo del mínimo sugerido de {money(MINIMO_INTERIOR)} para interior</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
