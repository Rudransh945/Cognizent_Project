import { Download } from 'lucide-react'

export default function ExportButton() { return <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"><Download size={16} />Export comparison</button> }
