/** Compare available spec values for two or more active products. */
export default function ComparisonTable({ products }) {
  const fields = [...new Set(products.flatMap(p => Object.keys(p.specs || {})))].slice(0, 8)
  if (products.length < 2 || !fields.length) return null
  return <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-3 font-semibold text-slate-500">Specification</th>{products.map(p => <th className="p-3 font-semibold text-slate-700" key={p.name}>{p.name}</th>)}</tr></thead><tbody>{fields.map(field => <tr className="border-t border-slate-100" key={field}><td className="p-3 font-medium text-slate-500">{field}</td>{products.map(p => <td className={`p-3 ${p.recommended ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-700'}`} key={p.name}>{p.specs?.[field] || '—'}</td>)}</tr>)}</tbody></table></section>
}
