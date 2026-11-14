import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppGate from './components/AppGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppGate><App /></AppGate>
  </StrictMode>,
)
