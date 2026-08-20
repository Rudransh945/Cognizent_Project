import { ExternalLink, ImageOff } from 'lucide-react'

/** Render search/PDF product facts with an image fallback for missing retailer images. */
export default function ProductCard({ product }) {
  const [first, second, third] = Object.entries(product.specs || {}).slice(0, 3)
  return <article className={`relative overflow-hidden rounded-xl border bg-white p-3 shadow-sm ${product.recommended ? 'border-violet-300 ring-1 ring-violet-100' : 'border-slate-200'}`}>
    {product.recommended && <span className="absolute right-2 top-2 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">WHY THIS PICK</span>}
    <div className="flex gap-3"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} /> : <ImageOff className="text-slate-400" />}</div>
      <div className="min-w-0"><h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{product.name}</h3><p className="mt-1 font-bold text-violet-700">{product.price}</p><p className="text-xs text-slate-500">{product.source}</p></div></div>
    <dl className="mt-3 space-y-1 text-xs text-slate-600">{[first, second, third].filter(Boolean).map(([key, value]) => <div className="flex justify-between gap-3" key={key}><dt>{key}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl>
    {product.link && <a target="_blank" rel="noreferrer" href={product.link} className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-600">View source <ExternalLink size={12} /></a>}
  </article>
}
