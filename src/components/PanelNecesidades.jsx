import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react'

export default function PanelNecesidades({ necesidades, cargando }) {
  if (cargando) {
    return (
      <div className="border border-rule rounded-lg bg-paper-card p-5 mb-6">
        <p className="text-sm text-ink-light">Calculando necesidades según eventos confirmados…</p>
      </div>
    )
  }

  if (!necesidades || necesidades.eventosContemplados === 0) {
    return (
      <div className="border border-rule rounded-lg bg-paper-card p-5 mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-2 flex items-center gap-1.5">
          <TrendingUp size={13} /> Necesidades según eventos confirmados
        </p>
        <p className="text-sm text-ink-light">No hay eventos confirmados a futuro todavía — nada que proyectar.</p>
      </div>
    )
  }

  const categorias = [
    { key: 'cafe', label: 'Café' },
    { key: 'leche', label: 'Leche' },
    { key: 'agua', label: 'Agua' },
    { key: 'vasos', label: 'Vasos' },
  ]
  const hayUrgente = categorias.some((c) => necesidades[c.key].faltaUrgente > 0)

  return (
    <div className="border border-rule rounded-lg bg-paper-card p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <p className="text-xs uppercase tracking-wide text-ink-light flex items-center gap-1.5">
          <TrendingUp size={13} /> Necesidades según eventos confirmados
        </p>
        <Link to="/eventos" className="flex items-center gap-1.5 text-xs text-ink-mid hover:text-wine">
          <CalendarClock size={13} />
          {necesidades.eventosContemplados} evento{necesidades.eventosContemplados !== 1 ? 's' : ''} a futuro
          {necesidades.eventosUrgentes > 0 && ` · ${necesidades.eventosUrgentes} en los próximos ${necesidades.diasUrgente} días`}
        </Link>
      </div>

      {hayUrgente && (
        <div className="flex items-center gap-2 text-sm bg-coral text-paper rounded-lg px-4 py-2.5 mb-4">
          <AlertTriangle size={15} className="flex-shrink-0" />
          Con el stock actual, no llegás a cubrir los eventos de los próximos {necesidades.diasUrgente} días. Revisá las categorías marcadas abajo.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categorias.map(({ key, label }) => (
          <TarjetaNecesidad key={key} label={label} datos={necesidades[key]} />
        ))}
      </div>

      <p className="text-[11px] text-ink-light mt-3">
        Leche/agua/vasos se suman entre todas las marcas y tamaños cargados en Insumos — es una proyección para planificar, no un cálculo exacto por marca puntual.
      </p>
    </div>
  )
}

function TarjetaNecesidad({ label, datos }) {
  const { necesario, necesarioUrgente, stock, faltaTotal, faltaUrgente, unidad } = datos

  let estado = 'ok'
  if (faltaUrgente > 0) estado = 'urgente'
  else if (faltaTotal > 0) estado = 'atencion'

  const estilos = {
    ok: { bg: 'bg-peach', texto: 'text-wine', mensaje: 'Cubierto ✓' },
    atencion: { bg: 'bg-peach', texto: 'text-orange', mensaje: `Falta ${faltaTotal.toFixed(1)} ${unidad} (no urgente)` },
    urgente: { bg: 'bg-coral-light', texto: 'text-coral', mensaje: `Falta ${faltaUrgente.toFixed(1)} ${unidad} — ¡urgente!` },
  }
  const s = estilos[estado]

  return (
    <div className={`${s.bg} rounded-lg p-3.5`}>
      <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1.5">{label}</p>
      <p className="text-xs text-ink-mid">Necesario: <strong className="text-ink">{necesario.toFixed(1)} {unidad}</strong></p>
      <p className="text-xs text-ink-mid">Stock: <strong className="text-ink">{stock.toFixed(1)} {unidad}</strong></p>
      {necesarioUrgente > 0 && (
        <p className="text-[11px] text-ink-light">({necesarioUrgente.toFixed(1)} {unidad} en los próx. días)</p>
      )}
      <p className={`text-sm font-display mt-1 ${s.texto}`}>{s.mensaje}</p>
    </div>
  )
}
