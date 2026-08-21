import { BarChart3, Bot, MessageSquare, Plus, Sparkles } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

/** Shared responsive site navigation for landing, chat, and analytics routes. */
export default function Navbar({ onNewChat }) {
  const linkClass = ({ isActive }) => `text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-slate-600 hover:text-indigo-700'}`
  return <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
      <Link to="/" className="flex items-center gap-2 font-bold text-slate-900"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Sparkles size={17} /></span>ProductGenie</Link>
      <div className="flex items-center gap-3 sm:gap-5"><NavLink className={linkClass} to="/chat"><MessageSquare className="mr-1 inline" size={15} />Chat</NavLink><NavLink className={linkClass} to="/analytics"><BarChart3 className="mr-1 inline" size={15} />Analytics</NavLink><a className="hidden text-sm font-medium text-slate-600 hover:text-indigo-700 sm:block" href="#about">About</a><Link to="/chat" onClick={onNewChat} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"><Plus className="mr-1 inline" size={15} />New chat</Link></div>
    </nav>
  </header>
}
