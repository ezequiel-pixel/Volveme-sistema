import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, FileText, RefreshCw, Cookie } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`

function formatFecha(fechaStr) {
  if (!fechaStr) return '—'
  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const estadoStyles = {
  enviada: 'bg-peach text-orange',
  negociacion: 'bg-blue-light text-blue-dark',
  aceptada: 'bg-wine text-paper',
  cancelada: 'bg-coral-light text-coral',
  recotizada: 'bg-paper-warm text-ink-light',
}

const estadoLabel = {
  enviada: 'Enviada',
  negociacion: 'En negociación',
  aceptada: 'Aceptada',
  cancelada: 'Cancelada',
  recotizada: 'Re-cotizada',
}

export default function CotizacionDetalle() {
  const { id } = useParams()
  const [cot, setCot] = useState(null)
  const [dias, setDias] = useState([])
  const [pasteleriaItems, setPasteleriaItems] = useState([])
  const [origen, setOrigen] = useState(null)
  const [siguiente, setSiguiente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const { data: cotizacion } = await supabase
        .from('cotizaciones')
        .select('*, clientes(nombre, telefono)')
        .eq('id', id)
        .single()

      const { data: diasData } = await supabase
        .from('cotizacion_dias')
        .select('*')
        .eq('cotizacion_id', id)
        .order('orden')

      setCot(cotizacion)
      setDias(diasData || [])

      if (cotizacion?.lleva_pasteleria) {
        const { data: itemsData } = await supabase
          .from('cotizacion_pasteleria_items')
          .select('*')
          .eq('cotizacion_id', id)
          .order('orden')
        setPasteleriaItems(itemsData || [])
      }

      // Si esta cotización viene de otra (fue re-cotizada desde una anterior)
      if (cotizacion?.recotizada_desde_id) {
        const { data: prev } = await supabase
          .from('cotizaciones')
          .select('id, fecha_evento, estado')
          .eq('id', cotizacion.recotizada_desde_id)
          .single()
        setOrigen(prev)
      }

      // Si esta cotización ya fue re-cotizada, buscar la versión que la reemplazó
      const { data: next } = await supabase
        .from('cotizaciones')
        .select('id, fecha_evento, estado')
        .eq('recotizada_desde_id', id)
        .maybeSingle()
      setSiguiente(next)

      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) {
    return <div className="text-center text-ink-light text-sm py-10">Cargando…</div>
  }
  if (!cot) {
    return <div className="text-center text-ink-light text-sm py-10">No se encontró la cotización.</div>
  }

  const esMultiDia = dias.length > 1

  return (
    <div>
      <Link to="/cotizaciones" className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink mb-4">
        <ArrowLeft size={15} /> Volver a Cotizaciones
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Detalle de cotización</p>
          <h1 className="font-display text-2xl">{cot.clientes?.nombre || '—'}</h1>
          <p className="text-sm text-ink-mid mt-1">{cot.nombre_evento || 'Evento privado'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${estadoStyles[cot.estado]}`}>
            {estadoLabel[cot.estado]}
          </span>
          <Link
            to={`/cotizaciones/${cot.id}/presupuesto`}
            target="_blank"
            className="flex items-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
          >
            <FileText size={15} /> Ver PDF
          </Link>
          <Link
            to={`/cotizaciones/nueva?desde=${cot.id}`}
            className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors"
          >
            <RefreshCw size={15} /> Re-cotizar
          </Link>
        </div>
      </div>

      {origen && (
        <p className="text-xs text-ink-light mb-4">
          Esta cotización viene de re-cotizar{' '}
          <Link to={`/cotizaciones/${origen.id}`} className="underline hover:text-ink">
            la versión del {formatFecha(origen.fecha_evento)} ({estadoLabel[origen.estado]})
          </Link>.
        </p>
      )}
      {siguiente && (
        <p className="text-xs text-ink-light mb-4">
          Esta cotización fue reemplazada por{' '}
          <Link to={`/cotizaciones/${siguiente.id}`} className="underline hover:text-ink">
            una versión más nueva ({estadoLabel[siguiente.estado]})
          </Link>.
        </p>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Columna izquierda — datos cargados */}
        <div className="space-y-4">
          <Seccion titulo="Evento">
            <Dato label="Lugar" valor={cot.lugar || '—'} />
            {cot.distancia_km != null && <Dato label="Distancia desde La Lucila" valor={`~${cot.distancia_km} km`} />}
            <Dato label="Cantidad de invitados" valor={cot.cantidad_pax ? `${cot.cantidad_pax} pax` : '—'} />
            <Dato label="Nivel" valor={cot.nivel === 'premium' ? 'Premium' : 'Esencial'} />
            <Dato label="Tamaño de vaso" valor={cot.tamano_vaso || '—'} />
          </Seccion>

          <Seccion titulo={esMultiDia ? 'Días del evento' : 'Día del evento'}>
            {dias.map((d, i) => (
              <div key={d.id} className={i > 0 ? 'pt-3 mt-3 border-t border-rule' : ''}>
                <Dato label={esMultiDia ? `Fecha (día ${i + 1})` : 'Fecha'} valor={formatFecha(d.fecha)} />
                {d.hora_inicio && d.hora_fin ? (
                  <Dato label="Horario" valor={`${d.hora_inicio.slice(0, 5)} a ${d.hora_fin.slice(0, 5)}hs`} />
                ) : (
                  <Dato label="Duración" valor={d.duracion_horas != null ? `${d.duracion_horas}hs (sin horario específico)` : '—'} />
                )}
              </div>
            ))}
          </Seccion>

          <Seccion titulo="Servicio">
            <Dato label="Cantidad de baristas" valor={cot.cantidad_baristas || '—'} />
            <Dato label="Tipo de barra" valor={cot.tipo_barra || '—'} />
            <Dato label="Cantidad de cafés (override)" valor={cot.cantidad_cafes_override || 'Automático (pax × consumo)'} />
            {cot.extra_barista_monto > 0 && <Dato label="Extra al barista" valor={money(cot.extra_barista_monto)} />}
            <Dato label="Calcos" valor={cot.calcos ? 'Sí' : 'No'} />
            <Dato label="Logo 3D" valor={cot.logo_3d ? 'Sí' : 'No'} />
            <Dato label="Alquiler máquina extra" valor={cot.alquiler_maquina_extra ? 'Sí' : 'No'} />
            <Dato label="Alquiler molino extra" valor={cot.alquiler_molino_extra ? 'Sí' : 'No'} />
          </Seccion>

          <Seccion titulo="Adicionales">
            <Dato label="Flete / Transporte" valor={money(cot.costo_flete)} />
            <Dato label="ART" valor={cot.art ? money(cot.art_monto) : 'No aplica'} />
            <Dato label="Cláusula RC" valor={money(cot.clausula_rc_monto)} />
            <Dato label="Extra distancia" valor={money(cot.extra_distancia)} />
          </Seccion>
        </div>

        {/* Columna derecha — resultado del cálculo (congelado al momento de crear/recotizar) */}
        <div className="space-y-4">
          <Seccion titulo="Resultado del cálculo" nota="Congelado al momento de guardar esta versión">
            <Dato label="Costo total" valor={money(cot.costo_total)} />
            <Dato label="Multiplicador aplicado" valor={cot.multiplicador || '—'} />
            <Dato label="Precio neto" valor={money(cot.precio_neto)} />
            <Dato label="IVA" valor={`${money(cot.iva_monto)} (${pct(cot.iva_pct)})`} />
            <div className="pt-3 mt-3 border-t border-rule">
              <Dato label="Precio final" valor={money(cot.precio_final)} bold />
            </div>
            <Dato label="Margen" valor={pct(cot.margen_pct)} />
          </Seccion>

          {cot.lleva_pasteleria && pasteleriaItems.length > 0 && (
            <Seccion titulo="Pastelería" nota={`Margen aplicado: ${((cot.pasteleria_markup_pct || 0) * 100).toFixed(0)}%`}>
              {pasteleriaItems.map((it) => {
                const precioUnitario = it.precio_proveedor * (1 + (cot.pasteleria_markup_pct || 0))
                return (
                  <Dato
                    key={it.id}
                    label={`${it.nombre_producto} (x${it.cantidad})`}
                    valor={money(precioUnitario * it.cantidad)}
                  />
                )
              })}
              <div className="pt-2 mt-2 border-t border-rule">
                <Dato label="Subtotal pastelería" valor={money(cot.pasteleria_subtotal)} bold />
              </div>
            </Seccion>
          )}

          <Seccion titulo="Cliente">
            <Dato label="Nombre" valor={cot.clientes?.nombre || '—'} />
            <Dato label="Teléfono" valor={cot.clientes?.telefono || '—'} />
          </Seccion>

          <Seccion titulo="Metadata">
            <Dato label="Creada" valor={cot.created_at ? new Date(cot.created_at).toLocaleString('es-AR') : '—'} />
            <Dato label="ID" valor={cot.id} />
          </Seccion>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, nota, children }) {
  return (
    <div className="border border-rule rounded-lg overflow-hidden bg-paper">
      <div className="px-5 py-3 border-b border-rule bg-paper-card">
        <h2 className="font-display text-base">{titulo}</h2>
        {nota && <p className="text-[11px] text-ink-light mt-0.5">{nota}</p>}
      </div>
      <div className="p-5 space-y-2.5 text-sm">{children}</div>
    </div>
  )
}

function Dato({ label, valor, bold }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-light text-xs uppercase tracking-wide">{label}</span>
      <span className={bold ? 'font-display text-xl text-wine' : 'text-ink font-medium text-right'}>{valor}</span>
    </div>
  )
}
