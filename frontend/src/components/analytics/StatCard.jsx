export default function StatCard({ label, value, detail }) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>
}
