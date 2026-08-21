import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { createSession, sendChat, uploadPdf, uploadPhoto } from './api'
import Navbar from './components/Navbar'
import AnalyticsPage from './pages/AnalyticsPage'
import ChatPage from './pages/ChatPage'
import LandingPage from './pages/LandingPage'

const productKey = product => `${product.name}|${product.price}|${product.source}|${product.link}`
const welcome = { role: 'assistant', content: 'Hi, I’m ProductGenie. Tell me which product category you want to explore. Start a new chat before switching categories.' }

/** Own one product-category chat session across the app's routes. */
export default function App() {
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([welcome])
  const [products, setProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(true)
  const sessionEpoch = useRef(0)

  const startNewChat = async () => {
    sessionEpoch.current += 1
    setSessionId('')
    setMessages([welcome])
    setProducts([])
    setSelectedProducts([])
    setError('')
    setLoading(false)
    setConnecting(true)
    try {
      const { data } = await createSession()
      setSessionId(data.session_id)
    } catch {
      setError('Could not create a new ProductGenie session. Start the backend on port 8000 and try again.')
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => { startNewChat() }, [])

  const run = async (action, optimistic) => {
    if (!sessionId) {
      setError('The chat session is not ready. Refresh the page after the API starts.')
      return
    }
    const requestEpoch = sessionEpoch.current
    setError('')
    setLoading(true)
    if (optimistic) setMessages(items => [...items, optimistic])
    try {
      const { data } = await action()
      if (requestEpoch !== sessionEpoch.current) return
      const responseProducts = data.products || []
      if (responseProducts.length) setProducts(responseProducts.slice(0, 8))
      setMessages(items => [...items, { role: 'assistant', content: data.response, products: responseProducts.slice(0, 8), reasoningDepth: data.reasoning_depth || '' }])
    } catch (e) {
      if (requestEpoch !== sessionEpoch.current) return
      const detail = e.response?.data?.detail || 'The request could not be completed. Please try again.'
      setError(detail)
      setMessages(items => [...items, { role: 'assistant', content: `I couldn't complete that request: ${detail}` }])
    } finally {
      if (requestEpoch === sessionEpoch.current) setLoading(false)
    }
  }

  const toggleComparison = product => setSelectedProducts(current => {
    const selected = current.some(item => productKey(item) === productKey(product))
    return selected ? current.filter(item => productKey(item) !== productKey(product)) : [...current, product]
  })

  const shared = useMemo(() => ({
    sessionId, messages, products, selectedProducts, loading, connecting, error,
    onSend: text => run(() => sendChat(sessionId, text, selectedProducts), { role: 'user', content: text }),
    onPhoto: file => run(() => uploadPhoto(sessionId, file), { role: 'user', content: `Uploaded photo: ${file.name}` }),
    onPdf: file => run(() => uploadPdf(sessionId, file), { role: 'user', content: `Uploaded PDF: ${file.name}` }),
    onToggleComparison: toggleComparison,
    onNewChat: startNewChat,
  }), [sessionId, messages, products, selectedProducts, loading, connecting, error])

  return <BrowserRouter><div className="min-h-screen bg-slate-50 text-slate-800"><Navbar onNewChat={startNewChat} /><Routes>
    <Route path="/" element={<LandingPage onNewChat={startNewChat} />} /><Route path="/chat" element={<ChatPage {...shared} />} />
    <Route path="/analytics" element={<AnalyticsPage {...shared} />} /><Route path="*" element={<LandingPage onNewChat={startNewChat} />} />
  </Routes></div></BrowserRouter>
}
