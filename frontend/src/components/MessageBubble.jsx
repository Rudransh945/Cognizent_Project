/** Render one user or assistant chat bubble. */
export default function MessageBubble({ role, content }) {
  const user = role === 'user'
  return <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
    <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${user ? 'rounded-br-sm bg-violet-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-700'}`}>{content}</p>
  </div>
}
