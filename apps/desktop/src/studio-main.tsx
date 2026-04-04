import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import './styles/studio.css'
import StudioApp from './components/studio/StudioApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudioApp />
  </React.StrictMode>,
)
