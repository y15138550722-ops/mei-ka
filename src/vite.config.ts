import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appRoutePrefixes = ['/login', '/agent-system', '/license-officer', '/orders', '/order-management', '/products', '/notary']

function shouldFallbackToIndex(url = '') {
  const { pathname } = new URL(url, 'http://meika.local')

  if (pathname === '/') {
    return true
  }

  if (pathname.split('/').pop()?.includes('.')) {
    return false
  }

  return appRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function rootIndexFallbackPlugin() {
  return {
    name: 'meika-root-index-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (shouldFallbackToIndex(req.url)) {
          const search = req.url?.includes('?') ? `?${req.url.split('?').slice(1).join('?')}` : ''
          req.url = `/index.html${search}`
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [rootIndexFallbackPlugin(), react()],
  publicDir: '../docs',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: true,
  },
})
