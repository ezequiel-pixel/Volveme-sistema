import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generarPdfBlob, subirPdf, armarLinkWhatsapp } from '../lib/generarPdf'
import { Printer, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
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

  async function handleEnviarWhatsapp() {
    setEnviando(true)
    setEnvioError('')
    try {
      const blob = await generarPdfBlob(contenidoRef.current)
      const url = await subirPdf(blob, cotizacion.id)

      const primerDia = dias[0]
      const mensaje =
        `¡Hola ${cotizacion.clientes?.nombre || ''}! Te paso el presupuesto de Volveme para tu evento` +
        `${primerDia ? ` del ${formatFecha(primerDia.fecha)}` : ''}:\n\n${url}\n\n` +
        `Cualquier consulta quedo atento. ¡Gracias!`

      const link = armarLinkWhatsapp(cotizacion.clientes?.telefono, mensaje)
      window.open(link, '_blank')
    } catch (err) {
      setEnvioError('No se pudo generar o subir el PDF. Probá de nuevo.')
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

      <div className="presupuesto max-w-[820px] mx-auto bg-paper">
        {/* ============ PÁGINA 1 — PORTADA ============ */}
        <section className="pres-page flex flex-col">
          <div className="text-center pt-12 pb-8 px-10">
            <p className="font-display text-4xl text-wine mb-1">volveme<sup className="text-base">®</sup></p>
            <p className="text-xs tracking-[0.15em] uppercase text-ink font-medium mt-3">
              Barra de café de especialidad móvil
            </p>
          </div>

          <p className="text-center text-sm text-ink-mid px-16 leading-relaxed mb-8">
            Un servicio de cafetería puede agregar un toque de sofisticación y calidez a cualquier ocasión.
            Ya sea una boda, una fiesta o una reunión empresarial, Volveme lleva la barra a tu evento.
          </p>

          <div className="flex-1 bg-peach/60 mx-10 rounded" style={{ minHeight: '280px' }} />

          <div className="bg-peach text-center py-8 px-10 mt-8">
            <p className="text-xs tracking-[0.15em] uppercase text-ink-mid mb-2">Presupuesto para</p>
            <p className="font-display text-3xl text-wine mb-3">{cotizacion.clientes?.nombre || '—'}</p>
            <p className="text-sm font-medium text-ink-mid uppercase tracking-wide mb-3">
              {cotizacion.nombre_evento || 'Evento privado'}
            </p>
            <p className="text-sm font-medium text-ink">
              FECHA: {formatFecha(primerDia?.fecha)}
              {esMultiDia && ` al ${formatFecha(ultimoDia?.fecha)}`}
            </p>
            <p className="text-xs text-ink-light underline mt-2">*Este presupuesto tiene validez por 15 días</p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 2 — SOBRE EL EVENTO ============ */}
        <section className="pres-page flex flex-col justify-center px-14">
          <h2 className="font-display text-2xl text-center text-wine mb-3">Sobre el evento</h2>
          <p className="text-center text-sm text-ink-mid mb-10">
            Toda la información que necesitamos para que tu evento salga perfecto
          </p>

          <div className="border-t border-b border-orange/30 py-8 space-y-5">
            {dias.map((dia, i) => (
              <DatoEvento
                key={i}
                label={esMultiDia ? `Día ${i + 1}` : 'Fecha'}
                valor={`${formatFecha(dia.fecha)} · ${dia.hora_inicio?.slice(0, 5)} a ${dia.hora_fin?.slice(0, 5)}hs`}
              />
            ))}
            <DatoEvento label="Ubicación" valor={cotizacion.lugar || '—'} />
            <DatoEvento label="Cant. invitados" valor={`${cotizacion.cantidad_pax || '—'} pax`} />
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 3 — QUÉ INCLUYE + PRECIO ============ */}
        <section className="pres-page flex flex-col justify-center px-14">
          <h2 className="font-display text-2xl text-center text-wine mb-8">¿Qué incluye nuestro servicio?</h2>

          <ul className="space-y-3 mb-10">
            <Incluye texto={`${cotizacion.cantidad_baristas || 1} Barista${cotizacion.cantidad_baristas > 1 ? 's' : ''}`} />
            <Incluye texto="Bebidas calientes (espresso, americano, latte, flat white y capuccino)" />
            <Incluye texto="Leche entera, de avena y almendras" />
            {cotizacion.logo_3d && <Incluye texto="Logo impreso en el arte latte" />}
            {cotizacion.calcos && <Incluye texto={`Calcos en los vasos de ${cotizacion.tamano_vaso}`} />}
            <Incluye texto="Azúcar, edulcorante, servilletas y removedores" />
            <Incluye texto="Vasos de polipapel" />
            <Incluye texto="Transporte, montaje y desmontaje" />
          </ul>

          <div className="bg-peach rounded flex divide-x divide-orange/20 mb-8">
            <div className="flex-1 text-center py-6">
              <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Invitados</p>
              <p className="font-display text-3xl text-wine">{cotizacion.cantidad_pax || '—'}</p>
              <p className="text-xs text-ink-light">Personas</p>
            </div>
            <div className="flex-1 text-center py-6">
              <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Precio</p>
              <p className="font-display text-3xl text-wine">{money(cotizacion.precio_final)}</p>
              <p className="text-xs text-ink-light">Precio final, IVA incluido</p>
            </div>
          </div>

          <p className="text-center text-xs text-ink-light underline mb-8">*Este presupuesto tiene validez por 15 días</p>

          <div className="border-t border-orange/30 pt-6">
            <h3 className="font-display text-lg text-center text-wine mb-4">Condiciones</h3>
            <p className="text-sm text-ink-mid text-center leading-relaxed mb-2">
              <strong className="text-ink">Reserva anticipada</strong> con el 50% y saldo restante 24hs antes del evento.
            </p>
            <p className="text-sm text-ink-mid text-center leading-relaxed mb-2">
              Punto eléctrico para el equipamiento de 10A.
            </p>
            <p className="text-sm text-ink-mid text-center leading-relaxed">
              Informar si el acceso al lugar del evento presenta obstáculos o desniveles para la instalación del equipamiento.
            </p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 4 — CIERRE ============ */}
        <section className="pres-page flex flex-col justify-center items-center bg-peach">
          <p className="font-display text-3xl text-wine text-center leading-tight px-16">
            volveme<sup className="text-lg">®</sup> la barra de café<br />para tu próximo <em className="font-accent text-orange not-italic">evento</em>.
          </p>
          <div className="mt-16">
            <Footer />
          </div>
        </section>
      </div>
    </div>
  )
}

function DatoEvento({ label, valor }) {
  return (
    <div className="text-center">
      <span className="text-xs uppercase tracking-wide text-ink-light">{label}: </span>
      <span className="text-sm font-medium text-ink">{valor}</span>
    </div>
  )
}

function Incluye({ texto }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-mid">
      <span className="text-orange mt-0.5">✓</span>
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
