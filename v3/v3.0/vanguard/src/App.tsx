import { Routes, Route } from 'react-router-dom'
import Navbar from './components/shared/Navbar'
import Home from './pages/Home'
import QRScanner from './pages/QRScanner'
import Dashboard from './pages/Dashboard'
import Simulator from './pages/Simulator'
import NotFound from './pages/NotFound'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  useEffect(() => {
    async function test() {
      console.log('Testing Supabase connection...')
      const { data, error } = await supabase.from('machines').select('*')
      console.log('DATA:', data)
      console.log('ERROR:', error)
    }
    test()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<QRScanner />} />
          <Route path="/machine/:id" element={<Dashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

export default App