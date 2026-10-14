export function StatCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-tinta/70">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: tone }}>{value}</p>
      {note && <p className="mt-1 text-xs text-tinta/60">{note}</p>}
    </div>
  )
}
