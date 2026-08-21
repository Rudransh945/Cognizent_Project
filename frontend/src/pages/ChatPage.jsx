import { Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import ChatPanel from '../components/ChatPanel'
import ComparisonTable from '../components/ComparisonTable'
import ProductCard from '../components/ProductCard'
import SkeletonCard from '../components/SkeletonCard'
import ViewToggle from '../components/ViewToggle'

export default function ChatPage({ messages, products, selectedProducts, loading, connecting, error, onSend, onPhoto, onPdf, onToggleComparison, onNewChat, sessionId }) {
  const [view, setView] = useState('cards')
  const selected = product => selectedProducts.some(item => item.name === product.name && item.price === product.price && item.source === product.source && item.link === product.link)
  const comparisonProducts = selectedProducts.length ? selectedProducts : products
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Product research, simplified</p><h1 className="mt-1 text-3xl font-black text-slate-950">One category, focused research</h1><p className="mt-2 text-sm text-slate-500">Each chat shows 6–8 products from one category. Start a new chat before changing categories.</p></div><button onClick={onNewChat} disabled={connecting} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"><Plus size={16} />New chat</button></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <ChatPanel messages={messages} loading={loading || connecting} ready={Boolean(sessionId)} onSend={onSend} onPhoto={onPhoto} onPdf={onPdf} />
      <section className="min-h-[620px] rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Sparkles size={20} /></span><div><h2 className="font-bold text-slate-900">Category results</h2><p className="text-xs text-slate-500">{products.length ? `${products.length} products in this category${selectedProducts.length ? ` · ${selectedProducts.length} selected for comparison` : ''}` : 'Your category results will appear here'}</p></div></div><ViewToggle view={view} onChange={setView} /></div>
        {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading && !products.length && <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map(item => <SkeletonCard key={item} />)}</div>}
        {!loading && !products.length && <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><Sparkles className="mx-auto mb-3 text-indigo-300" size={30} /><p className="font-semibold text-slate-700">Your category results will show up here</p><p className="mt-2 max-w-xs text-sm text-slate-500">Ask about a product category, upload a product photo, or add a PDF spec sheet to get started.</p></div></div>}
        {!!products.length && view === 'cards' && <div className="grid gap-4 sm:grid-cols-2">{products.map((product, index) => <ProductCard key={`${product.name}-${index}`} product={product} selected={selected(product)} onToggleComparison={onToggleComparison} />)}</div>}
        {!!products.length && view === 'table' && <ComparisonTable products={comparisonProducts} />}
      </section>
    </div>
  </main>
}
