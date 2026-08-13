import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { supabase } from './supabase'

/**
 * Captura cada página (elementos con clase .pres-page) y arma un PDF A4 real.
 * Devuelve un Blob listo para subir o descargar.
 */
export async function generarPdfBlob(containerEl) {
  const paginas = containerEl.querySelectorAll('.pres-page')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const anchoPagina = 210
  const altoPagina = 297

  for (let i = 0; i < paginas.length; i++) {
    // windowWidth fuerza SIEMPRE un ancho de escritorio (1200px) para
    // renderizar, sin importar si quien genera el PDF está en el
    // celular. Es clave: sin esto, en pantallas angostas (<768px) se
    // dispara la regla CSS que oculta ".presupuesto" fuera de pantalla
    // también DENTRO de la captura, y el resultado sale con páginas
    // cortadas, huecos en blanco y sin color de fondo.
    const canvas = await html2canvas(paginas[i], {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      windowHeight: 1600,
    })
    // JPEG en vez de PNG: con 7 hojas llenas de fotos, PNG sin
    // comprimir hacía que el PDF pesara más de 200MB (imposible de
    // mandar por WhatsApp/mail). JPEG calidad 0.92 se ve prácticamente
    // igual y pesa una fracción — el mismo criterio que ya usamos en
    // la versión mobile.
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    if (i > 0) pdf.addPage()
    // El 'FAST' del final es clave — sin este parámetro, jsPDF guarda
    // la imagen adentro del PDF completamente sin comprimir (cada
    // página pesaba 24MB en crudo, pixel por pixel, ignorando que ya
    // se la mandamos en JPEG). Con esto sí respeta la compresión.
    pdf.addImage(imgData, 'JPEG', 0, 0, anchoPagina, altoPagina, undefined, 'FAST')
  }

  return pdf.output('blob')
}

/**
 * Versión "mobile" del PDF: en vez de las 8 hojas A4, captura la vista
 * resumida de una sola columna (la misma que se ve en pantalla en el
 * celular) y arma un PDF angosto, tipo teléfono, con letra grande —
 * pensado para mandarlo a alguien que lo va a abrir en su celular,
 * aunque quien lo genere esté en la compu. Es UNA sola página larga en
 * vez de 8 hojas A4, así no hay que estar pasando de página en el
 * visor de WhatsApp.
 */
export async function generarPdfMobileBlob(el) {
  // windowWidth fuerza el ancho de renderizado tipo celular incluso si
  // quien genera el PDF está en una pantalla de escritorio grande —
  // así el resultado es igual sin importar desde qué dispositivo se manda.
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: 420,
  })

  const anchoMM = 100 // ancho tipo celular — letra grande relativa a la página
  const altoMM = (canvas.height / canvas.width) * anchoMM

  const pdf = new jsPDF({ unit: 'mm', format: [anchoMM, altoMM], orientation: 'portrait' })
  // JPEG en vez de PNG: esta versión lleva la foto de portada de fondo
  // completo, y PNG sin comprimir con fotos pesa muchísimo (varios MB).
  // JPEG calidad 0.85 se ve prácticamente igual y pesa una fracción.
  const imgData = canvas.toDataURL('image/jpeg', 0.85)
  pdf.addImage(imgData, 'JPEG', 0, 0, anchoMM, altoMM, undefined, 'FAST')

  return pdf.output('blob')
}

/** Sube el PDF a Supabase Storage y devuelve la URL pública */
export async function subirPdf(blob, cotizacionId) {
  const path = `cotizacion-${cotizacionId}.pdf`
  const { error } = await supabase.storage
    .from('presupuestos')
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' })

  if (error) throw error

  const { data } = supabase.storage.from('presupuestos').getPublicUrl(path)
  return data.publicUrl
}

/** Limpia un teléfono argentino a formato wa.me (549 + código de área + número) */
export function telefonoAWhatsapp(telefono) {
  if (!telefono) return null
  let limpio = telefono.replace(/[^\d]/g, '')
  limpio = limpio.replace(/^0/, '') // saca el 0 inicial de código de área
  limpio = limpio.replace(/^15/, '') // saca el 15 de celular si quedó pegado
  if (!limpio.startsWith('54')) limpio = '54' + limpio
  if (!limpio.startsWith('549')) limpio = limpio.replace(/^54/, '549')
  return limpio
}

export function armarLinkWhatsapp(telefono, mensaje) {
  const numero = telefonoAWhatsapp(telefono)
  const texto = encodeURIComponent(mensaje)
  return numero
    ? `https://wa.me/${numero}?text=${texto}`
    : `https://wa.me/?text=${texto}`
}
