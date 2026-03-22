/// <reference types="vite/client" />

import type { BifrostApi } from '../../preload/index'

declare global {
  interface Window {
    bifrost: BifrostApi
  }
}
