import { Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

const palette = ['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#84cc16', '#ec4899']

export default function SpecRadarChart({ data, products }) {
  if (!data.length) return <section className="chart-card"><h2>Comparable numeric features</h2><p className="chart-caption">There are not yet two listings with the same source-confirmed numeric feature to plot.</p></section>
  return <section className="chart-card"><h2>Comparable numeric features</h2><p className="chart-caption">Axes are the actual shared fields found for these products. Values are relative for comparison, not a universal “better” score.</p><div className="h-80"><ResponsiveContainer width="100%" height="100%"><RadarChart data={data}><PolarGrid /><PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11 }} /><Tooltip />{products.map((product, index) => <Radar key={`${product.name}-${index}`} name={product.name} dataKey={`p${index}`} stroke={palette[index % palette.length]} fill={palette[index % palette.length]} fillOpacity={0.1} />)}<Legend wrapperStyle={{ fontSize: 11 }} /></RadarChart></ResponsiveContainer></div></section>
}
