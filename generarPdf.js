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
    // scale 3 + PNG (sin pérdida) — antes era scale:2 + JPEG 0.92, que
    // se notaba pixelado sobre todo en la foto de portada.
    const canvas = await html2canvas(paginas[i], { scale: 3, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, 0, anchoPagina, altoPagina)
  }

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
