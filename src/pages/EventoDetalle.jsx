import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import { ArrowLeft, Calendar, MapPin, Users, Coffee, Truck, FileText, UserPlus, MessageCircle, X, ClipboardList } from 'lucide-react'

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

const TIPO_LABEL = { barista: 'Barista', logistica: 'Logística', proveedor: 'Proveedor', otro: 'Otro' }

export default function EventoDetalle() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [dias, setDias] = useState([])
  const [cotizacion, setCotizacion] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [asignaciones, setAsignaciones] = useState([])
  const [staffDisponible, setStaffDisponible] = useState([])
  const [formAsignacion, setFormAsignacion] = useState(null)

  async function cargarStaff() {
    const { data: asig } = await supabase
      .from('evento_staff')
      .select('*, staff(*)')
      .eq('evento_id', id)
      .order('created_at')
    setAsignaciones(asig || [])

    const { data: disponible } = await supabase
      .from('staff')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setStaffDisponible(disponible || [])
  }

  async function asignarStaff() {
    if (!formAsignacion?.staff_id) return
    await supabase.from('evento_staff').insert({
      evento_id: id,
      staff_id: formAsignacion.staff_id,
      fecha: formAsignacion.fecha || null,
      rol_evento: formAsignacion.rol_evento || null,
      costo_extra: formAsignacion.costo_extra ? Number(formAsignacion.costo_extra) : null,
      costo_extra_desc: formAsignacion.costo_extra_desc || null,
    })
    setFormAsignacion(null)
    cargarStaff()
  }

  async function desasignar(asignacionId) {
    await supabase.from('evento_staff').delete().eq('id', asignacionId)
    cargarStaff()
  }

  async function cambiarEstadoAsignacion(asignacionId, estado) {
    await supabase.from('evento_staff').update({ estado }).eq('id', asignacionId)
    cargarStaff()
  }

  /** Arma el mensaje de WhatsApp con toda la info del evento para esa
   * persona puntual — si la asignación tiene un día específico, solo
   * ese día; si no, todos los días del evento. */
  function armarMensajeAsignacion(asignacion) {
    const persona = asignacion.staff
    const diaEspecifico = asignacion.fecha ? dias.find((d) => d.fecha === asignacion.fecha) : null

    const lineaFechaHorario = diaEspecifico
      ? `📅 ${formatFecha(diaEspecifico.fecha)}\n⏰ ${diaEspecifico.hora_inicio?.slice(0, 5)} a ${diaEspecifico.hora_fin?.slice(0, 5)}hs`
      : dias.map((d) => `📅 ${formatFecha(d.fecha)} — ⏰ ${d.hora_inicio?.slice(0, 5)} a ${d.hora_fin?.slice(0, 5)}hs`).join('\n')

    return (
      `¡Hola ${persona.nombre.split(' ')[0]}! Te paso los datos del evento en el que quedaste asignado/a:\n\n` +
      `📌 Cliente: ${evento.clientes?.nombre || evento.nombre}\n` +
      `${lineaFechaHorario}\n` +
      `📍 Lugar: ${evento.lugar || 'A confirmar'}\n` +
      `👥 Invitados: ${evento.cantidad_personas || '—'} pax\n` +
      (asignacion.rol_evento ? `🔧 Tu rol: ${asignacion.rol_evento}\n` : '') +
      `\nCualquier duda, avisame. ¡Gracias!`
    )
  }

  const [formEdicionRapida, setFormEdicionRapida] = useState(null)
  const [tiposBarra, setTiposBarra] = useState([])

  /** Separada del useEffect para poder llamarla de nuevo después de
   * guardar una edición rápida — así el resumen y el desglose de
   * insumos se recalculan solos con el motor de precios real, sin
   * duplicar la lógica de cálculo en otro lado. */
  async function cargarCotizacionYResultado() {
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
        setTiposBarra(Object.keys(amortizaciones))

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
    }
    setLoading(false)
  }

  /** Guarda los campos operativos que suelen cambiar la semana previa
   * al evento — sin tocar el resto de la cotización (precio, cliente,
   * etc). Después recalcula todo con cargarCotizacionYResultado(). */
  async function guardarEdicionRapida() {
    await supabase.from('cotizaciones').update({
      calcos: formEdicionRapida.calcos,
      cantidad_cafes_override: formEdicionRapida.cantidad_cafes_override === '' ? null : Number(formEdicionRapida.cantidad_cafes_override),
      cantidad_baristas: Number(formEdicionRapida.cantidad_baristas) || 1,
      tipo_barra: formEdicionRapida.tipo_barra,
      nivel: formEdicionRapida.nivel.toLowerCase(),
    }).eq('id', cotizacion.id)
    setFormEdicionRapida(null)
    cargarCotizacionYResultado()
  }

  useEffect(() => {
    cargarCotizacionYResultado()
    cargarStaff()
  }, [id])

  if (loading) return <div className="text-center py-24 text-ink-light text-sm">Cargando…</div>
  if (!evento) return <div className="text-center py-24 text-ink-light text-sm">No se encontró el evento.</div>

  const esMultiDia = dias.length > 1

  return (
    <div>
      <Link to="/eventos" className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink mb-4">
        <ArrowLeft size={15} /> Volver a Eventos
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Ficha de evento</p>
          <h1 className="font-display text-3xl mb-2">{evento.nombre}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full ${estadoStyles[evento.estado]}`}>{evento.estado}</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {evento.cotizacion_id && (
            <Link
              to={`/cotizaciones/${evento.cotizacion_id}/presupuesto`}
              target="_blank"
              className="flex items-center justify-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
            >
              <FileText size={15} /> Ver presupuesto
            </Link>
          )}
          <Link
            to={`/eventos/${evento.id}/ficha`}
            className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors"
          >
            <ClipboardList size={15} /> Ficha operativa
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Datos generales */}
          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-4">Datos generales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InsumoLinea
                  label="Café"
                  valor={`${resultado.kilosCafeTotal.toFixed(2)} kg`}
                  sub={
                    resultado.cantidadDias > 1
                      ? `${Math.round(resultado.gramosCafeTotal)} g totales · ≈ ${(resultado.kilosCafeTotal / resultado.cantidadDias).toFixed(2)} kg/día`
                      : `${Math.round(resultado.gramosCafeTotal)} g totales`
                  }
                />
                <InsumoLinea
                  label="Leche"
                  valor={`${resultado.litrosLecheTotal.toFixed(2)} L`}
                  sub={resultado.cantidadDias > 1 ? `≈ ${(resultado.litrosLecheTotal / resultado.cantidadDias).toFixed(2)} L/día` : null}
                />
                <InsumoLinea
                  label="Agua de receta"
                  valor={`${resultado.litrosAguaTotal.toFixed(2)} L · ${resultado.cantidadBidonesAgua} bidón/es x20L`}
                  sub="La que va mezclada en la bebida (americanos, etc.)"
                />
                <InsumoLinea
                  label="Agua operativa"
                  valor={`${resultado.aguaOperativaLitrosTotal.toFixed(1)} L · ${resultado.cantidadBidonesOperativos} bidón/es x20L`}
                  sub={`Caldera, dilución, limpieza — $${Math.round(resultado.costoAguaOperativa).toLocaleString('es-AR')} ya incluido en el costo`}
                />
                <InsumoLinea
                  label={`Vasos (${cotizacion.tamano_vaso})`}
                  valor={`${resultado.cantidadVasos} u.`}
                  sub={
                    resultado.cantidadDias > 1
                      ? `≈ ${Math.ceil(resultado.cajasVasos)} caja/s x50 · ≈ ${Math.ceil(resultado.cantidadVasos / resultado.cantidadDias)} u./día`
                      : `≈ ${Math.ceil(resultado.cajasVasos)} caja/s x50`
                  }
                />
                <InsumoLinea label="Sobres de azúcar" valor={`${resultado.sobresAzucarTotal} u.`} />
                <InsumoLinea label="Sobres de edulcorante" valor={`${resultado.sobresEdulcoranteTotal} u.`} />
                <InsumoLinea label="Removedores" valor={`${resultado.removedoresTotal} u.`} />
                {resultado.calcosTotal > 0 && <InsumoLinea label="Calcos" valor={`${resultado.calcosTotal} u.`} />}
                {resultado.logo3dTotal > 0 && <InsumoLinea label="Logo 3D" valor={`${resultado.logo3dTotal} u.`} />}
              </div>
              <p className="text-xs text-ink-light mt-4 pt-3 border-t border-rule">
                Calculado sobre {resultado.bebidasReales.toFixed(1)} bebidas · Nivel {cotizacion.nivel}
                {resultado.cantidadDias > 1 && (
                  <> · ≈ {(resultado.bebidasReales / resultado.cantidadDias).toFixed(1)} bebidas por día (repartido parejo entre los {resultado.cantidadDias} días)</>
                )}
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
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wide text-ink-light flex items-center gap-1.5">
                  <Truck size={13} /> Equipo y logística
                </p>
                {!formEdicionRapida && (
                  <button
                    onClick={() => setFormEdicionRapida({
                      calcos: cotizacion.calcos || false,
                      cantidad_cafes_override: cotizacion.cantidad_cafes_override ?? '',
                      cantidad_baristas: cotizacion.cantidad_baristas || 1,
                      tipo_barra: cotizacion.tipo_barra || tiposBarra[0] || '',
                      nivel: cotizacion.nivel === 'premium' ? 'Premium' : 'Esencial',
                    })}
                    className="text-xs text-wine hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>

              {!formEdicionRapida ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoItem label="Baristas" valor={`${cotizacion.cantidad_baristas || 1}`} />
                  <InfoItem label="Tipo de barra" valor={cotizacion.tipo_barra || '—'} />
                  <InfoItem label="Nivel" valor={cotizacion.nivel === 'premium' ? 'Premium' : 'Esencial'} />
                  <InfoItem label="Calcos" valor={cotizacion.calcos ? 'Sí' : 'No'} />
                  <InfoItem label="Máquina 1 grupo Faemma extra" valor={cotizacion.cantidad_maquina_1grupo_extra > 0 ? `${cotizacion.cantidad_maquina_1grupo_extra}` : 'No'} />
                  <InfoItem label="Máquina 2 grupos Casadio extra" valor={cotizacion.cantidad_maquina_2grupos_extra > 0 ? `${cotizacion.cantidad_maquina_2grupos_extra}` : 'No'} />
                  <InfoItem label="Molino Faemma 500 extra" valor={cotizacion.cantidad_molino_extra > 0 ? `${cotizacion.cantidad_molino_extra}` : 'No'} />
                  <InfoItem label="ART" valor={cotizacion.art ? `Sí — ${money(cotizacion.art_monto)}` : 'No'} />
                  <InfoItem label="Costo de flete" valor={money(cotizacion.costo_flete)} />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-ink-light">
                    Estos son los campos que suelen cambiar la semana previa al evento — no toca precio ni el resto de la cotización.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-mid mb-1">Cantidad de baristas pedidos</label>
                      <input
                        type="number" min="1" className="input"
                        value={formEdicionRapida.cantidad_baristas}
                        onChange={(e) => setFormEdicionRapida((f) => ({ ...f, cantidad_baristas: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-mid mb-1">Tipo de barra</label>
                      <select
                        className="input"
                        value={formEdicionRapida.tipo_barra}
                        onChange={(e) => setFormEdicionRapida((f) => ({ ...f, tipo_barra: e.target.value }))}
                      >
                        {tiposBarra.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-mid mb-1">Nivel</label>
                      <select
                        className="input"
                        value={formEdicionRapida.nivel}
                        onChange={(e) => setFormEdicionRapida((f) => ({ ...f, nivel: e.target.value }))}
                      >
                        <option value="Esencial">Esencial</option>
                        <option value="Premium">Premium</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-mid mb-1">Cantidad de cafés (vacío = automático)</label>
                      <input
                        type="number" min="0" className="input"
                        value={formEdicionRapida.cantidad_cafes_override}
                        onChange={(e) => setFormEdicionRapida((f) => ({ ...f, cantidad_cafes_override: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink-mid">
                    <input
                      type="checkbox" checked={formEdicionRapida.calcos}
                      onChange={(e) => setFormEdicionRapida((f) => ({ ...f, calcos: e.target.checked }))}
                    />
                    Calcos
                  </label>
                  <div className="flex gap-2">
                    <button onClick={guardarEdicionRapida} className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors">
                      Guardar
                    </button>
                    <button onClick={() => setFormEdicionRapida(null)} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Staff asignado */}
          <div className="border border-rule rounded-lg p-5 bg-paper-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-wide text-ink-light flex items-center gap-1.5">
                <UserPlus size={13} /> Staff asignado
              </p>
              <button
                onClick={() => setFormAsignacion({ staff_id: '', fecha: '', rol_evento: '' })}
                className="flex items-center gap-1 text-xs text-wine hover:underline"
              >
                <UserPlus size={13} /> Asignar
              </button>
            </div>

            {asignaciones.length === 0 && (
              <p className="text-sm text-ink-light">Todavía no asignaste a nadie a este evento.</p>
            )}

            <div className="space-y-2">
              {asignaciones.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border border-rule rounded px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {a.staff?.nombre || 'Persona eliminada'}
                      {a.rol_evento && <span className="text-ink-light font-normal"> — {a.rol_evento}</span>}
                    </p>
                    <p className="text-xs text-ink-light">
                      {a.fecha ? formatFecha(a.fecha) : `Todo el evento (${dias.length} día${dias.length > 1 ? 's' : ''})`}
                      {' · '}
                      <span className={
                        a.estado === 'confirmado' ? 'text-wine' : a.estado === 'rechazado' ? 'text-coral' : 'text-orange'
                      }>
                        {a.estado}
                      </span>
                      {a.costo_extra > 0 && (
                        <span className="text-orange"> · +{money(a.costo_extra)}{a.costo_extra_desc ? ` (${a.costo_extra_desc})` : ''}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {a.estado === 'asignado' && (
                      <button onClick={() => cambiarEstadoAsignacion(a.id, 'confirmado')} className="text-xs text-ink-light hover:text-wine">
                        Confirmar
                      </button>
                    )}
                    {a.staff?.telefono && (
                      <a
                        href={armarLinkWhatsapp(a.staff.telefono, armarMensajeAsignacion(a))}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-ink-mid hover:text-wine"
                        title="Manda por WhatsApp toda la info del evento a esta persona"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                    <button onClick={() => desasignar(a.id)} className="text-ink-light hover:text-coral">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {formAsignacion && (
              <div className="mt-4 pt-4 border-t border-rule space-y-3">
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Persona</label>
                  <select
                    className="input"
                    value={formAsignacion.staff_id}
                    onChange={(e) => setFormAsignacion((f) => ({ ...f, staff_id: e.target.value }))}
                  >
                    <option value="">Elegir…</option>
                    {staffDisponible.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} — {TIPO_LABEL[p.tipo] || p.tipo}</option>
                    ))}
                  </select>
                </div>
                {dias.length > 1 && (
                  <div>
                    <label className="block text-xs text-ink-mid mb-1">Día (dejar vacío = todo el evento)</label>
                    <select
                      className="input"
                      value={formAsignacion.fecha}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, fecha: e.target.value }))}
                    >
                      <option value="">Todo el evento</option>
                      {dias.map((d) => (
                        <option key={d.fecha} value={d.fecha}>{formatFecha(d.fecha)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Rol (opcional)</label>
                  <input
                    className="input"
                    placeholder="Barista principal, Ayudante, Flete…"
                    value={formAsignacion.rol_evento}
                    onChange={(e) => setFormAsignacion((f) => ({ ...f, rol_evento: e.target.value }))}
                  />
                </div>
                {/* Costo extra puntual — nafta, peajes, lo que no es
                    "hora trabajada" y por eso no sale de tarifa_hora.
                    Se ve reflejado directo en Facturación → Pagos a staff. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-mid mb-1">Costo extra (opcional)</label>
                    <input
                      className="input" type="number" min="0" placeholder="Nafta, peajes…"
                      value={formAsignacion.costo_extra || ''}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, costo_extra: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-mid mb-1">Concepto del extra</label>
                    <input
                      className="input" placeholder="Nafta ida y vuelta…"
                      value={formAsignacion.costo_extra_desc || ''}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, costo_extra_desc: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={asignarStaff}
                    disabled={!formAsignacion.staff_id}
                    className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
                  >
                    Asignar
                  </button>
                  <button
                    onClick={() => setFormAsignacion(null)}
                    className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
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
