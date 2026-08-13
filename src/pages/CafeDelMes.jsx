import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Save, Archive, RotateCcw, CheckCircle2 } from 'lucide-react'

const VACIO = {
  id: null,
  nombre_cafe: '',
  origen: '',
  region: '',
  variedad: '',
  beneficio: '',
  finca: '',
  caficultor: '',
  proceso_recoleccion: '',
  proceso_secado: '',
  altura: '',
  puntaje: '',
  zafra: '',
  fragancia_aroma: '',
  sabor: '',
  retrogusto: '',
  acidez: '',
  cuerpo: '',
  balance: '',
  general: '',
  uniformidad: '10',
  taza_limpia: '10',
  dulzor: '10',
  defectos: '0',
  notas_cata: '',
  notas_sabor_tags: '', // se edita como texto separado por comas
}

// Convierte "" -> null y strings numéricos -> number, para mandar a Supabase
function aPayload(form) {
  const numericos = [
    'puntaje', 'fragancia_aroma', 'sabor', 'retrogusto', 'acidez', 'cuerpo',
    'balance', 'general', 'uniformidad', 'taza_limpia', 'dulzor', 'defectos',
  ]
  const payload = { ...form }
  delete payload.id
  numericos.forEach((campo) => {
    payload[campo] = payload[campo] === '' ? null : Number(payload[campo])
  })
  payload.notas_sabor_tags = form.notas_sabor_tags
    ? form.notas_sabor_tags.split(',').map((t) => t.trim()).filter(Boolean)
    : []
  return payload
}

// Convierte un registro de la base a strings editables en el form
function aForm(row) {
  if (!row) return VACIO
  return {
    ...VACIO,
    ...row,
    puntaje: row.puntaje ?? '',
    fragancia_aroma: row.fragancia_aroma ?? '',
    sabor: row.sabor ?? '',
    retrogusto: row.retrogusto ?? '',
    acidez: row.acidez ?? '',
    cuerpo: row.cuerpo ?? '',
    balance: row.balance ?? '',
    general: row.general ?? '',
    uniformidad: row.uniformidad ?? '10',
    taza_limpia: row.taza_limpia ?? '10',
    dulzor: row.dulzor ?? '10',
    defectos: row.defectos ?? '0',
    notas_sabor_tags: (row.notas_sabor_tags || []).join(', '),
  }
}

export default function CafeDelMes() {
  const [form, setForm] = useState(VACIO)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function cargarTodo() {
    setLoading(true)
    const { data } = await supabase
      .from('cafe_del_mes')
      .select('*')
      .order('created_at', { ascending: false })

    const activo = (data || []).find((r) => r.activo)
    setForm(aForm(activo))
    setHistorial((data || []).filter((r) => !r.activo))
    setLoading(false)
  }

  useEffect(() => { cargarTodo() }, [])

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    setGuardando(true)
    setMensaje('')
    const payload = aPayload(form)

    if (form.id) {
      await supabase.from('cafe_del_mes').update(payload).eq('id', form.id)
    } else {
      // si ya había un activo sin guardar por acá (no debería pasar, pero
      // por las dudas), lo desactivamos antes de crear el nuevo
      await supabase.from('cafe_del_mes').update({ activo: false }).eq('activo', true)
      const { data } = await supabase
        .from('cafe_del_mes')
        .insert({ ...payload, activo: true })
        .select()
        .single()
      setForm(aForm(data))
    }

    setGuardando(false)
    setMensaje('Guardado. Ya se va a ver en los próximos presupuestos.')
    cargarTodo()
  }

  async function archivarYEmpezarNuevo() {
    if (form.id) {
      await supabase.from('cafe_del_mes').update({ activo: false }).eq('id', form.id)
    }
    setForm(VACIO)
    setMensaje('Café archivado. Cargá el nuevo y guardalo cuando esté listo.')
    cargarTodo()
  }

  async function usarDeNuevo(item) {
    await supabase.from('cafe_del_mes').update({ activo: false }).eq('activo', true)
    await supabase.from('cafe_del_mes').update({ activo: true }).eq('id', item.id)
    setMensaje(`Volviste a activar "${item.nombre_cafe}".`)
    cargarTodo()
  }

  if (loading) {
    return <div className="text-ink-light text-sm">Cargando…</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-wine mb-1">Café del mes</h1>
      <p className="text-sm text-ink-mid mb-6">
        Cargá acá la ficha técnica del café que estamos sirviendo. Se guarda una sola vez y se muestra
        sola en todos los presupuestos hasta que la cambies — no hace falta tocar nada por cotización.
      </p>

      {mensaje && (
        <div className="flex items-center gap-2 text-sm text-ink bg-peach/60 border border-orange/20 rounded px-4 py-2.5 mb-6">
          <CheckCircle2 size={15} className="text-orange flex-shrink-0" /> {mensaje}
        </div>
      )}

      <Seccion titulo="Origen y trazabilidad">
        <Campo label="Nombre del café" full>
          <input className="input" placeholder='ej: "Nicaragua — Parainema, Caturra Lavado"'
            value={form.nombre_cafe} onChange={(e) => set('nombre_cafe', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Origen"><input className="input" value={form.origen} onChange={(e) => set('origen', e.target.value)} /></Campo>
          <Campo label="Región"><input className="input" value={form.region} onChange={(e) => set('region', e.target.value)} /></Campo>
          <Campo label="Variedad"><input className="input" value={form.variedad} onChange={(e) => set('variedad', e.target.value)} /></Campo>
          <Campo label="Proceso / beneficio"><input className="input" value={form.beneficio} onChange={(e) => set('beneficio', e.target.value)} /></Campo>
          <Campo label="Finca"><input className="input" value={form.finca} onChange={(e) => set('finca', e.target.value)} /></Campo>
          <Campo label="Caficultor"><input className="input" value={form.caficultor} onChange={(e) => set('caficultor', e.target.value)} /></Campo>
          <Campo label="Proceso de recolección"><input className="input" value={form.proceso_recoleccion} onChange={(e) => set('proceso_recoleccion', e.target.value)} /></Campo>
          <Campo label="Proceso de secado"><input className="input" value={form.proceso_secado} onChange={(e) => set('proceso_secado', e.target.value)} /></Campo>
          <Campo label="Altura (msnm)"><input className="input" value={form.altura} onChange={(e) => set('altura', e.target.value)} /></Campo>
          <Campo label="Zafra"><input className="input" value={form.zafra} onChange={(e) => set('zafra', e.target.value)} /></Campo>
          <Campo label="Puntaje SCA (sobre 100)"><input className="input" type="number" step="0.1" value={form.puntaje} onChange={(e) => set('puntaje', e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion titulo="Puntajes de cata (escala 0 a 10)">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Campo label="General"><input className="input" type="number" step="0.25" value={form.general} onChange={(e) => set('general', e.target.value)} /></Campo>
          <Campo label="Fragancia / Aroma"><input className="input" type="number" step="0.25" value={form.fragancia_aroma} onChange={(e) => set('fragancia_aroma', e.target.value)} /></Campo>
          <Campo label="Sabor"><input className="input" type="number" step="0.25" value={form.sabor} onChange={(e) => set('sabor', e.target.value)} /></Campo>
          <Campo label="Retrogusto"><input className="input" type="number" step="0.25" value={form.retrogusto} onChange={(e) => set('retrogusto', e.target.value)} /></Campo>
          <Campo label="Acidez"><input className="input" type="number" step="0.25" value={form.acidez} onChange={(e) => set('acidez', e.target.value)} /></Campo>
          <Campo label="Cuerpo"><input className="input" type="number" step="0.25" value={form.cuerpo} onChange={(e) => set('cuerpo', e.target.value)} /></Campo>
          <Campo label="Balance"><input className="input" type="number" step="0.25" value={form.balance} onChange={(e) => set('balance', e.target.value)} /></Campo>
          <Campo label="Uniformidad"><input className="input" type="number" step="0.25" value={form.uniformidad} onChange={(e) => set('uniformidad', e.target.value)} /></Campo>
          <Campo label="Taza limpia"><input className="input" type="number" step="0.25" value={form.taza_limpia} onChange={(e) => set('taza_limpia', e.target.value)} /></Campo>
          <Campo label="Dulzor"><input className="input" type="number" step="0.25" value={form.dulzor} onChange={(e) => set('dulzor', e.target.value)} /></Campo>
          <Campo label="Defectos"><input className="input" type="number" step="1" value={form.defectos} onChange={(e) => set('defectos', e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion titulo="Notas">
        <Campo label="Notas de sabor (separadas por coma)" full>
          <input className="input" placeholder="Caramelo, Durazno, Nueces pecan, Floral"
            value={form.notas_sabor_tags} onChange={(e) => set('notas_sabor_tags', e.target.value)} />
        </Campo>
        <Campo label="Notas de cata (párrafo)" full>
          <textarea className="input" rows={3}
            value={form.notas_cata} onChange={(e) => set('notas_cata', e.target.value)} />
        </Campo>
      </Seccion>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={guardar}
          disabled={guardando || !form.nombre_cafe}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
        >
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {form.id ? 'Guardar cambios' : 'Activar este café'}
        </button>
        {form.id && (
          <button
            onClick={archivarYEmpezarNuevo}
            className="flex items-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors"
          >
            <Archive size={15} /> Archivar y cargar uno nuevo
          </button>
        )}
      </div>

      {historial.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-wide text-ink-light font-bold mb-3">Cafés anteriores</h2>
          <div className="space-y-2">
            {historial.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-rule rounded px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-ink">{item.nombre_cafe}</p>
                  <p className="text-xs text-ink-light">{item.origen} {item.zafra ? `· ${item.zafra}` : ''}</p>
                </div>
                <button
                  onClick={() => usarDeNuevo(item)}
                  className="flex items-center gap-1.5 text-xs text-ink-mid hover:text-orange transition-colors"
                >
                  <RotateCcw size={13} /> Volver a activar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs uppercase tracking-wide text-ink-light font-bold mb-3">{titulo}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Campo({ label, children, full }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className="block text-xs text-ink-mid mb-1">{label}</label>
      {children}
    </div>
  )
}
