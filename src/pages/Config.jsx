import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Save, AlertTriangle } from 'lucide-react'

// Metadata de cada clave de config_pricing — para mostrarlas agrupadas,
// con una etiqueta legible y una ayuda corta, en vez de una lista plana
// de nombres técnicos. Si en algún momento se agrega una clave nueva en
// la base que no está acá, igual aparece (al final, en "Otros"), así
// nunca se "pierde" un valor por no estar mapeado.
const GRUPOS = [
  {
    titulo: 'Café e insumos por bebida',
    claves: {
      gramos_espresso: { label: 'Café por bebida (g)', ayuda: 'Dosis fija de espresso, sin importar el tamaño del vaso' },
      precio_kilo_cafe: { label: 'Precio del café ($/kg)', ayuda: 'Ya con IVA incluido si corresponde' },
      costo_litro_leche: { label: 'Precio de la leche ($/L)' },
      ml_leche_por_bebida: { label: 'Leche por bebida (ml)', ayuda: 'Aditivo — se suma igual, no es proporcional al tamaño' },
      precio_bidon_agua_20l: { label: 'Bidón de agua 20L ($)' },
      ml_agua_por_bebida: { label: 'Agua por bebida (ml)', ayuda: 'Aditivo, fórmula leche+agua' },
      costo_vaso_6oz_x50: { label: 'Vasos 6oz — caja de 50 ($)' },
      costo_vaso_8oz_x50: { label: 'Vasos 8oz — caja de 50 ($)' },
      costo_vaso_12oz_x50: { label: 'Vasos 12oz — caja de 50 ($)' },
      sobres_azucar_por_bebida: { label: 'Sobres de azúcar por bebida' },
      costo_azucar_caja_x800: { label: 'Azúcar — caja de 800 sobres ($)' },
      costo_edulcorante_caja_x200: { label: 'Edulcorante — caja de 200 ($)' },
      costo_removedor_por_bebida: { label: 'Removedor por bebida ($)' },
      consumo_por_persona: { label: 'Consumo estimado (bebidas/persona)', ayuda: 'Se usa cuando no cargás la cantidad de cafés a mano' },
    },
  },
  {
    titulo: 'Primavera / Verano',
    ayuda: 'Costo real de insumos extra de este nivel — se suma sobre el Esencial, no es un porcentaje',
    claves: {
      costo_tonica_por_bebida: { label: 'Tónica por bebida ($)', ayuda: 'Para Espresso Tonic' },
      costo_syrup_por_bebida: { label: 'Jarabe/syrup por bebida ($)', ayuda: 'Para lattes saborizados' },
      costo_hielo_por_bebida: { label: 'Hielo por bebida ($)' },
    },
  },
  {
    titulo: 'Extras',
    claves: {
      costo_calco_unidad: { label: 'Calco por bebida ($)' },
      costo_logo3d_unidad: { label: 'Logo 3D por unidad ($)' },
      recargo_premium_pct: { label: 'Recargo Premium (0.25 = 25%)' },
    },
  },
  {
    titulo: 'Staff',
    claves: {
      sueldo_barista_hora: { label: 'Sueldo barista ($/hora)' },
      extra_viaticos_barista: { label: 'Viáticos ($/persona/día)' },
    },
  },
  {
    titulo: 'Equipo (tarifas planas, sistema viejo)',
    ayuda: 'Estas son las que usa el selector "Alquiler de equipo extra" general del cotizador. Las tarifas por proveedor (Facu, Peipe) se editan en Equipamiento → Tarifas de cotización, no acá.',
    claves: {
      amortizacion_equipo_default: { label: 'Amortización default ($/día)' },
      tarifa_maquina_1grupo_dia: { label: 'Máquina 1 grupo — tarifa plana ($/día)' },
      tarifa_maquina_2grupos_dia: { label: 'Máquina 2 grupos — tarifa plana ($/día)' },
      tarifa_molino_dia: { label: 'Molino — tarifa plana ($/día)' },
    },
  },
  {
    titulo: 'Cascada de precio y ART',
    claves: {
      imprevistos_pct: { label: 'Imprevistos (0.05 = 5%)' },
      multiplicador_precio: { label: 'Multiplicador de precio (1.65 = 65% margen)' },
      iva_pct: { label: 'IVA (0.21 = 21%)', ayuda: 'Informativo — no se suma al precio cotizado' },
      art_monto_default: { label: 'ART — monto default ($)' },
    },
  },
]

export default function Config() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardandoClave, setGuardandoClave] = useState(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('config_pricing').select('*').order('clave')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizar(clave, valor) {
    setGuardandoClave(clave)
    await supabase.from('config_pricing').update({ valor }).eq('clave', clave)
    setRows((prev) => prev.map((r) => (r.clave === clave ? { ...r, valor } : r)))
    setGuardandoClave(null)
  }

  const clavesConocidas = new Set(GRUPOS.flatMap((g) => Object.keys(g.claves)))
  const clavesSueltas = rows.filter((r) => !clavesConocidas.has(r.clave))

  if (loading) return <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Config</p>
        <h1 className="font-display text-2xl">Parámetros de cotización</h1>
        <p className="text-sm text-ink-mid mt-2">
          Estos son los números que usa el motor de cálculo (`pricingEngine.js`) para cotizar. Se guardan solos al salir de cada campo — no hace falta tocar Supabase a mano.
        </p>
      </div>

      {GRUPOS.map((grupo) => (
        <GrupoConfig
          key={grupo.titulo}
          grupo={grupo}
          rows={rows}
          onActualizar={actualizar}
          guardandoClave={guardandoClave}
        />
      ))}

      {clavesSueltas.length > 0 && (
        <GrupoConfig
          grupo={{
            titulo: 'Otros',
            ayuda: 'Claves que existen en la base pero todavía no están agrupadas acá arriba — se editan igual.',
            claves: Object.fromEntries(clavesSueltas.map((r) => [r.clave, { label: r.clave }])),
          }}
          rows={rows}
          onActualizar={actualizar}
          guardandoClave={guardandoClave}
        />
      )}
    </div>
  )
}

function GrupoConfig({ grupo, rows, onActualizar, guardandoClave }) {
  const entradas = Object.entries(grupo.claves)
    .map(([clave, meta]) => ({ clave, meta, row: rows.find((r) => r.clave === clave) }))

  const faltantes = entradas.filter((e) => !e.row)
  const presentes = entradas.filter((e) => e.row)

  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wide text-ink-light mb-1">{grupo.titulo}</p>
      {grupo.ayuda && <p className="text-[11px] text-ink-light mb-2">{grupo.ayuda}</p>}

      {faltantes.length > 0 && (
        <div className="flex items-start gap-2 text-xs bg-coral-light text-coral rounded-lg px-3 py-2 mb-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>Faltan en la base: {faltantes.map((f) => f.meta.label).join(', ')} — no se pueden editar hasta que exista la fila en <code>config_pricing</code>.</span>
        </div>
      )}

      {presentes.length > 0 && (
        <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
          <table className="w-full text-sm">
            <tbody>
              {presentes.map(({ clave, meta, row }) => (
                <tr key={clave} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-ink font-medium">{meta.label}</p>
                    {meta.ayuda && <p className="text-[11px] text-ink-light">{meta.ayuda}</p>}
                  </td>
                  <td className="px-4 py-3 text-right w-40">
                    <div className="flex items-center justify-end gap-2">
                      {guardandoClave === clave && <Save size={12} className="text-ink-light animate-pulse" />}
                      <input
                        type="number"
                        step="any"
                        defaultValue={row.valor}
                        onBlur={(e) => {
                          const nuevo = Number(e.target.value)
                          if (nuevo !== Number(row.valor)) onActualizar(clave, nuevo)
                        }}
                        className="input text-sm text-right py-1.5"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
