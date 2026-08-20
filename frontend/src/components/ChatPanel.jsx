import { Send } from 'lucide-react'
import { useState } from 'react'
import MessageBubble from './MessageBubble'
import PhotoUpload from './PhotoUpload'
import PDFUpload from './PDFUpload'

/** Chat transcript, composer, and file controls for the active session. */
export default function ChatPanel({ messages, onSend, onPhoto, onPdf, loading, ready, hasProducts }) {
  const [message, setMessage] = useState('')
  const submit = e => { e.preventDefault(); const value = message.trim(); if (value && !loading && ready) { onSend(value); setMessage('') } }
  return <section className="flex min-h-[52vh] flex-col border-b border-slate-200 bg-white md:min-h-screen md:border-b-0 md:border-r">
      <div className="border-b border-slate-100 px-6 py-5"><p className="text-lg font-bold text-slate-900">ProductGenie</p><p className="text-xs text-slate-500">{ready ? 'AI comparison assistant · connected' : 'Connecting to ProductGenie API…'}</p></div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
      {messages.map((m, index) => <MessageBubble key={index} {...m} />)}
      {loading && <div className="w-36 animate-pulse rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-4 text-xs text-slate-400">Finding products…</div>}
      {ready && hasProducts && !loading && <div className="flex flex-wrap gap-2 pt-1">
        {['Compare the top two', 'Which is the best value?', 'What if my priority changes?'].map(prompt => <button key={prompt} type="button" onClick={() => onSend(prompt)} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100">{prompt}</button>)}
      </div>}
    </div>
    <form onSubmit={submit} className="border-t border-slate-100 p-4">
      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 focus-within:ring-2 focus-within:ring-violet-200">
        <PhotoUpload onSelect={onPhoto} disabled={loading || !ready} /><PDFUpload onSelect={onPdf} disabled={loading || !ready} />
        <input disabled={!ready} value={message} onChange={e => setMessage(e.target.value)} placeholder={ready ? 'Tell me your budget and what matters most…' : 'Waiting for API connection…'} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed" />
        <button disabled={loading || !ready || !message.trim()} className="rounded-lg bg-violet-600 p-2 text-white disabled:opacity-40"><Send size={18} /></button>
      </div>
    </form>
  </section>
}
