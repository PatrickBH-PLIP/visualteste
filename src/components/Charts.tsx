import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORIES } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import type { BalanceReport } from '@/types'

const brlTip = (v: number) => formatBRL(v)
const short = (iso: string) => formatDate(iso).slice(0, 5)

export function DailyChart({ data, series }: { data: BalanceReport['daily']; series: ('sold' | 'received')[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data.map((d) => ({ ...d, label: short(d.date) }))} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a1d1a22" />
        <XAxis dataKey="label" fontSize={11} interval="preserveStartEnd" />
        <YAxis fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 100)}`} width={58} />
        <Tooltip formatter={(v: number) => brlTip(v)} labelFormatter={(l) => `Dia ${l}`} />
        {series.length > 1 && <Legend />}
        {series.includes('sold') && <Bar dataKey="sold_cents" name="Vendido" fill="#cd1c18" radius={[3, 3, 0, 0]} />}
        {series.includes('received') && <Bar dataKey="received_cents" name="Recebido" fill="#0f2a4f" radius={[3, 3, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryChart({ data }: { data: BalanceReport['by_category'] }) {
  const rows = data.map((d) => ({ name: CATEGORIES[d.category].label, value: d.gross_cents, color: CATEGORIES[d.category].main }))
  return <Donut rows={rows} />
}

export function StatusChart({ r }: { r: BalanceReport }) {
  return <Donut rows={[
    { name: 'Pagas', value: r.paid_count, color: '#008000' },
    { name: 'Pendentes', value: r.pending_count, color: '#ffa500' },
    { name: 'Atrasadas', value: r.late_count, color: '#ff0000' },
    { name: 'A devolver', value: r.credit_count, color: '#7a2e8e' },
  ].filter((x) => x.value > 0)} money={false} />
}

function Donut({ rows, money = true }: { rows: { name: string; value: number; color: string }[]; money?: boolean }) {
  if (!rows.length) return <p className="py-12 text-center text-sm text-tinta/60">Sem dados no período.</p>
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
          {rows.map((r) => <Cell key={r.name} fill={r.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => (money ? brlTip(v) : v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
