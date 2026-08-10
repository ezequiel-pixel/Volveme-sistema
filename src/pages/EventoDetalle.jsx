import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { ArrowLeft, Calendar, MapPin, Users, Coffee, Truck, FileText } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const estadoStyles = {
  lead: 'bg-paper-warm text-ink-mid',
  cotizado: 'bg-peach text-orange',
  confirmado: 'bg-blue-light text-blue-dark',
  realizado: 'bg-wine text-paper',
  cancelado: 'bg-coral-light text-coral',
}

export default function EventoDetalle() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [dias, setDias] = useState([])
  const [cotizacion, setCotizacion] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: ev } = await supabase
        .from('eventos')
        .select('*, clientes(nombre, telefono)')
        .eq('id', id)
        .single()
      const { data: diasData } = await supabase
        .from('evento_dias')
        .select('*')
        .eq('evento_id', id)
        .order('orden')

      setEvento(ev)
      setDias(diasData || [])

      if (ev?.cotizacion_id) {
        const { data: cot } = await supabase
          .from('cotizaciones')
          .select('*')
          .eq('id', ev.cotizacion_id)
          .single()
        setCotizacion(cot)

        if (cot) {
          const { data: configRows } = await supabase.from('config_pricing').select('*')
          const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
          const config = configArrayToObject(configRows || [])
          const amortizaciones = amortizacionesArrayToObject(amortRows || [])

          const { data: cotDias } = await supabase
            .from('cotizacion_dias')
            .select('*')
            .eq('cotizacion_id', cot.id)
            .order('orden')

          const inputsRecalculo = {
            dias: (cotDias || []).map((d) => ({
              fecha: d.fecha, horaInicio: d.hora_inicio?.slice(0, 5), horaFin: d.hora_fin?.slice(0, 5),
            })),
            cantidad_pax: cot.cantidad_pax || 0,
            nivel: cot.nivel === 'premium' ? 'Premium' : 'Esencial',
            tamano_vaso: cot.tamano_vaso,
            cantidad_cafes_override: cot.cantidad_cafes_override,
            cantidad_baristas: cot.cantidad_baristas,
            tipo_barra: cot.tipo_barra,
            amortizacion_override: cot.amortizacion_override,
            alquiler_maquina_extra: cot.alquiler_maquina_extra,
            alquiler_molino_extra: cot.alquiler_molino_extra,
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
      }
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) return <div className="text-center py-24 text-ink-light text-sm">Cargando…</div>
  if (!evento) return <div className="text-center py-24 text-ink-light text-sm">No se encontró el evento.</div>

  const esMultiDia = dias.length > 1

  return (
    <div>
      <Link to="/eventos" className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink mb-4">
        <ArrowLeft size={15} /> Volver a Eventos
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Ficha de evento</p>
          <h1 className="font-display text-3xl mb-2">{evento.nombre}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full ${estadoStyles[evento.estado]}`}>{evento.estado}</span>
        </div>
        {evento.cotizacion_id && (
          <Link
            to={`/cotizaciones/${evento.cotizacion_id}/presupuesto`}
            target="_blank"
            className="flex items-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
          >
            <FileText size={15} /> Ver presupuesto
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Datos generales */}
          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Datos generales</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Users} label="Cliente" valor={evento.clientes?.nombre || '—'} />
              <InfoItem icon={Users} label="Invitados (Pax)" valor={evento.cantidad_personas || '—'} />
              <InfoItem icon={MapPin} label="Ubicación" valor={evento.lugar || '—'} />
              <InfoItem icon={Users} label="Teléfono cliente" valor={evento.clientes?.telefono || '—'} />
            </div>
          </div>

          {/* Horario detallado por día */}
          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-4 flex items-center gap-1.5">
              <Calendar size={13} /> Horario {esMultiDia ? `(${dias.length} días)` : ''}
            </p>
            {dias.length === 0 && <p className="text-sm text-ink-light">Sin días cargados.</p>}
            <div className="space-y-2">
              {dias.map((dia, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-rule last:border-0 pb-2 last:pb-0">
                  <span className="text-ink-mid capitalize">
                    {esMultiDia ? `Día ${i + 1} — ` : ''}{formatFecha(dia.fecha)}
                  </span>
                  <span className="font-medium text-ink">
                    {dia.hora_inicio?.slice(0, 5)} a {dia.hora_fin?.slice(0, 5)}hs
                  </span>
                </div>
              ))}
            </div>
            {resultado && (
              <p className="text-xs text-ink-light mt-3 pt-3 border-t border-rule">
                Total: {resultado.cantidadDias} día{resultado.cantidadDias > 1 ? 's' : ''} · {resultado.totalHoras.toFixed(1)} hs de servicio
              </p>
            )}
          </div>

          {/* Insumos exactos */}
          {resultado ? (
            <div className="border border-rule rounded-lg p-5 bg-paper-card">
              <p className="text-xs uppercase tracking-wide text-ink-light mb-4 flex items-center gap-1.5">
                <Coffee size={13} /> Insumos necesarios (cantidad exacta)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <InsumoLinea label="Café" valor={`${resultado.kilosCafeTotal.toFixed(2)} kg`} sub={`${Math.round(resultado.gramosCafeTotal)} g totales`} />
                <InsumoLinea label="Leche" valor={`${resultado.litrosLecheTotal.toFixed(2)} L`} />
                <InsumoLinea label="Agua" valor={`${resultado.litrosAguaTotal.toFixed(2)} L`} />
                <InsumoLinea label={`Vasos (${cotizacion.tamano_vaso})`} valor={`${resultado.cantidadVasos} u.`} sub={`≈ ${Math.ceil(resultado.cajasVasos)} caja/s x50`} />
                <InsumoLinea label="Sobres de azúcar" valor={`${resultado.sobresAzucarTotal} u.`} />
                <InsumoLinea label="Sobres de edulcorante" valor={`${resultado.sobresEdulcoranteTotal} u.`} />
                <InsumoLinea label="Removedores" valor={`${resultado.removedoresTotal} u.`} />
                {resultado.calcosTotal > 0 && <InsumoLinea label="Calcos" valor={`${resultado.calcosTotal} u.`} />}
                {resultado.logo3dTotal > 0 && <InsumoLinea label="Logo 3D" valor={`${resultado.logo3dTotal} u.`} />}
              </div>
              <p className="text-xs text-ink-light mt-4 pt-3 border-t border-rule">
                Calculado sobre {resultado.bebidasReales.toFixed(1)} bebidas · Nivel {cotizacion.nivel}
              </p>
            </div>
          ) : (
            <div className="border border-rule rounded-lg p-5 bg-paper-card text-sm text-ink-light">
              Este evento no tiene una cotización asociada (fue cargado manualmente), así que no hay desglose de insumos disponible.
            </div>
          )}

          {/* Equipo y logística */}
          {cotizacion && (
            <div className="border border-rule rounded-lg p-5 bg-paper-card">
              <p className="text-xs uppercase tracking-wide text-ink-light mb-4 flex items-center gap-1.5">
                <Truck size={13} /> Equipo y logística
              </p>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Baristas" valor={`${cotizacion.cantidad_baristas || 1}`} />
                <InfoItem label="Tipo de barra" valor={cotizacion.tipo_barra || '—'} />
                <InfoItem label="Máquina extra" valor={cotizacion.alquiler_maquina_extra ? 'Sí' : 'No'} />
                <InfoItem label="Molino extra" valor={cotizacion.alquiler_molino_extra ? 'Sí' : 'No'} />
                <InfoItem label="ART" valor={cotizacion.art ? `Sí — ${money(cotizacion.art_monto)}` : 'No'} />
                <InfoItem label="Costo de flete" valor={money(cotizacion.costo_flete)} />
              </div>
            </div>
          )}
        </div>

        {/* Resumen económico interno (no va al cliente) */}
        {resultado && (
          <div className="lg:sticky lg:top-8">
            <div className="border border-rule rounded-lg p-5 bg-paper-card space-y-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Resumen económico (interno)</p>
              <LineaResumen label="Insumos" valor={money(resultado.totalInsumos)} />
              <LineaResumen label="Mano de obra" valor={money(resultado.totalManoDeObra)} />
              <LineaResumen label="Amortización equipo" valor={money(resultado.amortizacionTotal)} />
              <LineaResumen label="Flete" valor={money(resultado.flete)} />
              {resultado.art > 0 && <LineaResumen label="ART" valor={money(resultado.art)} />}
              <div className="border-t border-rule pt-3">
                <LineaResumen label="Costo total" valor={money(resultado.costoTotal)} bold />
              </div>
              <div className="border-t border-rule pt-3">
                <LineaResumen label="Precio cobrado" valor={money(resultado.precioFinal)} bold />
                <LineaResumen label="Margen" valor={`${(resultado.margenPct * 100).toFixed(1)}%`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, valor }) {
  return (
    <div>
      <p className="text-xs text-ink-light flex items-center gap-1 mb-0.5">
        {Icon && <Icon size={11} />} {label}
      </p>
      <p className="text-sm font-medium text-ink">{valor}</p>
    </div>
  )
}

function InsumoLinea({ label, valor, sub }) {
  return (
    <div className="bg-paper border border-rule rounded px-3 py-2.5">
      <p className="text-xs text-ink-light mb-0.5">{label}</p>
      <p className="text-base font-display text-wine">{valor}</p>
      {sub && <p className="text-[11px] text-ink-light">{sub}</p>}
    </div>
  )
}

function LineaResumen({ label, valor, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-ink-mid ${bold ? 'font-medium text-ink' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-medium text-ink' : 'text-ink-mid'}`}>{valor}</span>
    </div>
  )
}
