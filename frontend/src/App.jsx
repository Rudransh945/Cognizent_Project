import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { createSession, sendChat, uploadPdf, uploadPhoto } from './api'
import ChatPanel from './components/ChatPanel'
import ProductCard from './components/ProductCard'
import ComparisonTable from './components/ComparisonTable'

const welcome = { role: 'assistant', content: 'Hey! What are we shopping for today? Tell me your budget and the one thing that matters most to you.' }

/** Coordinate API session state, chat updates, and the live product panel. */
export default function App() {
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([welcome])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(true)
  useEffect(() => {
    createSession()
      .then(r => setSessionId(r.data.session_id))
      .catch(() => {
        const detail = 'Could not connect to the ProductGenie API. Start the backend on port 8000.'
        setError(detail)
        setMessages(m => [...m, { role: 'assistant', content: detail }])
      })
      .finally(() => setConnecting(false))
  }, [])
  const run = async (action, optimistic) => {
    if (!sessionId) {
      setError('The chat session is not ready. Refresh the page after the API starts.')
      return
    }
    setError(''); setLoading(true); if (optimistic) setMessages(m => [...m, optimistic])
    try { const { data } = await action(); setMessages(m => [...m, { role: 'assistant', content: data.response }]); setProducts(data.products || []) }
    catch (e) {
      const detail = e.response?.data?.detail || 'The request could not be completed. Please try again.'
      setError(detail)
      setMessages(m => [...m, { role: 'assistant', content: `I couldn't complete that request: ${detail}` }])
    }
    finally { setLoading(false) }
  }
  return <main className="min-h-screen bg-slate-50 text-slate-800 md:grid md:grid-cols-[2fr_3fr]">
    <ChatPanel messages={messages} loading={loading || connecting} ready={Boolean(sessionId)} hasProducts={products.length > 0} onSend={text => run(() => sendChat(sessionId, text), { role: 'user', content: text })} onPhoto={file => run(() => uploadPhoto(sessionId, file), { role: 'user', content: `Uploaded photo: ${file.name}` })} onPdf={file => run(() => uploadPdf(sessionId, file), { role: 'user', content: `Uploaded PDF: ${file.name}` })} />
    <section className="p-5 md:p-8"><div className="mb-6 flex items-center gap-2"><div className="rounded-lg bg-violet-100 p-2 text-violet-600"><Sparkles size={20} /></div><div><h1 className="font-bold">Live comparison</h1><p className="text-xs text-slate-500">Products found in this conversation</p></div></div>
      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading && !products.length && <div className="grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(x => <div className="h-44 animate-pulse rounded-xl bg-slate-200" key={x} />)}</div>}
      {!loading && !products.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Your live product cards and side-by-side comparison will appear here.</div>}
      {!!products.length && <><div className="grid gap-4 sm:grid-cols-2">{products.map((p, i) => <ProductCard key={`${p.name}-${i}`} product={p} />)}</div><div className="mt-7"><ComparisonTable products={products} /></div></>}
    </section>
  </main>
}
