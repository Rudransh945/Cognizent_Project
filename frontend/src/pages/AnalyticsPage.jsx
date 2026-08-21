import { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getHistory } from '../api'
import ExportButton from '../components/analytics/ExportButton'
import PriceChart from '../components/analytics/PriceChart'
import SessionTimeline from '../components/analytics/SessionTimeline'
import SpecRadarChart from '../components/analytics/SpecRadarChart'
import SpecBreakdownBars from '../components/analytics/SpecBreakdownBars'
import StatCard from '../components/analytics/StatCard'
import ValueScatterPlot from '../components/analytics/ValueScatterPlot'

const priceNumber = price => Number(String(price || '').replace(/[^0-9.]/g, '')) || 0
const shortName = name => name.length > 18 ? `${name.slice(0, 18)}…` : name
const numberFrom = value => {
  const match = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}
const fieldId = key => key.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Preserve the actual spec names without imposing a fixed schema. */
const buildSpecFields = products => {
  const fields = new Map()
  products.forEach((product, productIndex) => Object.entries(product.specs || {}).forEach(([key, value]) => {
    if (!value) return
    const id = fieldId(key)
    if (!id) return
    const field = fields.get(id) || { id, label: key, values: Array(products.length).fill('') }
    field.values[productIndex] = value
    fields.set(id, field)
  }))
  return [...fields.values()]
    .sort((a, b) => b.values.filter(Boolean).length - a.values.filter(Boolean).length)
    .slice(0, 8)
}

/** Numeric axes are relative comparisons only: the app does not claim that every larger number is better. */
const buildRadarData = fields => fields
  .map(field => ({ ...field, numbers: field.values.map(numberFrom) }))
  .filter(field => field.numbers.filter(value => value !== null).length >= 2)
  .slice(0, 6)
  .map(field => {
    const known = field.numbers.filter(value => value !== null)
    const low = Math.min(...known)
    const high = Math.max(...known)
    return {
      attribute: field.label,
      ...Object.fromEntries(field.numbers.map((value, index) => [
        `p${index}`, value === null ? 0 : high === low ? 100 : Math.round(((value - low) / (high - low)) * 100),
      ])),
    }
  })

const SourceBreakdownChart = ({ data }) => {
  if (!data.length) return <section className="chart-card"><h2>Retailer breakdown</h2><p className="chart-caption">Retailer information will appear here when listings provide a source.</p></section>
  return <section className="chart-card"><h2>Retailer breakdown</h2><p className="chart-caption">Listings grouped by their reported retailer or source.</p><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 12, right: 20, left: 12, bottom: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="source" width={110} tick={{ fontSize: 11 }} /><Tooltip formatter={value => [value, 'Listings']} /><Bar dataKey="count" fill="#4f46e5" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div></section>
}

export default function AnalyticsPage({ sessionId, products, selectedProducts, messages }) {
  const [history, setHistory] = useState(messages)
  useEffect(() => { if (sessionId) getHistory(sessionId).then(result => setHistory(result.data)).catch(() => {}) }, [sessionId])

  // Selection is global to the dashboard: it controls price, coverage, and feature views together.
  const activeProducts = selectedProducts.length ? selectedProducts : products
  const specFields = useMemo(() => buildSpecFields(activeProducts), [activeProducts])
  const priced = useMemo(() => activeProducts
    .map((product, index) => ({
      ...product,
      id: `${product.name}-${index}`,
      price: priceNumber(product.price),
      shortName: shortName(product.name),
      score: Object.values(product.specs || {}).filter(Boolean).length,
    }))
    .filter(product => product.price), [activeProducts])
  const rated = useMemo(() => activeProducts
    .map((product, index) => ({
      id: `${product.name}-${index}`,
      name: product.name,
      price: priceNumber(product.price),
      rating: product.rating,
      ratingCount: Number(product.rating_count) || 0,
    }))
    .filter(product => product.price && product.rating != null), [activeProducts])
  const sources = useMemo(() => [...activeProducts.reduce((groups, product) => {
    const source = product.source || 'Unspecified source'
    groups.set(source, (groups.get(source) || 0) + 1)
    return groups
  }, new Map()).entries()].map(([source, count]) => ({ source, count })), [activeProducts])
  const radarData = useMemo(() => buildRadarData(specFields), [specFields])

  if (!products.length) return <main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-5"><div className="max-w-md text-center"><span className="mx-auto grid w-fit rounded-2xl bg-indigo-50 p-4 text-indigo-600"><BarChart3 size={34} /></span><h1 className="mt-6 text-3xl font-black text-slate-950">Your insights will grow here</h1><p className="mt-3 leading-7 text-slate-600">Start a chat to see your comparison analytics here. We’ll turn session listings into helpful price and spec views.</p><Link to="/chat" className="mt-7 inline-block rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">Start a chat</Link></div></main>

  const prices = priced.map(item => item.price)
  const low = prices.length ? Math.min(...prices) : 0
  const high = prices.length ? Math.max(...prices) : 0
  const average = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0
  const scopeMessage = selectedProducts.length
    ? `Showing only the ${activeProducts.length} product${activeProducts.length === 1 ? '' : 's'} you added to comparison.`
    : `Showing all ${activeProducts.length} products in this chat. Add products to comparison to focus every chart.`

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Session intelligence</p><h1 className="mt-1 text-3xl font-black text-slate-950">Comparison analytics</h1><p className="mt-2 text-slate-600">{scopeMessage}</p></div><ExportButton /></div>
    <details className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-800"><span>Conversation timeline</span><span className="text-xs font-semibold text-indigo-600">Show session history</span></summary><div className="mt-4"><SessionTimeline history={history} /></div></details>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Lowest price" value={prices.length ? `₹${low.toLocaleString('en-IN')}` : 'Unavailable'} detail="Among priced listings" /><StatCard label="Highest price" value={prices.length ? `₹${high.toLocaleString('en-IN')}` : 'Unavailable'} detail="Among priced listings" /><StatCard label="Average price" value={prices.length ? `₹${average.toLocaleString('en-IN')}` : 'Unavailable'} detail="Priced listings only" /><StatCard label="Price range" value={prices.length ? `₹${(high - low).toLocaleString('en-IN')}` : 'Unavailable'} detail={`${activeProducts.length} products in scope`} /></section>
    <section className="mt-7 grid gap-6 xl:grid-cols-2"><PriceChart data={[...priced].sort((a, b) => a.price - b.price)} /><ValueScatterPlot data={rated} /></section>
    <section className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><SpecRadarChart data={radarData} products={activeProducts} /><SpecBreakdownBars fields={specFields} products={activeProducts} /></section>
    <section className="mt-7"><SourceBreakdownChart data={sources} /></section>
  </main>
}
