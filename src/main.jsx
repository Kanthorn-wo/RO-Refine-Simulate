import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Dashboard แยก chunk (recharts + supabase) ไม่ให้บวม main bundle ของหน้าหลัก
const Dashboard = lazy(() => import('./dashboard/Dashboard.jsx'))

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={null}>
            <Dashboard />
          </Suspense>
        }
      />
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>
)
