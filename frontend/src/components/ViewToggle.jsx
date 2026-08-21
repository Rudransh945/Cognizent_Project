import { LayoutGrid, TableProperties } from 'lucide-react'

/** Switch live results between visual cards and compact table. */
export default function ViewToggle({ view, onChange }) { return <div className="flex rounded-xl bg-slate-100 p-1"><button onClick={() => onChange('cards')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><LayoutGrid className="mr-1 inline" size={14} />Cards</button><button onClick={() => onChange('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><TableProperties className="mr-1 inline" size={14} />Table</button></div> }
