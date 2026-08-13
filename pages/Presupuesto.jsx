import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generarPdfBlob, generarPdfMobileBlob } from '../lib/generarPdf'
import {
  Printer, ArrowLeft, Loader2, Smartphone,
  Coffee, Heart, Leaf, Snowflake, Milk, Droplet, Candy, CheckCircle2,
  CalendarDays, MapPin, Clock, Users, Timer, Cookie,
} from 'lucide-react'

const money = (n) =>
  // redondeo siempre hacia arriba, a la centena más cercana — nunca
  // centavos ni números "raros" en la cotización o el PDF
  (Math.ceil((n || 0) / 100) * 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

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
  const [pasteleriaItems, setPasteleriaItems] = useState([])
  const [cafeDelMes, setCafeDelMes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviandoMobile, setEnviandoMobile] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [envioError, setEnvioError] = useState('')
  const contenidoRef = useRef(null)
  const mobileVistaRef = useRef(null)

  // Controla en JS (no en CSS) cuál de las dos vistas se ve en pantalla —
  // la réplica A4 (.presupuesto) o la vista angosta (.mobile-vista).
  // Las DOS quedan siempre montadas en el DOM (la que no se ve, se manda
  // fuera de pantalla con estilos inline, nunca con display:none, para
  // que html2canvas siempre pueda capturar cualquiera de las dos sin
  // depender de que el navegador vuelva a evaluar un media query CSS en
  // medio de la captura — eso es lo que antes generaba capturas mezcladas
  // o cortadas según desde qué pantalla se generara el PDF.
  const [esMobile, setEsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = (e) => setEsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const estiloOculto = { position: 'fixed', top: 0, left: '-9999px' }

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

      if (cot?.lleva_pasteleria) {
        const { data: itemsData } = await supabase
          .from('cotizacion_pasteleria_items')
          .select('*')
          .eq('cotizacion_id', id)
          .order('orden')
        setPasteleriaItems(itemsData || [])
      }

      // Ficha técnica del café del mes — se carga una sola vez desde el
      // módulo "Café del mes" (no se vuelve a cargar por cada presupuesto).
      // Si todavía no hay ninguno activo, la página simplemente no se muestra.
      const { data: cafeData } = await supabase
        .from('cafe_del_mes')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setCafeDelMes(cafeData || null)

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

  /** Dispara la descarga de un blob ya generado. */
  function descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** PDF completo (8 hojas A4) — genera con html2canvas + jsPDF (no
   * window.print(), que en mobile sale con páginas cortadas y sin
   * color) y lo descarga directo al dispositivo. */
  async function handleDescargarDesktop() {
    setDescargando(true)
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
      descargarBlob(blob, nombreArchivo)
    } catch (err) {
      setEnvioError('No se pudo generar el PDF. Probá de nuevo.')
      console.error(err)
    }
    setDescargando(false)
  }

  /** Igual que handleDescargarDesktop, pero genera la versión angosta
   * tipo celular (una sola tira, con el mismo diseño de marca) en vez de
   * las 8 hojas A4. Funciona aunque quien lo genera esté en la
   * computadora — la vista mobile queda siempre lista para capturar
   * (ver esMobile / estiloOculto más arriba). */
  async function handleDescargarMobile() {
    setEnviandoMobile(true)
    setEnvioError('')
    try {
      const blob = await generarPdfMobileBlob(mobileVistaRef.current)
      const primerDia = dias[0]
      const nombreArchivo = [
        'presupuesto-volveme-mobile',
        slug(cotizacion.clientes?.nombre),
        primerDia?.fecha,
        cotizacion.cantidad_pax ? `${cotizacion.cantidad_pax}pax` : null,
      ].filter(Boolean).join('-') + '.pdf'
      descargarBlob(blob, nombreArchivo)
    } catch (err) {
      setEnvioError('No se pudo generar la versión mobile. Probá de nuevo.')
      console.error(err)
    }
    setEnviandoMobile(false)
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
      <div className="print:hidden sticky top-0 bg-paper border-b border-rule px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 z-10">
        <Link to="/cotizaciones" className="flex items-center gap-1.5 text-sm text-ink-mid hover:text-ink flex-shrink-0">
          <ArrowLeft size={15} /> <span className="hidden sm:inline">Volver a Cotizaciones</span>
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {envioError && <span className="text-xs text-coral w-full sm:w-auto text-right">{envioError}</span>}
          <button
            onClick={handleDescargarDesktop}
            disabled={descargando}
            className="flex items-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-3 sm:px-4 py-2 hover:border-ink hover:text-ink transition-colors disabled:opacity-50"
          >
            {descargando ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            <span>{descargando ? 'Generando…' : 'Descargar (Desktop)'}</span>
          </button>
          <button
            onClick={handleDescargarMobile}
            disabled={enviandoMobile}
            className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-3 sm:px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
          >
            {enviandoMobile ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
            <span>{enviandoMobile ? 'Generando…' : 'Descargar (Mobile)'}</span>
          </button>
        </div>
      </div>

      {/* ============ VISTA MOBILE — versión angosta con el mismo diseño de marca ============
          No es un resumen de texto aparte: reusa la misma paleta, tipografía y
          fotos que el PDF de escritorio, apiladas en una sola columna angosta.
          Sirve para leer cómodo en el celular Y es lo que se captura para el
          botón "Versión mobile". El PDF real de 8 hojas sigue saliendo del
          bloque de abajo (.presupuesto) — acá abajo no se toca nada de eso. */}
      <div
        ref={mobileVistaRef}
        className="mobile-vista print:hidden bg-paper overflow-hidden"
        style={esMobile ? { width: '100%' } : { ...estiloOculto, width: 420 }}
      >
        {/* Portada — imagen completa sin recortar, ancho completo. Nada
            de trucos de CSS para "cover": el motor que genera el PDF
            (html2canvas) no siempre los interpreta bien, y por ahí
            terminaba rompiendo o estirando la imagen. Así es imposible
            que salga mal, aunque no sea un recorte perfecto. */}
        <img src="/images/mobile-1.jpg" alt="" className="w-full h-auto block" />
        <div className="text-center pt-8 pb-6 px-6 bg-paper">
          <p className="font-display text-4xl text-wine mb-1">volveme<sup className="text-sm align-super">®</sup></p>
          <p className="text-[11px] tracking-[0.15em] uppercase text-ink font-semibold">
            Barra de café de especialidad móvil
          </p>
        </div>
        <div className="bg-peach px-6 py-10 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-mid mb-2">Presupuesto para</p>
          <p className="font-display text-4xl text-wine mb-2 leading-tight">{cotizacion.clientes?.nombre || '—'}</p>
          <p className="text-sm font-bold text-ink uppercase tracking-wide mb-3">
            {cotizacion.nombre_evento || 'Evento privado'}
          </p>
          {primerDia && (
            <p className="text-sm font-bold text-ink">FECHA: {formatFecha(primerDia.fecha)}</p>
          )}
          <p className="text-xs text-ink-light underline mt-3">*Este presupuesto tiene validez por 15 días</p>
        </div>

        {/* Sobre el evento */}
        <div className="bg-peach px-6 pt-10 pb-8">
          <p className="font-display text-3xl text-wine text-center mb-2">Sobre el evento</p>
          <p className="text-sm text-ink-mid text-center mb-6">
            Toda la información que necesitamos para que tu evento sea <strong className="text-ink">único</strong>
          </p>
          <div className="bg-paper rounded-lg p-5 space-y-4">
            {dias.map((dia, i) => (
              <MobileDato
                key={`f-${i}`}
                icon={CalendarDays}
                color="#3f6bff"
                label={esMultiDia ? `Fecha (día ${i + 1})` : 'Fecha'}
                valor={formatFecha(dia.fecha)}
              />
            ))}
            <MobileDato icon={MapPin} color="#fd926f" label="Ubicación" valor={cotizacion.lugar || '—'} />
            {dias.map((dia, i) => (
              dia.hora_inicio && dia.hora_fin ? (
                <MobileDato
                  key={`h-${i}`}
                  icon={Clock}
                  color="#b7ddff"
                  label={esMultiDia ? `Horario (día ${i + 1})` : 'Horario'}
                  valor={`${dia.hora_inicio.slice(0, 5)} a ${dia.hora_fin.slice(0, 5)}hs`}
                />
              ) : null
            ))}
            <MobileDato icon={Users} color="#8c5a45" label="Invitados" valor={`${cotizacion.cantidad_pax || '—'} pax`} />
          </div>
        </div>

        {/* Café de especialidad */}
        <div className="bg-peach px-6 pt-10 pb-10">
          <p className="font-display text-3xl text-wine text-center mb-3">Café de especialidad</p>
          <p className="text-sm text-ink-mid text-center leading-relaxed mb-6">
            Café evaluado por catadores certificados con <strong className="text-ink">80 puntos o más sobre 100</strong>,
            con trazabilidad completa de origen. Este es el que estamos sirviendo hoy en barra.
          </p>

          {cafeDelMes && (
            <div className="bg-paper rounded-lg px-6 py-6 mb-8 text-center">
              <p className="font-display text-2xl text-wine leading-tight mb-1">{cafeDelMes.nombre_cafe}</p>
              <p className="text-xs text-ink-light mb-4">
                {[cafeDelMes.variedad, cafeDelMes.beneficio, cafeDelMes.altura ? `${cafeDelMes.altura} msnm` : null]
                  .filter(Boolean).join(' · ')}
              </p>
              {cafeDelMes.puntaje && (
                <p className="mb-4">
                  <span className="inline-block bg-wine text-paper text-xs font-bold uppercase tracking-wide rounded-full px-4 py-1.5">
                    {cafeDelMes.puntaje} puntos
                  </span>
                </p>
              )}
              {cafeDelMes.notas_sabor_tags?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {cafeDelMes.notas_sabor_tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-xs font-medium text-wine border border-orange/30 rounded-full px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-6">
            <FeatureIconoChico icon={Coffee} color="#3f6bff" titulo="Café de especialidad" texto="Seleccionamos el café ideal para tu evento." />
            <FeatureIconoChico icon={Heart} color="#fd926f" titulo="Experiencia y calidad" texto="Baristas profesionales, hospitalidad y servicio." />
            <FeatureIconoChico icon={Snowflake} color="#b7ddff" titulo="Bebidas para cada momento" texto="Calientes, frías y opciones especiales." />
            <FeatureIconoChico icon={Leaf} color="#8c5a45" titulo="Alternativas vegetales" texto="Leche de avena y almendras para todos tus invitados." />
          </div>

          <p className="font-display text-lg text-wine text-center mt-8">
            Probado en nuestra barra. <em className="font-accent text-orange not-italic">Listo para tu evento.</em>
          </p>
        </div>

        {/* Qué incluye */}
        <div className="bg-paper px-6 pt-10 pb-8">
          <p className="font-display text-3xl text-wine text-center mb-6">¿Qué incluye nuestro servicio?</p>
          <ul className="space-y-3 max-w-sm mx-auto">
            <MobileIncluye texto={`${cotizacion.cantidad_baristas || 1} Barista${cotizacion.cantidad_baristas > 1 ? 's' : ''}`} />
            <MobileIncluye texto="Bebidas calientes (espresso, americano, latte, flat white y capuccino)" />
            <MobileIncluye texto="Leche entera, de avena y almendras" />
            {cotizacion.logo_3d && <MobileIncluye texto="Logo impreso en el arte latte (algunos cafés)" />}
            {cotizacion.calcos && <MobileIncluye texto={`Calcos en los vasos de ${cotizacion.tamano_vaso}`} />}
            <MobileIncluye texto="Azúcar, edulcorante, servilletas y removedores" />
            <MobileIncluye texto="Vasos de polipapel" />
            <MobileIncluye texto="Transporte, montaje y desmontaje" />
          </ul>
        </div>

        {/* Pastelería */}
        {cotizacion.lleva_pasteleria && pasteleriaItems.length > 0 && (
          <div className="bg-peach px-6 pt-10 pb-8">
            <p className="font-display text-3xl text-wine text-center mb-6">Anexo — Pastelería</p>
            <ul className="space-y-3 bg-paper rounded-lg p-5">
              {pasteleriaItems.map((it) => {
                const precioUnitario = it.precio_proveedor * (1 + (cotizacion.pasteleria_markup_pct || 0))
                return (
                  <li key={it.id} className="flex items-center justify-between text-sm border-b border-rule pb-2.5 last:border-0 last:pb-0">
                    <span className="text-ink-mid">{it.nombre_producto} <span className="text-ink-light">× {it.cantidad}</span></span>
                    <span className="font-bold text-ink">{money(precioUnitario * it.cantidad)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Precio + condiciones */}
        <div className="bg-peach px-6 pt-10 pb-10">
          <div className="bg-wine rounded-lg p-7 text-center mb-8">
            <p className="text-[11px] uppercase tracking-wide text-peach/70 mb-2">Precio</p>
            {cotizacion.lleva_pasteleria && pasteleriaItems.length > 0 ? (
              <p className="text-sm text-peach/80 mb-2">
                Café {money(cotizacion.precio_neto)} + Pastelería {money(cotizacion.pasteleria_subtotal)}
              </p>
            ) : null}
            <p className="font-display text-4xl text-paper mb-1 leading-none">
              {money(cotizacion.lleva_pasteleria ? cotizacion.precio_final : cotizacion.precio_neto)}
            </p>
            <p className="text-sm text-peach/70">+ IVA</p>
          </div>

          <p className="font-display text-2xl text-wine text-center mb-4">Condiciones</p>
          <div className="space-y-2.5 max-w-sm mx-auto">
            <p className="text-sm text-ink-mid leading-relaxed text-center">
              <strong className="text-ink">Reserva anticipada</strong> con el 50% y saldo restante 24hs antes del evento.
            </p>
            <p className="text-sm text-ink-mid leading-relaxed text-center">
              Punto eléctrico para el equipamiento de <strong className="text-ink">10A.</strong>
            </p>
            <p className="text-sm text-ink-mid leading-relaxed text-center">
              Informar si el acceso al lugar del evento presenta obstáculos o desniveles.
            </p>
          </div>
        </div>

        {/* Así vivimos nuestros eventos — collage simple en 2 columnas.
            Cada foto se muestra completa, a su tamaño natural (ancho
            100%, alto automático), sin recortar ni forzar ningún
            tamaño — así queda garantizado que ninguna salga estirada
            ni rota al generar el PDF. */}
        <div className="bg-paper px-6 pt-10 pb-10">
          <p className="font-display text-3xl text-wine text-center mb-6">Así vivimos nuestros eventos</p>
          <div className="grid grid-cols-2 gap-2">
            {['galeria-1', 'galeria-7', 'galeria-4', 'galeria-2', 'galeria-3', 'galeria-6'].map((img) => (
              <img
                key={img}
                src={`/images/${img}.jpg`}
                alt=""
                className="w-full h-auto block rounded-sm"
              />
            ))}
            <img
              src="/images/galeria-5.jpg"
              alt=""
              className="w-full h-auto block rounded-sm col-span-2"
            />
          </div>
        </div>

        {/* Cierre */}
        <div className="bg-wine px-6 pt-14 pb-12 text-center">
          <p className="font-display text-2xl text-paper leading-snug mb-6">
            volveme<sup className="text-sm align-super">®</sup> la barra de café<br />
            para tu próximo <em className="font-accent text-orange not-italic">evento</em>.
          </p>
          <p className="text-xs text-paper/60 underline mb-6">*Este presupuesto tiene validez por 15 días</p>
          <div className="text-xs text-paper/70 space-y-1">
            <p>www.volveme.com · volveme.cafe</p>
            <p>info@volveme.com · +54 9 11 5841-6365</p>
          </div>
        </div>
      </div>

      <div
        ref={contenidoRef}
        className="presupuesto max-w-[820px] mx-auto bg-paper"
        style={esMobile ? estiloOculto : undefined}
      >
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

          <div className="bg-peach text-center py-10 px-10 mt-6 flex-1 flex flex-col justify-center">
            <p className="text-sm tracking-[0.25em] uppercase text-ink-mid mb-4">Presupuesto para</p>
            <p className="font-display text-6xl text-wine mb-3 leading-tight">{cotizacion.clientes?.nombre || '—'}</p>
            <p className="text-base font-bold text-ink-mid uppercase tracking-wide mb-5">
              {cotizacion.nombre_evento || 'Evento privado'}
            </p>
            <p className="text-lg font-bold text-ink">
              FECHA: {formatFecha(primerDia?.fecha)}
              {esMultiDia && ` al ${formatFecha(ultimoDia?.fecha)}`}
            </p>
            <p className="text-xs text-ink-light underline mt-4">*Este presupuesto tiene validez por 15 días</p>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 2 — SOBRE EL EVENTO ============ */}
        <section className="pres-page flex flex-col bg-peach">
          <div className="text-center pt-16 px-14 mb-8">
            <h2 className="font-display text-5xl text-wine mb-4">Sobre el evento</h2>
            <p className="text-base text-ink-mid">
              Todo la información que necesitamos para que tu evento sea <strong className="text-ink">único</strong>
            </p>
          </div>

          <DashedRule />

          <div className="py-10 space-y-7 max-w-[440px] mx-auto w-full">
            {dias.map((dia, i) => (
              <DatoEvento
                key={`fecha-${i}`}
                icon={CalendarDays}
                color="#3f6bff"
                label={esMultiDia ? `Fecha (día ${i + 1})` : 'Fecha'}
                valor={formatFecha(dia.fecha)}
              />
            ))}
            <DatoEvento icon={MapPin} color="#fd926f" label="Ubicación" valor={cotizacion.lugar || '—'} />
            {dias.map((dia, i) => (
              dia.hora_inicio && dia.hora_fin ? (
                <DatoEvento
                  key={`horario-${i}`}
                  icon={Clock}
                  color="#b7ddff"
                  label={esMultiDia ? `Horario (día ${i + 1})` : 'Horario'}
                  valor={`${dia.hora_inicio.slice(0, 5)} a ${dia.hora_fin.slice(0, 5)}hs`}
                />
              ) : null
            ))}
            <DatoEvento icon={Users} color="#8c5a45" label="Cant. invitados" valor={`${cotizacion.cantidad_pax || '—'} pax`} />
            {cotizacion.cantidad_cafes_override ? (
              <DatoEvento
                icon={Coffee}
                color="#ff6a1a"
                label="Servicio"
                valor={`${cotizacion.cantidad_cafes_override} cafés`}
              />
            ) : null}
            {dias.map((dia, i) => {
              const tieneHorario = dia.hora_inicio && dia.hora_fin
              const tieneDuracionManual = dia.duracion_horas !== null && dia.duracion_horas !== undefined
              if (!tieneHorario && !tieneDuracionManual) return null
              const valor = tieneHorario
                ? calcularDuracion(dia.hora_inicio.slice(0, 5), dia.hora_fin.slice(0, 5))
                : `${dia.duracion_horas}hs`
              return (
                <DatoEvento
                  key={`duracion-${i}`}
                  icon={Timer}
                  color="#a47864"
                  label={esMultiDia ? `Duración del servicio (día ${i + 1})` : 'Duración del servicio'}
                  valor={valor}
                />
              )
            })}
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

        {/* ============ PÁGINA 3 — CAFÉ DE ESPECIALIDAD (una sola hoja, con onda) ============ */}
        <section className="pres-page flex flex-col items-center justify-center bg-peach relative overflow-hidden px-16">
          <Watermark texto="volveme" />

          <div className="relative text-center max-w-[540px]">
            <h2 className="font-display text-4xl text-wine mb-3">Café de especialidad</h2>
            <p className="text-sm text-ink-mid leading-relaxed mb-7">
              Café evaluado por catadores certificados con <strong className="text-ink">80 puntos o más sobre 100</strong>,
              con trazabilidad completa de origen. Este es el que estamos sirviendo hoy en barra.
            </p>

            {cafeDelMes && (
              <div className="bg-paper rounded-md px-8 py-6 mb-8">
                <p className="font-display text-2xl text-wine leading-tight mb-1">{cafeDelMes.nombre_cafe}</p>
                <p className="text-xs text-ink-light mb-4">
                  {[cafeDelMes.variedad, cafeDelMes.beneficio, cafeDelMes.altura ? `${cafeDelMes.altura} msnm` : null]
                    .filter(Boolean).join(' · ')}
                </p>

                {cafeDelMes.puntaje && (
                  <p className="mb-4">
                    <span className="inline-block bg-wine text-paper text-xs font-bold uppercase tracking-wide rounded-full px-4 py-1.5">
                      {cafeDelMes.puntaje} puntos
                    </span>
                  </p>
                )}

                {cafeDelMes.notas_sabor_tags?.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {cafeDelMes.notas_sabor_tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium text-wine border border-orange/30 rounded-full px-3 py-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-10 gap-y-6 mb-8">
              <FeatureIconoChico icon={Coffee} color="#3f6bff" titulo="Café de especialidad" texto="Seleccionamos el café ideal para tu evento." />
              <FeatureIconoChico icon={Heart} color="#fd926f" titulo="Experiencia y calidad" texto="Baristas profesionales, hospitalidad y servicio." />
              <FeatureIconoChico icon={Snowflake} color="#b7ddff" titulo="Bebidas para cada momento" texto="Calientes, frías y opciones especiales." />
              <FeatureIconoChico icon={Leaf} color="#8c5a45" titulo="Alternativas vegetales" texto="Leche de avena y almendras para todos tus invitados." />
            </div>

            <p className="font-display text-xl text-wine">
              Probado en nuestra barra. <em className="font-accent text-orange not-italic">Listo para tu evento.</em>
            </p>
          </div>
        </section>

        {/* ============ PÁGINA 4 — NUESTRAS PREPARACIONES ============ */}
        <section className="pres-page flex flex-col bg-peach relative overflow-hidden">
          <Watermark texto="volveme" />
          <div className="flex-1 flex flex-col justify-center px-14">
            <h2 className="relative font-display text-4xl text-center text-wine mb-6">Nuestras preparaciones</h2>

            <div className="relative space-y-5">
              <MenuSeccion titulo="Sin leche" color="#3f6bff" items={[
                { nombre: 'Espresso', desc: 'Corto e intenso', icon: Coffee },
                { nombre: 'Americano', desc: 'Doble espresso con agua — más liviano', icon: Droplet },
              ]} />
              <MenuSeccion titulo="Con leche" color="#8c5a45" items={[
                { nombre: 'Latte', desc: 'Espresso con mucha leche — suave', icon: Milk },
                { nombre: 'Flat White', desc: 'Doble espresso con leche — se destaca el café', icon: Coffee },
                { nombre: 'Capuccino', desc: 'Espresso con leche — equilibrado y cremoso', icon: Coffee },
              ]} />
              <MenuSeccion titulo="Fríos" color="#b7ddff" items={[
                { nombre: 'Ice Latte', desc: 'Espresso con leche — fresco y equilibrado', icon: Snowflake },
                { nombre: 'Ice Coffee', desc: 'Doble espresso con agua — fresco y liviano', icon: Snowflake },
                { nombre: 'Espresso Tonic', desc: 'Espresso con tónica — fresco y burbujeante', icon: Snowflake },
              ]} />
              <MenuSeccion titulo="Especiales" color="#fd926f" items={[
                { nombre: 'Té Rojo', desc: 'Hong Mao Feng — Pei Chen', icon: Leaf },
                { nombre: 'Chocolatada', desc: 'Salsa de chocolate gourmet semi amargo con leche', icon: Candy },
              ]} />
            </div>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA 5 — QUÉ INCLUYE + PRECIO ============ */}
        <section className="pres-page flex flex-col bg-paper relative overflow-hidden">
          <Watermark texto="volveme" />
          {/* acento decorativo de marca — forma de arco, ver manual pág. 31 */}
          <div
            className="absolute -right-10 -top-10 w-40 h-56 opacity-[0.06] pointer-events-none"
            style={{ background: '#a47864', borderRadius: '999px 999px 0 0' }}
          />

          <div className="flex-1 flex flex-col justify-center px-16">
            <div className="max-w-[560px] mx-auto w-full">
              <h2 className="relative font-display text-3xl text-center text-wine mb-6">¿Qué incluye nuestro servicio?</h2>

              <ul className="relative space-y-2.5 mb-6">
                <Incluye texto={`${cotizacion.cantidad_baristas || 1} Barista${cotizacion.cantidad_baristas > 1 ? 's' : ''}`} />
                <Incluye texto="Bebidas calientes (espresso, americano, latte, flat white y capuccino)" />
                <Incluye texto="Leche entera, de avena y almendras" />
                {cotizacion.logo_3d && <Incluye texto="Logo impreso en el arte latte (algunos cafés)." />}
                {cotizacion.calcos && <Incluye texto={`Calcos en los vasos de ${cotizacion.tamano_vaso}`} />}
                <Incluye texto="Azúcar, edulcorante, servilletas y removedores" />
                <Incluye texto="Vasos de polipapel" />
                <Incluye texto="Transporte, montaje y desmontaje" />
              </ul>

              <div className="bg-peach rounded-md flex divide-x divide-orange/25 mb-4 py-1">
                <div className="flex-1 text-center py-4">
                  <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Invitados</p>
                  <p className="font-display text-4xl text-wine">{cotizacion.cantidad_pax || '—'}</p>
                  <p className="text-xs text-ink-light mt-1">Personas</p>
                </div>
                <div className="flex-1 text-center py-4">
                  <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Precio</p>
                  <p className="font-display text-3xl text-wine">{money(cotizacion.precio_neto)}</p>
                  <p className="text-xs text-ink-light mt-1">Precio café — + IVA</p>
                </div>
              </div>

              <p className="text-center text-xs text-ink-light underline mb-6">*Este presupuesto tiene validez por 15 días</p>

              <DashedRule />

              <div className="pt-6">
                <h3 className="font-display text-2xl text-center text-wine mb-4">Condiciones</h3>
                <div className="space-y-2.5">
                  <Condicion texto={<><strong className="text-ink">Reserva anticipada</strong> con el 50% y saldo restante 24hs antes del evento.</>} />
                  <Condicion texto={<>Punto eléctrico para el equipamiento de <strong className="text-ink">10A.</strong></>} />
                  <Condicion texto="Informar si el acceso al lugar del evento presenta obstáculos o desniveles para la instalación del equipamiento." />
                </div>
              </div>
            </div>
          </div>

          <Footer />
        </section>

        {/* ============ PÁGINA EXTRA — ANEXO PASTELERÍA (solo si aplica) ============ */}
        {cotizacion.lleva_pasteleria && pasteleriaItems.length > 0 && (
          <section className="pres-page flex flex-col bg-peach relative overflow-hidden">
            <Watermark texto="volveme" />
            {/* acento decorativo de marca — forma de arco, ver manual pág. 31 */}
            <div
              className="absolute -right-10 -top-10 w-40 h-56 opacity-[0.06] pointer-events-none"
              style={{ background: '#a47864', borderRadius: '999px 999px 0 0' }}
            />

            <div className="flex-1 flex flex-col justify-center px-16">
              <div className="relative text-center mb-10">
                <IconoConCirculo icon={Cookie} color="#ff6a1a" />
                <h2 className="font-display text-4xl text-wine mb-2">Anexo — Pastelería</h2>
                <p className="text-sm text-ink-mid">Selección para tu evento</p>
              </div>

              <div className="relative max-w-[520px] mx-auto w-full">
                <div className="space-y-4 mb-8">
                  {pasteleriaItems.map((it, i) => {
                    const precioUnitario = it.precio_proveedor * (1 + (cotizacion.pasteleria_markup_pct || 0))
                    const subtotalItem = precioUnitario * it.cantidad
                    const colores = ['#3f6bff', '#8c5a45', '#b7ddff', '#fd926f', '#a47864']
                    return (
                      <div key={it.id} className="flex items-center gap-4 border-b border-orange/20 pb-4">
                        <div className="flex-shrink-0">
                          <div className="relative w-11 h-11 flex items-center justify-center">
                            <span
                              className="absolute w-7 h-7 rounded-full"
                              style={{ backgroundColor: colores[i % colores.length], opacity: 0.55, top: -2, right: -2 }}
                            />
                            <Cookie size={22} strokeWidth={1.5} className="relative text-ink" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-bold text-ink">{it.nombre_producto}</p>
                          <p className="text-xs text-ink-light">
                            {it.cantidad} × {money(precioUnitario)}
                          </p>
                        </div>
                        <p className="text-base font-bold text-wine">{money(subtotalItem)}</p>
                      </div>
                    )
                  })}
                </div>

                <div className="bg-paper rounded-md p-6 text-center">
                  <p className="text-xs uppercase tracking-wide text-ink-mid mb-1">Total pastelería</p>
                  <p className="font-display text-4xl text-wine">{money(cotizacion.pasteleria_subtotal)}</p>
                  <p className="text-xs text-ink-light mt-1">+ IVA</p>
                </div>
              </div>
            </div>
            <Footer />
          </section>
        )}

        {/* ============ PÁGINA EXTRA — TOTAL GENERAL (solo si lleva pastelería) ============ */}
        {cotizacion.lleva_pasteleria && pasteleriaItems.length > 0 && (
          <section className="pres-page flex flex-col items-center justify-center bg-wine text-center px-16 relative overflow-hidden">
            {/* marca de agua, versión clara para fondo oscuro */}
            <p
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display whitespace-nowrap text-paper/[0.04] select-none pointer-events-none"
              style={{ fontSize: '9rem' }}
            >
              volveme
            </p>
            {/* acento decorativo de marca — forma de arco, ver manual pág. 31 */}
            <div
              className="absolute -left-14 -bottom-14 w-48 h-64 opacity-[0.08] pointer-events-none"
              style={{ background: '#ff6a1a', borderRadius: '999px 999px 0 0' }}
            />
            <div
              className="absolute -right-10 -top-16 w-36 h-48 opacity-[0.06] pointer-events-none"
              style={{ background: '#fd926f', borderRadius: '999px 999px 0 0' }}
            />

            <div className="relative">
              <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <span className="absolute w-11 h-11 rounded-full" style={{ backgroundColor: '#ff6a1a', opacity: 0.6, top: -3, right: -3 }} />
                <Coffee size={30} strokeWidth={1.4} className="relative text-paper" />
              </div>

              <p className="text-xs uppercase tracking-[0.3em] text-peach/70 mb-8">Presupuesto completo</p>

              <div className="flex items-center justify-center gap-8 mb-8">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-peach/60 mb-1">Café</p>
                  <p className="font-display text-2xl text-paper">{money(cotizacion.precio_neto)}</p>
                </div>
                <p className="font-accent text-3xl text-orange not-italic">+</p>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-peach/60 mb-1">Pastelería</p>
                  <p className="font-display text-2xl text-paper">{money(cotizacion.pasteleria_subtotal)}</p>
                </div>
              </div>

              <div className="w-24 h-px bg-peach/25 mx-auto mb-8" />

              <p className="font-display text-xl text-paper mb-2">
                Total <em className="font-accent text-orange not-italic text-2xl">general</em>
              </p>
              <p className="font-display text-6xl text-paper mb-3 leading-none">{money(cotizacion.precio_final)}</p>
              <p className="text-sm text-peach/70">+ IVA</p>
            </div>
          </section>
        )}

        {/* ============ PÁGINA 6 — ASÍ VIVIMOS NUESTROS EVENTOS ============ */}
        <section className="pres-page flex flex-col bg-paper">
          <div className="flex-1 flex flex-col justify-center px-10">
            <h2 className="font-display text-4xl text-center text-wine mb-10">Así vivimos nuestros eventos</h2>
            {/* Grid 2 / 3 / 2 — mismo layout asimétrico de la referencia original.
                Base de 6 columnas: fila 1 y 3 usan col-span-3 (2 fotos por fila),
                fila 2 usa col-span-2 (3 fotos por fila). */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { img: 'galeria-1', span: 3 },
                { img: 'galeria-7', span: 3 }, // foto nueva agregada
                { img: 'galeria-4', span: 2 },
                { img: 'galeria-2', span: 2 },
                { img: 'galeria-3', span: 2 },
                { img: 'galeria-6', span: 3 },
                { img: 'galeria-5', span: 3 },
              ].map(({ img, span }) => (
                <img
                  key={img}
                  src={`/images/${img}.jpg`}
                  alt=""
                  className="w-full object-cover rounded-sm"
                  style={{ height: '175px', gridColumn: `span ${span} / span ${span}` }}
                />
              ))}
            </div>
          </div>
          <p className="text-center font-display text-2xl text-wine pb-6">volveme<sup className="text-sm">®</sup></p>
        </section>

        {/* ============ PÁGINA 7 — CIERRE ============ */}
        <section className="pres-page flex flex-col items-center justify-center bg-peach text-center px-16">
          <p className="font-display text-4xl md:text-5xl text-wine leading-tight mb-12">
            volveme<sup className="text-2xl align-super">®</sup> la barra de café<br />para tu próximo{' '}
            <em className="font-accent text-orange not-italic">evento</em>.
          </p>
          <p className="text-sm text-ink-light underline mb-14">*Este presupuesto tiene validez por 15 días</p>
          <div className="flex items-center justify-center gap-8 text-sm text-ink-mid flex-wrap">
            <span className="flex items-center gap-2">🌐 www.volveme.com</span>
            <span className="flex items-center gap-2">📷 volveme.cafe</span>
            <span className="flex items-center gap-2">✉️ info@volveme.com</span>
            <span className="flex items-center gap-2">📞 +54 9 11 5841-6365</span>
          </div>
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

function FeatureIconoChico({ icon: Icon, titulo, texto, color }) {
  return (
    <div className="text-center">
      <div className="relative w-14 h-14 mx-auto mb-3 flex items-center justify-center">
        <span
          className="absolute w-9 h-9 rounded-full"
          style={{ backgroundColor: color || '#ff6a1a', opacity: 0.55, top: -3, right: -3 }}
        />
        <Icon size={28} strokeWidth={1.4} className="relative text-ink" />
      </div>
      <p className="text-sm font-bold text-ink mb-0.5">{titulo}</p>
      <p className="text-xs text-ink-mid leading-snug">{texto}</p>
    </div>
  )
}


function IconoConCirculo({ icon: Icon, color }) {
  return (
    <div className="relative w-12 h-12 mx-auto mb-2 flex items-center justify-center">
      <span
        className="absolute w-7 h-7 rounded-full"
        style={{ backgroundColor: color, opacity: 0.55, top: -2, right: -2 }}
      />
      <Icon size={24} strokeWidth={1.5} className="relative text-ink" />
    </div>
  )
}

function MenuSeccion({ titulo, items, color }) {
  const cols = items.length === 2 ? 'grid-cols-2 max-w-[380px] mx-auto' : 'grid-cols-3'
  return (
    <div>
      <div className="flex items-center justify-center mb-4">
        <span
          className="text-xs uppercase tracking-[0.25em] font-bold text-wine px-4 py-1.5 rounded-full"
          style={{ backgroundColor: `${color}22` }}
        >
          {titulo}
        </span>
      </div>
      <div className={`grid ${cols} gap-5`}>
        {items.map((it) => (
          <div key={it.nombre} className="text-center">
            <IconoConCirculo icon={it.icon || Coffee} color={color || '#3f6bff'} />
            <p className="text-sm font-bold text-ink">{it.nombre}</p>
            <p className="text-[13px] text-ink leading-snug mt-1 opacity-80">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DatoEvento({ label, valor, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-4">
      {Icon && (
        <span className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center">
          <span
            className="absolute w-7 h-7 rounded-full"
            style={{ backgroundColor: color || '#3f6bff', opacity: 0.55, top: -2, right: -2 }}
          />
          <Icon size={22} strokeWidth={1.6} className="relative text-ink" />
        </span>
      )}
      <div className="text-left">
        <span className="block text-xs uppercase tracking-wide text-ink-mid">{label}</span>
        <span className="block text-lg font-bold text-ink">{valor}</span>
      </div>
    </div>
  )
}

function Incluye({ texto }) {
  return (
    <li className="flex items-start gap-3 text-base text-ink-mid">
      <span className="relative flex-shrink-0 w-6 h-6 mt-0.5 flex items-center justify-center">
        <span className="absolute w-5 h-5 rounded-full bg-orange/20" />
        <CheckCircle2 size={18} strokeWidth={2} className="relative text-orange" />
      </span>
      {texto}
    </li>
  )
}

function Condicion({ texto }) {
  return (
    <p className="text-base text-ink-mid text-center leading-relaxed max-w-[480px] mx-auto">
      {texto}
    </p>
  )
}

function MobileDato({ label, valor, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3.5">
      {Icon && (
        <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
          <span className="absolute w-7 h-7 rounded-full" style={{ backgroundColor: color || '#ff6a1a', opacity: 0.55 }} />
          <Icon size={16} strokeWidth={1.8} className="relative text-ink" />
        </div>
      )}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-mid">{label}</p>
        <p className="text-base font-bold text-ink">{valor}</p>
      </div>
    </div>
  )
}

function MobileIncluye({ texto }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-mid leading-relaxed">
      <CheckCircle2 size={16} strokeWidth={2} className="text-orange flex-shrink-0 mt-0.5" />
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
