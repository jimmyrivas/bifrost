import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { UnlockScreen } from './components/settings/UnlockScreen'
import './i18n'
import './assets/main.css'

// The pre-boot unlock window (DB encrypted at rest) loads with a `#unlock` hash
// and must render before the app touches the (still-encrypted) database.
const Root = window.location.hash === '#unlock' ? UnlockScreen : App

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
