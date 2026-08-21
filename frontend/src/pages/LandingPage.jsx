import { ArrowRight, BotMessageSquare, FileText, SearchCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  [SearchCheck, 'Live Price Search', 'Fresh shopping listings, with source links and prices kept visible.'],
  [BotMessageSquare, 'Photo-Based Search', 'Upload a product photo and start from what is actually in front of you.'],
  [FileText, 'PDF Spec Comparison', 'Turn a spec sheet into a grounded comparison without the spreadsheet work.'],
]

export default function LandingPage({ onNewChat }) {
  return <main>
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-teal-50 px-5 py-20 sm:py-28">
      <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div><p className="mb-5 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700"><Sparkles size={16} /> Shopping, with context</p>
          <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">Find your perfect product, faster.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">ProductGenie searches live listings, remembers what matters to you, and explains the trade-offs in plain language.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/chat" onClick={onNewChat} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">Start comparing <ArrowRight size={18} /></Link><Link to="/analytics" className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">See analytics</Link></div>
        </div>
        <div className="relative mx-auto w-full max-w-xl rounded-3xl border border-white bg-white/80 p-4 shadow-2xl shadow-indigo-200/60 backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl bg-slate-900 p-5 text-white"><div className="mb-8 flex items-center gap-2 text-sm font-bold"><BotMessageSquare size={18} /> ProductGenie</div><p className="rounded-2xl rounded-tl-sm bg-white/10 p-3 text-sm">I need a laptop for coding under ₹65,000.</p><p className="mt-3 rounded-2xl rounded-br-sm bg-indigo-500 p-3 text-sm">I’ll focus on RAM and processor details from live listings.</p></div><div className="space-y-3 rounded-2xl bg-slate-100 p-3"><p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Live matches</p>{['Top pick · ₹59,990', 'Value option · ₹54,499'].map((label, index) => <div className="rounded-xl bg-white p-3 shadow-sm" key={label}><div className={`mb-3 h-16 rounded-lg ${index ? 'bg-teal-100' : 'bg-indigo-100'}`} /><p className="text-xs font-bold text-slate-700">{label}</p></div>)}</div></div>
        </div>
      </div>
    </section>
    <section id="about" className="mx-auto max-w-7xl px-5 py-20"><div className="mx-auto mb-12 max-w-2xl text-center"><h2 className="text-3xl font-black text-slate-950">Decisions backed by the details</h2><p className="mt-3 text-slate-600">Everything ProductGenie shows is tied back to a live listing or document you supplied.</p></div><div className="grid gap-5 md:grid-cols-3">{features.map(([Icon, title, text]) => <article className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-100" key={title}><span className="inline-grid rounded-xl bg-indigo-50 p-3 text-indigo-600"><Icon size={24} /></span><h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}</div></section>
  </main>
}
