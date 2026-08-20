import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { generarPdfBlob } from '../lib/generarPdf'
import { ArrowLeft, Download, Loader2, Plus, Trash2, AlertTriangle, Check } from 'lucide-react'

const CATEGORIAS = [
  { key: 'equipamiento', label: 'Equipamiento' },
  { key: 'cafe_leche', label: 'Café & Leche' },
  { key: 'herramientas', label: 'Herramientas' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'adicionales', label: 'Adicionales' },
  { key: 'limpieza', label: 'Limpieza' },
  { key: 'presentacion', label: 'Barra & Presentación' },
]

function resolverEquipoPrincipal(tipoBarra) {
  const t = (tipoBarra || '').toLowerCase()
  if (t.includes('grande')) return { barra: 'Barra grande (negra)', maquina: 'Casadio Nettuno 2 grupos' }
  return { barra: 'Barra chica (blanca)', maquina: 'ECM 1 grupo' }
}

export default function Checklist() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [items, setItems] = useState([])
  const [conflictos, setConflictos] = useState([])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [nuevoItem, setNuevoItem] = useState(null) // { categoria } cuando está agregando

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data: ev, error: errEv } = await supabase
        .from('eventos').select('*, clientes(nombre)').eq('id', id).single()
      if (errEv) throw errEv
      setEvento(ev)
      setNotas(ev?.checklist_notas || '')

      const { data: equipamientoList, error: errEquip } = await supabase
        .from('equipamiento').select('*').eq('activo', true)
      if (errEquip) throw errEquip

      let { data: itemsData, error: errItems } = await supabase
        .from('checklist_items').select('*, equipamiento(nombre, cantidad_total)')
        .eq('evento_id', id).order('orden')
      if (errItems) throw errItems

      // Primera vez que se abre el checklist de este evento — lo
      // armamos solo, con la lista real + las cantidades que ya
      // calcula el motor de precios donde corresponde.
      if (!itemsData || itemsData.length === 0) {
        itemsData = await generarChecklistDefault(ev, equipamientoList)
      }
      setItems(itemsData || [])

      // Conflictos: mismo equipamiento pedido en OTRO evento la misma
      // fecha — el problema real de tener máquinas propias limitadas.
      if (ev?.fecha) {
        const equipamientoIds = (itemsData || []).map((i) => i.equipamiento_id).filter(Boolean)
        if (equipamientoIds.length > 0) {
          const { data: otros } = await supabase
            .from('checklist_items')
            .select('equipamiento_id, evento_id, eventos!inner(id, nombre, fecha, clientes(nombre))')
            .in('equipamiento_id', equipamientoIds)
            .eq('eventos.fecha', ev.fecha)
            .neq('evento_id', id)
          const vistos = new Set()
          const confs = []
          for (const o of otros || []) {
            const clave = `${o.equipamiento_id}-${o.evento_id}`
            if (vistos.has(clave)) continue
            vistos.add(clave)
            const equipo = (equipamientoList || []).find((e) => e.id === o.equipamiento_id)
            confs.push({
              equipo: equipo?.nombre || 'Equipo',
              evento: o.eventos?.clientes?.nombre || o.eventos?.nombre || 'otro evento',
            })
          }
          setConflictos(confs)
        }
      }
    } catch (err) {
      console.error('Error cargando Checklist:', err)
      setError(err.message || 'No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  async function generarChecklistDefault(ev, equipamientoList) {
    const buscarEquipo = (nombre) => equipamientoList.find((e) => e.nombre === nombre)
    const items = []
    let orden = 0
    const push = (categoria, nombre, cantidad, equipamientoId) => {
      items.push({ evento_id: id, categoria, nombre, cantidad: cantidad || null, equipamiento_id: equipamientoId || null, marcado: false, orden: orden++ })
    }

    // Traer la cotización para calcular cantidades reales — mismo
    // motor de precios que el resto del sistema.
    let resultado = null
    let cotizacion = null
    if (ev?.cotizacion_id) {
      const { data: cot } = await supabase.from('cotizaciones').select('*').eq('id', ev.cotizacion_id).single()
      cotizacion = cot
      if (cot) {
        const { data: cotDias } = await supabase.from('cotizacion_dias').select('*').eq('cotizacion_id', cot.id).order('orden')
        const { data: configRows } = await supabase.from('config_pricing').select('*')
        const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
        const config = configArrayToObject(configRows || [])
        const amortizaciones = amortizacionesArrayToObject(amortRows || [])
        resultado = calcularCotizacion({
          dias: (cotDias || []).map((d) => ({ fecha: d.fecha, horaInicio: d.hora_inicio?.slice(0, 5), horaFin: d.hora_fin?.slice(0, 5) })),
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
          calcos: cot.calcos, logo_3d: cot.logo_3d, costo_flete: cot.costo_flete,
          art: cot.art, art_monto: cot.art_monto, clausula_rc_monto: cot.clausula_rc_monto,
          multiplicador: cot.multiplicador, iva_pct: cot.iva_pct,
        }, config, amortizaciones)
      }
    }

    const { barra, maquina } = resolverEquipoPrincipal(cotizacion?.tipo_barra)
    const eBarra = buscarEquipo(barra)
    const eMaquina = buscarEquipo(maquina)
    const eMolino = buscarEquipo('Molino Malkonig E65S')

    // EQUIPAMIENTO
    push('equipamiento', barra, null, eBarra?.id)
    push('equipamiento', maquina, null, eMaquina?.id)
    push('equipamiento', 'Molino Malkonig E65S', null, eMolino?.id)
    for (const n of ['Knockbox acero inox', 'Alargue', 'Bidón bendictino']) {
      const e = buscarEquipo(n)
      push('equipamiento', n, null, e?.id)
    }

    // CAFÉ & LECHE — cantidades calculadas donde el motor las tiene
    push('cafe_leche', 'Café', resultado ? `${resultado.kilosCafeTotal?.toFixed(2)} kg` : null)
    push('cafe_leche', 'Leche entera', resultado ? `${resultado.litrosLecheTotal?.toFixed(2)} L` : null)
    push('cafe_leche', 'Leche de avena', null)
    push('cafe_leche', 'Leche de almendras', null)
    push('cafe_leche', 'Agua (bendictino)', resultado ? `${resultado.aguaOperativaLitrosTotal?.toFixed(1)} L` : null)

    // HERRAMIENTAS — de tu inventario real, con cuántas tenés en total
    for (const n of ['Balanza mini', 'Balanza con pilas AAA', 'Tamper', 'Distribuidor', 'Mat', 'Pitcher 350ml', 'Pitcher 450ml', 'Pitcher 600ml', 'Pincel de limpieza', 'Paño área general/rejilla', 'Paño grande gris', 'Paño azul', 'Paño marrón', 'Tijera']) {
      const e = buscarEquipo(n)
      push('herramientas', n, e ? `x${e.cantidad_total}` : null, e?.id)
    }

    // SERVICIO — calculado
    push('servicio', `Vasos ${cotizacion?.tamano_vaso || ''}${cotizacion?.calcos ? ' con calco' : ''}`, resultado ? `${resultado.cantidadVasos}` : null)
    push('servicio', 'Removedores', resultado ? `${resultado.removedoresTotal}` : null)
    push('servicio', 'Azúcar', resultado ? `${resultado.sobresAzucarTotal}` : null)
    push('servicio', 'Edulcorante', resultado ? `${resultado.sobresEdulcoranteTotal}` : null)

    // LIMPIEZA — fijo
    for (const n of ['Tacho de basura', 'Bolsa de residuo', 'Esponja', 'Detergente', 'Alcohol']) {
      const e = buscarEquipo(n)
      push('limpieza', n, null, e?.id)
    }

    // BARRA & PRESENTACIÓN — de tu inventario
    for (const n of ['Cartel QR', 'Ficha de café', 'Tarjetas de presentación', 'Porta servilletas', 'Porta azúcar y edulcorante']) {
      const e = buscarEquipo(n)
      push('presentacion', n, null, e?.id)
    }

    const { data: insertados } = await supabase.from('checklist_items').insert(items).select('*, equipamiento(nombre, cantidad_total)')
    return insertados
  }

  async function toggleItem(item) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, marcado: !i.marcado } : i)))
    await supabase.from('checklist_items').update({ marcado: !item.marcado }).eq('id', item.id)
  }

  async function eliminarItem(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await supabase.from('checklist_items').delete().eq('id', item.id)
  }

  async function agregarItem() {
    if (!nuevoItem?.nombre) return
    const maxOrden = Math.max(0, ...items.filter((i) => i.categoria === nuevoItem.categoria).map((i) => i.orden))
    const { data } = await supabase.from('checklist_items').insert({
      evento_id: id, categoria: nuevoItem.categoria, nombre: nuevoItem.nombre,
      cantidad: nuevoItem.cantidad || null, orden: maxOrden + 1,
    }).select('*, equipamiento(nombre, cantidad_total)').single()
    if (data) setItems((prev) => [...prev, data])
    setNuevoItem(null)
  }

  async function guardarNotas() {
    await supabase.from('eventos').update({ checklist_notas: notas }).eq('id', id)
  }

  async function handleDescargar() {
    setGenerandoPdf(true)
    const contenedor = document.querySelector('.checklist-contenedor')
    const blob = await generarPdfBlob(contenedor)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checklist-${(evento?.clientes?.nombre || evento?.nombre || 'evento').replace(/\s+/g, '-').toLowerCase()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setGenerandoPdf(false)
  }

  if (loading) return <div className="text-center py-24 text-ink-light text-sm">Cargando…</div>
  if (!evento) return <div className="text-center py-24 text-ink-light text-sm">No se encontró el evento.</div>

  return (
    <div>
      <div className="print:hidden flex items-center justify-between gap-3 mb-6">
        <Link to={`/eventos/${id}`} className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink">
          <ArrowLeft size={15} /> Volver al evento
        </Link>
        <button
          onClick={handleDescargar}
          disabled={generandoPdf}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
        >
          {generandoPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {generandoPdf ? 'Generando…' : 'Descargar / Imprimir'}
        </button>
      </div>

      {error && (
        <div className="print:hidden flex items-center gap-2 text-sm bg-coral-light text-coral rounded-lg px-4 py-2.5 mb-4">
          <AlertTriangle size={15} className="flex-shrink-0" />
          No se pudo cargar: {error} — probá recargar la página.
        </div>
      )}

      {conflictos.length > 0 && (
        <div className="print:hidden bg-coral text-paper rounded-lg px-4 py-3 mb-4">
          <p className="text-sm font-medium flex items-center gap-2 mb-1">
            <AlertTriangle size={15} /> Equipamiento en conflicto el mismo día
          </p>
          {conflictos.map((c, i) => (
            <p key={i} className="text-xs">
              "{c.equipo}" también está pedido para <strong>{c.evento}</strong> — solo tenés una unidad. Resolvé esto antes del evento.
            </p>
          ))}
        </div>
      )}

      <div className="checklist-contenedor bg-paper-card border border-rule rounded-lg">
        <div className="pres-page p-8" style={{ minHeight: '1000px' }}>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Checklist — barra de café</p>
          <h1 className="font-display text-2xl text-wine mb-1">{evento.clientes?.nombre || evento.nombre}</h1>
          <p className="text-sm text-ink-mid mb-6">
            {evento.fecha && new Date(evento.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
            {evento.lugar ? ` — ${evento.lugar}` : ''}
          </p>

          {CATEGORIAS.map(({ key, label }) => {
            const itemsCategoria = items.filter((i) => i.categoria === key)
            return (
              <div key={key} className="mb-6 pb-6 border-b border-rule last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wide text-ink-light">{label}</h3>
                  <button
                    onClick={() => setNuevoItem({ categoria: key, nombre: '', cantidad: '' })}
                    className="print:hidden text-xs text-wine hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                {itemsCategoria.length === 0 && <p className="text-xs text-ink-light">Sin ítems.</p>}

                <div className="space-y-1.5">
                  {itemsCategoria.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 group">
                      <button
                        onClick={() => toggleItem(item)}
                        className={`print:hidden flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          item.marcado ? 'bg-wine border-wine' : 'border-rule'
                        }`}
                      >
                        {item.marcado && <Check size={12} className="text-paper" />}
                      </button>
                      <span className="hidden print:inline-block w-3 h-3 border border-ink flex-shrink-0" />
                      <span className={`text-sm flex-1 ${item.marcado ? 'text-ink-light line-through' : 'text-ink-mid'}`}>
                        {item.nombre}
                        {item.cantidad && <span className="text-ink-light"> — {item.cantidad}</span>}
                      </span>
                      <button onClick={() => eliminarItem(item)} className="print:hidden opacity-0 group-hover:opacity-100 text-ink-light hover:text-coral flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {nuevoItem?.categoria === key && (
                  <div className="print:hidden flex items-center gap-2 mt-2">
                    <input
                      autoFocus placeholder="Nombre" value={nuevoItem.nombre}
                      onChange={(e) => setNuevoItem((f) => ({ ...f, nombre: e.target.value }))}
                      className="input text-sm flex-1"
                    />
                    <input
                      placeholder="Cantidad (opcional)" value={nuevoItem.cantidad}
                      onChange={(e) => setNuevoItem((f) => ({ ...f, cantidad: e.target.value }))}
                      className="input text-sm w-32"
                    />
                    <button onClick={agregarItem} className="bg-wine text-paper text-xs rounded px-3 py-2 flex-shrink-0">Ok</button>
                    <button onClick={() => setNuevoItem(null)} className="text-ink-light text-xs flex-shrink-0">Cancelar</button>
                  </div>
                )}
              </div>
            )
          })}

          <div>
            <h3 className="text-xs uppercase tracking-wide text-ink-light mb-2">Notas</h3>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={guardarNotas}
              placeholder="ej: PEGAR CALCOS"
              rows={2}
              className="input text-sm print:border-none print:p-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
