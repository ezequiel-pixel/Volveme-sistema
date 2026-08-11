import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generarPdfBlob, subirPdf, armarLinkWhatsapp } from '../lib/generarPdf'
import {
  Printer, ArrowLeft, MessageCircle, Loader2,
  Coffee, Heart, Leaf, Snowflake,
} from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function calcularDuracion(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return '—'
  const [hI, mI] = horaInicio.split(':').map(Number)
  const [hF, mF] = horaFin.split(':').map(Number)
  let minutos = (hF * 60 + mF) - (hI * 60 + mI)
  if (minutos < 0) minutos += 24 * 60 // por si cruza medianoche
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas}hs` : `${horas}h ${resto}min`
}

function slug(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function Presupuesto() {
  const { id } = useParams()
  const [cotizacion, setCotizacion] = useState(null)
  const [dias, setDias] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [envioError, setEnvioError] = useState('')
  const contenidoRef = useRef(null)

  useEffect(() => {
    async function cargar() {
      const { data: cot } = await supabase
        .from('cotizaciones')
        .select('*, clientes(nombre, telefono)')
        .eq('id', id)
        .single()
      const { data: diasData } = await supabase
        .from('cotizacion_dias')
        .select('*')
        .eq('cotizacion_id', id)
        .order('orden')

      setCotizacion(cot)
      setDias(diasData || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  useEffect(() => {
    if (!cotizacion) return
    const primerDia = dias[0]
    const nombreArchivo = [
      'Presupuesto Volveme',
      cotizacion.clientes?.nombre,
      primerDia ? formatFecha(primerDia.fecha).replaceAll('/', '-') : null,
      cotizacion.cantidad_pax ? `${cotizacion.cantidad_pax}pax` : null,
    ].filter(Boolean).join(' - ')
    document.title = nombreArchivo
    return () => { document.title = 'Volveme' }
  }, [cotizacion, dias])

  async function handleEnviarWhatsapp() {
    setEnviando(true)
    setEnvioError('')
    try {
      const blob = await generarPdfBlob(contenidoRef.current)
      const primerDia = dias[0]
      const nombreArchivo = [
        'presupuesto-volveme',
        slug(cotizacion.clientes?.nombre),
        primerDia?.fecha,
        cotizacion.cantidad_pax ? `${cotizacion.cantidad_pax}pax` : null,
      ].filter(Boolean).join('-') + '.pdf'

      const url = await subirPdf(blob, nombreArchivo)

      const mensaje =
        `¡Hola ${cotizacion.clientes?.nombre || ''}! Te paso el presupuesto de Volveme para tu evento` +
        `${primerDia ? ` del ${formatFecha(primerDia.fecha)}` : ''}:\n\n${url}\n\n` +
        `Cualquier consulta quedo atento. ¡Gracias!`

      const link = armarLinkWhatsapp(cotizacion.clientes?.telefono, mensaje)
      window.open(link, '_blank')
    } catch (err) {
      setEnvioError('No se pudo generar o subir el PDF. Probá de nuevo.')
      console.error(err)
    }
    setEnviando(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-light text-sm">Cargando…</div>
  }

  if (!cotizacion) {
    return <div className="min-h-screen flex items-center justify-center text-ink-light text-sm">No se encontró la cotización.</div>
  }

  const esMultiDia = dias.length > 1
  const primerDia = dias[0]
  const ultimoDia = dias[dias.length - 1]

  return (
    <div className="bg-ink-light/10">
      {/* Barra de acciones — no se imprime */}
      <div className="print:hidden sticky top-0 bg-paper border-b border-rule px-6 py-3 flex items-center justify-between z-10">
        <Link to="/cotizaciones" className="flex items-center gap-1.5 text-sm text-ink-mid hover:text-ink">
          <ArrowLeft size={15} /> Volver a Cotizaciones
        </Link>
        <div className="flex items-center gap-3">
          {envioError && <span className="text-xs text-coral">{envioError}</span>}
          {!cotizacion.clientes?.telefono && (
            <span className="text-xs text-ink-light">Sin teléfono cargado para este cliente</span>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
          >
            <Printer size={15} /> Imprimir / Guardar
          </button>
          <button
            onClick={handleEnviarWhatsapp}
            disabled={enviando}
            className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
            {enviando ? 'Generando PDF…' : 'Enviar por WhatsApp'}
          </button>
        </div>
      </div>

      <div ref={contenidoRef} className="presupuesto max-w-[820px] mx-auto bg-paper">
        {/* ============ PÁGINA 1 — PORTADA ============ */}
        <section className="pres-page flex flex-col bg-paper">
          <div className="text-center pt-14 pb-6 px-10">
            <p className="font-display text-5xl text-wine mb-2">volveme<sup className="text-lg align-super">®</sup></p>
            <p className="text-xs tracking-[0.2em] uppercase text-ink font-semibold">
              Barra de café de especialidad móvil
            </p>
          </div>

          <p className="text-center text-sm text-ink-mid px-16 leading-relaxed mb-6">
            Un servicio de cafetería puede agregar un toque de sofisticación y calidez a cualquier ocasión.
            Ya sea una boda, una fiesta o una reunión empresarial, Volveme lleva la barra a tu evento.
          </p>

          <div className="mx-10 rounded-sm overflow-hidden" style={{ height: '320px' }}>
            <img src="/images/portada.jpg" alt="" className="w-full h-full object-cover block" />
          </div>

          <div className="bg-peach text-center py-8 px-10 mt-6 flex-1 flex flex-col justify-center">
            <p className="text-xs tracking-[0.2em] uppercase text-ink-mid mb-3">Presupuesto para</p>
            <p className="font-display text-4xl text-wine mb-2 leading-tight">{cotizacion.clientes?.nombre || '—'}</p>
            <p className="text-sm font-semibold text-ink-mid uppercase tracking-wide mb-4">
              {cotizacion.nombre_evento || 'Evento privado'}
            </p>
            <p className="text-sm font-semibold text-ink">
              FECHA: {formatFecha(primerDia?.fecha)}
              {esMultiDia && ` al ${formatFecha(ultimoDia?.fecha)}`}
            </p>
            <p className="text-xs text-ink-light underline mt-3">*Este presupuesto tiene validez por 15 días</p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 2 — SOBRE EL EVENTO ============ */}
        <section className="pres-page flex flex-col bg-peach">
          <div className="text-center pt-16 px-14 mb-8">
            <h2 className="font-display text-3xl text-wine mb-3">Sobre el evento</h2>
            <p className="text-sm text-ink-mid">
              Todo la información que necesitamos para que tu evento sea <strong className="text-ink">único</strong>
            </p>
          </div>

          <DashedRule />

          <div className="py-10 space-y-6">
            {dias.map((dia, i) => (
              <DatoEvento
                key={`fecha-${i}`}
                label={esMultiDia ? `Fecha (día ${i + 1})` : 'Fecha'}
                valor={formatFecha(dia.fecha)}
              />
            ))}
            <DatoEvento label="Ubicación" valor={cotizacion.lugar || '—'} />
            {dias.map((dia, i) => (
              <DatoEvento
                key={`horario-${i}`}
                label={esMultiDia ? `Horario (día ${i + 1})` : 'Horario'}
                valor={`${dia.hora_inicio?.slice(0, 5)} a ${dia.hora_fin?.slice(0, 5)}hs`}
              />
            ))}
            <DatoEvento label="Cant. invitados" valor={`${cotizacion.cantidad_pax || '—'} pax`} />
            <DatoEvento
              label="Servicio"
              valor={`${cotizacion.cantidad_cafes_override || cotizacion.cantidad_pax || '—'} cafés`}
            />
            {dias.map((dia, i) => (
              <DatoEvento
                key={`duracion-${i}`}
                label={esMultiDia ? `Duración del servicio (día ${i + 1})` : 'Duración del servicio'}
                valor={calcularDuracion(dia.hora_inicio?.slice(0, 5), dia.hora_fin?.slice(0, 5))}
              />
            ))}
          </div>

          <DashedRule />

          <div className="relative flex-1 mx-10 mt-8 rounded-sm overflow-hidden" style={{ minHeight: '260px' }}>
            <img src="/images/evento-detalle.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <p className="absolute bottom-4 right-5 font-display text-xl text-paper drop-shadow">
              volveme<sup className="text-xs">®</sup>
            </p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 3 — CAFÉ ESPECIAL ============ */}
        <section className="pres-page flex flex-col justify-center px-14 bg-paper">
          <h2 className="font-display text-3xl text-center text-wine mb-4">Café especial</h2>
          <p className="text-center text-sm text-ink-mid px-6 mb-1">
            En <strong className="text-ink">Volveme</strong> seleccionamos el café para cada evento, buscando el perfil
            que mejor se adapta a <strong className="text-ink">la experiencia</strong> que querés crear.
          </p>
          <p className="text-center text-sm text-ink-mid px-6 mb-12">
            Trabajamos con granos seleccionados de origen, tostados cuidadosamente para destacar sus notas y
            ofrecer <strong className="text-ink">una bebida equilibrada y memorable</strong>.
          </p>

          <div className="grid grid-cols-2 gap-x-10 gap-y-12 mb-16">
            <FeatureIcono icon={Coffee} titulo="Café de especialidad" texto="Seleccionamos el café ideal para tu evento." />
            <FeatureIcono icon={Heart} titulo="Experiencia y calidad" texto="Baristas profesionales, hospitalidad y servicio." />
            <FeatureIcono icon={Snowflake} titulo="Bebidas para cada momento" texto="Calientes, frías y opciones especiales." />
            <FeatureIcono icon={Leaf} titulo="Alternativas vegetales" texto="Leche de avena y almendras para todos tus invitados." />
          </div>

          <p className="text-center font-display text-2xl text-wine mt-auto">volveme<sup className="text-sm">®</sup></p>
        </section>

        {/* ============ PÁGINA 4 — NUESTRAS PREPARACIONES ============ */}
        <section className="pres-page flex flex-col justify-center px-14 bg-peach relative overflow-hidden">
          <Watermark texto="volveme" />
          <h2 className="relative font-display text-3xl text-center text-wine mb-10">Nuestras preparaciones</h2>

          <div className="relative space-y-8">
            <MenuSeccion titulo="Sin leche" items={[
              { nombre: 'Espresso', desc: 'Corto e intenso' },
              { nombre: 'Americano', desc: 'Doble espresso con agua — más liviano' },
            ]} />
            <MenuSeccion titulo="Con leche" items={[
              { nombre: 'Latte', desc: 'Espresso con mucha leche — suave' },
              { nombre: 'Flat White', desc: 'Doble espresso con leche — se destaca el café' },
              { nombre: 'Capuccino', desc: 'Espresso con leche — equilibrado y cremoso' },
            ]} />
            <MenuSeccion titulo="Fríos" items={[
              { nombre: 'Ice Latte', desc: 'Espresso con leche — fresco y equilibrado' },
              { nombre: 'Ice Coffee', desc: 'Doble espresso con agua — fresco y liviano' },
              { nombre: 'Espresso Tonic', desc: 'Espresso con tónica — fresco y burbujeante' },
            ]} />
            <MenuSeccion titulo="Especiales" items={[
              { nombre: 'Té Rojo', desc: 'Hong Mao Feng — Pei Chen' },
              { nombre: 'Chocolatada', desc: 'Salsa de chocolate gourmet semi amargo con leche' },
            ]} />
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 5 — QUÉ INCLUYE + PRECIO ============ */}
        <section className="pres-page flex flex-col justify-center px-14 bg-paper relative overflow-hidden">
          <Watermark texto="volveme" />
          <h2 className="relative font-display text-3xl text-center text-wine mb-10">¿Qué incluye nuestro servicio?</h2>

          <ul className="relative space-y-3 mb-10">
            <Incluye texto={`${cotizacion.cantidad_baristas || 1} Barista${cotizacion.cantidad_baristas > 1 ? 's' : ''}`} />
            <Incluye texto="Bebidas calientes (espresso, americano, latte, flat white y capuccino)" />
            <Incluye texto="Leche entera, de avena y almendras" />
            {cotizacion.logo_3d && <Incluye texto="Logo impreso en el arte latte (algunos cafés)." />}
            {cotizacion.calcos && <Incluye texto={`Calcos en los vasos de ${cotizacion.tamano_vaso}`} />}
            <Incluye texto="Azúcar, edulcorante, servilletas y removedores" />
            <Incluye texto="Vasos de polipapel" />
            <Incluye texto="Transporte, montaje y desmontaje" />
          </ul>

          <div className="bg-peach rounded-sm flex divide-x divide-orange/25 mb-6 py-2">
            <div className="flex-1 text-center py-6">
              <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Invitados</p>
              <p className="font-display text-4xl text-wine">{cotizacion.cantidad_pax || '—'}</p>
              <p className="text-xs text-ink-light">Personas</p>
            </div>
            <div className="flex-1 text-center py-6">
              <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Precio</p>
              <p className="font-display text-4xl text-wine">{money(cotizacion.precio_final)}</p>
              <p className="text-xs text-ink-light">Precio final, IVA incluido</p>
            </div>
          </div>

          <p className="text-center text-xs text-ink-light underline mb-8">*Este presupuesto tiene validez por 15 días</p>

          <DashedRule />

          <div className="pt-8">
            <h3 className="font-display text-2xl text-center text-wine mb-5">Condiciones</h3>
            <p className="text-sm text-ink-mid text-center leading-relaxed mb-3">
              <strong className="text-ink">Reserva anticipada</strong> con el 50% y saldo restante 24hs antes del evento.
            </p>
            <p className="text-sm text-ink-mid text-center leading-relaxed mb-3">
              Punto eléctrico para el equipamiento de <strong className="text-ink">10A.</strong>
            </p>
            <p className="text-sm text-ink-mid text-center leading-relaxed">
              Informar si el acceso al lugar del evento presenta obstáculos o desniveles para la instalación del equipamiento.
            </p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 6 — ASÍ VIVIMOS NUESTROS EVENTOS ============ */}
        <section className="pres-page flex flex-col justify-center px-10 bg-paper">
          <h2 className="font-display text-3xl text-center text-wine mb-8">Así vivimos nuestros eventos</h2>
          <div className="grid grid-cols-2 gap-4 mb-10">
            {['galeria-1', 'galeria-2', 'galeria-3', 'galeria-4', 'galeria-5', 'galeria-6'].map((img) => (
              <img
                key={img}
                src={`/images/${img}.jpg`}
                alt=""
                className="w-full object-cover rounded-sm"
                style={{ height: '190px' }}
              />
            ))}
          </div>
          <p className="text-center font-display text-2xl text-wine mt-auto mb-4">volveme<sup className="text-sm">®</sup></p>
        </section>

        {/* ============ PÁGINA 7 — CIERRE ============ */}
        <section className="pres-page flex flex-col bg-peach">
          <p className="text-center text-xs text-ink-light underline pt-8 pb-4">*Este presupuesto tiene validez por 15 días</p>
          <div className="flex-1 flex items-center px-16">
            <p className="font-display text-4xl text-wine leading-tight">
              volveme<sup className="text-xl">®</sup> la barra de café<br />para tu próximo{' '}
              <em className="font-accent text-orange not-italic">evento</em>.
            </p>
          </div>
          <Footer />
        </section>
      </div>
    </div>
  )
}

function Watermark({ texto }) {
  return (
    <p
      className="absolute left-1/2 top-16 -translate-x-1/2 font-display whitespace-nowrap text-wine/10 select-none pointer-events-none"
      style={{ fontSize: '4.5rem' }}
    >
      {texto}
    </p>
  )
}

function DashedRule() {
  return <div className="mx-10 border-t-2 border-dashed border-orange/40" />
}

function FeatureIcono({ icon: Icon, titulo, texto }) {
  return (
    <div className="text-center">
      <Icon size={28} strokeWidth={1.5} className="text-orange mx-auto mb-3" />
      <p className="font-semibold text-sm text-ink mb-1">{titulo}</p>
      <p className="text-xs text-ink-mid leading-snug">{texto}</p>
    </div>
  )
}

function MenuSeccion({ titulo, items }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 border-t border-dashed border-orange/40" />
        <p className="text-xs uppercase tracking-[0.2em] text-ink font-semibold">{titulo}</p>
        <span className="flex-1 border-t border-dashed border-orange/40" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.nombre} className="text-center">
            <p className="text-sm font-semibold text-ink">{it.nombre}</p>
            <p className="text-[11px] text-ink-mid leading-snug">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DatoEvento({ label, valor }) {
  return (
    <div className="text-center">
      <span className="text-xs uppercase tracking-wide text-ink-mid">{label}: </span>
      <span className="text-sm font-semibold text-ink">{valor}</span>
    </div>
  )
}

function Incluye({ texto }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-mid">
      <span className="text-orange mt-0.5 font-bold">✓</span>
      {texto}
    </li>
  )
}

function Footer() {
  return (
    <div className="text-center text-[11px] text-ink-light py-6 mt-auto space-x-3">
      <span>www.volveme.com</span>
      <span>·</span>
      <span>volveme.cafe</span>
      <span>·</span>
      <span>info@volveme.com</span>
      <span>·</span>
      <span>+54 9 11 5841-6365</span>
    </div>
  )
}
