import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { generarPdfBlob } from '../lib/generarPdf'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  const [y, m, d] = fechaStr.split('-')
  return `${d}/${m}/${y}`
}

/** Traduce el "tipo de barra" de la cotización (texto libre elegido
 * en un select) a la máquina real que corresponde. Busca por
 * palabra clave así no depende de que el texto sea idéntico letra
 * por letra en config. */
function resolverEquipoPrincipal(tipoBarra) {
  const t = (tipoBarra || '').toLowerCase()
  if (t.includes('grande')) return 'Casadio Nettuno — 2 grupos + Molino Malkonig'
  if (t.includes('chica')) return 'ECM — 1 grupo + Molino Malkonig'
  return tipoBarra || 'No especificado'
}

export default function FichaOperativa() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [dias, setDias] = useState([])
  const [cotizacion, setCotizacion] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const [cafeDelMes, setCafeDelMes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const { data: ev } = await supabase.from('eventos').select('*, clientes(nombre)').eq('id', id).single()
      setEvento(ev)

      if (ev?.cotizacion_id) {
        const { data: cot } = await supabase.from('cotizaciones').select('*').eq('id', ev.cotizacion_id).single()
        setCotizacion(cot)

        const { data: cotDias } = await supabase
          .from('cotizacion_dias').select('*').eq('cotizacion_id', cot.id).order('orden')
        setDias(cotDias || [])

        const { data: configRows } = await supabase.from('config_pricing').select('*')
        const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
        const config = configArrayToObject(configRows || [])
        const amortizaciones = amortizacionesArrayToObject(amortRows || [])

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
        setResultado(calcularCotizacion(inputsRecalculo, config, amortizaciones))
      }

      const { data: asig } = await supabase
        .from('evento_staff').select('*, staff(nombre, telefono, tipo)').eq('evento_id', id)
      setAsignaciones(asig || [])

      const { data: cafe } = await supabase.from('cafe_del_mes').select('*').eq('activo', true).maybeSingle()
      setCafeDelMes(cafe)

      setLoading(false)
    }
    cargar()
  }, [id])

  async function handleDescargar() {
    setGenerando(true)
    const contenedor = document.querySelector('.ficha-operativa-contenedor')
    const blob = await generarPdfBlob(contenedor)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ficha-operativa-${(evento?.clientes?.nombre || evento?.nombre || 'evento').replace(/\s+/g, '-').toLowerCase()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setGenerando(false)
  }

  if (loading) return <div className="text-center py-24 text-ink-light text-sm">Cargando…</div>
  if (!evento) return <div className="text-center py-24 text-ink-light text-sm">No se encontró el evento.</div>

  const equipoPrincipal = resolverEquipoPrincipal(cotizacion?.tipo_barra)
  const extras = []
  if (cotizacion?.cantidad_maquina_1grupo_extra > 0) extras.push(`+ ${cotizacion.cantidad_maquina_1grupo_extra} máquina(s) 1 grupo extra (alquilada)`)
  if (cotizacion?.cantidad_maquina_2grupos_extra > 0) extras.push(`+ ${cotizacion.cantidad_maquina_2grupos_extra} máquina(s) 2 grupos extra (alquilada)`)
  if (cotizacion?.cantidad_molino_extra > 0) extras.push(`+ ${cotizacion.cantidad_molino_extra} molino(s) extra (alquilado)`)

  return (
    <div>
      <div className="print:hidden flex items-center justify-between gap-3 mb-6">
        <Link to={`/eventos/${id}`} className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink">
          <ArrowLeft size={15} /> Volver al evento
        </Link>
        <button
          onClick={handleDescargar}
          disabled={generando}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
        >
          {generando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {generando ? 'Generando…' : 'Descargar / Imprimir'}
        </button>
      </div>

      {/* Vista en pantalla, y lo que se captura para el PDF — una
          sola página, pensada para leerse rápido en barra, no para
          venderle nada a nadie. */}
      <div className="ficha-operativa-contenedor bg-paper-card border border-rule rounded-lg">
        <div className="pres-page p-8" style={{ minHeight: '1000px' }}>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Ficha operativa — uso interno</p>
          <h1 className="font-display text-2xl text-wine mb-1">{evento.clientes?.nombre || evento.nombre}</h1>
          <p className="text-sm text-ink-mid mb-6">{evento.nombre}</p>

          {/* Datos generales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 pb-6 border-b border-rule">
            <DatoFicha label="Lugar" valor={evento.lugar || '—'} />
            <DatoFicha label="Invitados" valor={cotizacion?.cantidad_pax ? `${cotizacion.cantidad_pax} pax` : '—'} />
            <DatoFicha label="Vaso" valor={cotizacion?.tamano_vaso || '—'} />
            <DatoFicha label="Nivel" valor={cotizacion?.nivel === 'premium' ? 'Premium' : 'Esencial'} />
          </div>

          {/* Días y horarios */}
          <h3 className="text-xs uppercase tracking-wide text-ink-light mb-2">Días y horarios</h3>
          <div className="space-y-1 mb-6 pb-6 border-b border-rule">
            {dias.length === 0 && <p className="text-sm text-ink-light">Sin días cargados.</p>}
            {dias.map((d) => (
              <p key={d.fecha} className="text-sm text-ink-mid">
                <strong className="text-ink">{formatFecha(d.fecha)}</strong>
                {' — '}{d.hora_inicio?.slice(0, 5)} a {d.hora_fin?.slice(0, 5)}hs
              </p>
            ))}
          </div>

          {/* Equipo */}
          <h3 className="text-xs uppercase tracking-wide text-ink-light mb-2">Equipo a usar</h3>
          <div className="mb-6 pb-6 border-b border-rule">
            <p className="text-sm font-medium text-ink">{equipoPrincipal}</p>
            {extras.map((e, i) => <p key={i} className="text-sm text-orange">{e}</p>)}
          </div>

          {/* Café del mes */}
          {cafeDelMes && (
            <div className="mb-6 pb-6 border-b border-rule">
              <h3 className="text-xs uppercase tracking-wide text-ink-light mb-2">Café que se sirve</h3>
              <p className="text-sm font-medium text-ink">{cafeDelMes.origen} — {cafeDelMes.variedad}</p>
              <p className="text-xs text-ink-light">{cafeDelMes.beneficio} · {cafeDelMes.puntaje} pts · Zafra {cafeDelMes.zafra}</p>
            </div>
          )}

          {/* Insumos necesarios */}
          {resultado && (
            <div className="mb-6 pb-6 border-b border-rule">
              <h3 className="text-xs uppercase tracking-wide text-ink-light mb-3">Insumos necesarios</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DatoFicha label="Café" valor={`${resultado.kilosCafeTotal?.toFixed(2) || 0} kg`} />
                <DatoFicha label="Leche" valor={`${resultado.litrosLecheTotal?.toFixed(2) || 0} L`} />
                <DatoFicha label="Vasos" valor={`${resultado.cantidadVasos || 0} u.`} />
                <DatoFicha label="Calcos" valor={cotizacion?.calcos ? `Sí, ${resultado.cantidadVasos || 0} u.` : 'No'} />
                <DatoFicha label="Azúcar" valor={`${resultado.sobresAzucarTotal || 0} sobres`} />
                <DatoFicha label="Edulcorante" valor={`${resultado.sobresEdulcoranteTotal || 0} sobres`} />
                <DatoFicha label="Removedores" valor={`${resultado.removedoresTotal || 0} u.`} />
                <DatoFicha label="Bidones de agua" valor={`${resultado.cantidadBidonesOperativos || 0} u.`} />
              </div>
            </div>
          )}

          {/* Staff asignado */}
          <div className="mb-2">
            <h3 className="text-xs uppercase tracking-wide text-ink-light mb-3">Staff asignado</h3>
            {asignaciones.length === 0 && <p className="text-sm text-ink-light">Sin staff asignado todavía.</p>}
            <div className="space-y-1.5">
              {asignaciones.map((a) => (
                <p key={a.id} className="text-sm text-ink-mid">
                  <strong className="text-ink">{a.staff?.nombre || '—'}</strong>
                  {a.rol_evento && ` — ${a.rol_evento}`}
                  {a.staff?.telefono && ` · ${a.staff.telefono}`}
                </p>
              ))}
            </div>
          </div>

          {evento.notas && (
            <div className="mt-6 pt-6 border-t border-rule">
              <h3 className="text-xs uppercase tracking-wide text-ink-light mb-2">Notas</h3>
              <p className="text-sm text-ink-mid whitespace-pre-wrap">{evento.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DatoFicha({ label, valor }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-light mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink">{valor}</p>
    </div>
  )
}
