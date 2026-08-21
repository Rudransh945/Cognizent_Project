import { FileText, ImagePlus, Send, UploadCloud } from 'lucide-react'
import { useState } from 'react'
import MessageBubble from './MessageBubble'

/** Conversational pane for researching one product category in the current chat. */
export default function ChatPanel({ messages, onSend, onPhoto, onPdf, loading, ready }) {
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const submit = event => { event.preventDefault(); const value = message.trim(); if (value && ready && !loading) { onSend(value); setMessage('') } }
  const upload = file => { if (!file) return; file.type === 'application/pdf' ? onPdf(file) : onPhoto(file) }
  return <section className="relative flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
    <div className="border-b border-slate-200 bg-white px-6 py-5"><p className="font-bold text-slate-900">Your product advisor</p><p className="mt-1 text-xs text-slate-500">{ready ? 'One product category per chat' : 'Connecting to ProductGenie…'}</p></div>
    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">{messages.map((message, index) => <MessageBubble key={index} {...message} />)}{loading && <div className="w-44 animate-pulse rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">Finding category results…</div>}</div>
    {dragging && <div className="absolute inset-0 z-10 grid place-items-center bg-indigo-700/90 text-center text-white"><div><UploadCloud className="mx-auto mb-3" size={34} /><p className="font-semibold">Drop a photo or PDF here</p><p className="mt-1 text-sm text-indigo-100">We’ll keep this chat focused on its category.</p></div></div>}
    <form onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files?.[0]) }} onSubmit={submit} className="border-t border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:ring-2 focus-within:ring-indigo-200"><label title="Upload product photo" className="cursor-pointer rounded-xl p-2 text-slate-500 hover:bg-white hover:text-indigo-600"><ImagePlus size={19} /><input className="hidden" type="file" accept="image/*" disabled={!ready || loading} onChange={event => upload(event.target.files?.[0])} /></label><label title="Upload a PDF spec sheet" className="cursor-pointer rounded-xl p-2 text-slate-500 hover:bg-white hover:text-indigo-600"><FileText size={19} /><input className="hidden" type="file" accept="application/pdf" disabled={!ready || loading} onChange={event => upload(event.target.files?.[0])} /></label><input value={message} disabled={!ready || loading} onChange={event => setMessage(event.target.value)} placeholder={ready ? 'Ask about this category…' : 'Waiting for the API…'} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed" /><button disabled={!ready || loading || !message.trim()} className="rounded-xl bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700 disabled:opacity-40"><Send size={18} /></button></div>
      {loading && <p className="mt-2 text-xs text-indigo-600">{messages.at(-1)?.content?.includes('Uploaded') ? 'Analyzing your upload…' : 'Finding and reviewing the product…'}</p>}
    </form>
  </section>
}
