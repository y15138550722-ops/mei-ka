import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')

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

function loadLocalEnvValue(key: string) {
  const envFiles = [
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
    path.join(currentDir, '.env.local'),
    path.join(currentDir, '.env'),
  ]

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) continue

    const matchedLine = fs
      .readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith(`${key}=`))

    if (matchedLine) {
      return matchedLine.slice(matchedLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }

  return process.env[key] || ''
}

function readJsonBody(req: import('node:http').IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: import('node:http').ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function normalizeImageInput(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  if (trimmedValue.startsWith('data:image/')) return trimmedValue
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue
  return ''
}

function parseJsonFromText(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    const matchedJson = text.match(/\{[\s\S]*\}/)
    return matchedJson ? JSON.parse(matchedJson[0]) : {}
  }
}

function localImageTextRecognitionPlugin() {
  return {
    name: 'meika-local-image-text-recognition-api',
    configureServer(server) {
      server.middlewares.use('/api/ocr/domestic-license', async (req, res) => {
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST')
          sendJson(res, 405, { error: 'Method Not Allowed' })
          return
        }

        const apiKey = loadLocalEnvValue('OPENAI_API_KEY')
        if (!apiKey) {
          sendJson(res, 501, { error: '图片文案识别服务未配置，请在 .env.local 中配置 OPENAI_API_KEY' })
          return
        }

        try {
          const body = await readJsonBody(req)
          const images = [normalizeImageInput(body.frontPhoto), normalizeImageInput(body.backPhoto)].filter(Boolean).slice(0, 2)

          if (images.length === 0) {
            sendJson(res, 400, { error: '请先上传驾照正面照片或驾照反面照片' })
            return
          }

          const ocrResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: loadLocalEnvValue('OPENAI_OCR_MODEL') || 'gpt-4.1-mini',
              input: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: [
                        'Strictly read ONLY visible text from the uploaded driver license images.',
                        'Preserve the source language and wording in originalText.',
                        'Translate each originalText into Simplified Chinese.',
                        'Return JSON only: { "rows": [{ "label": "", "originalText": "", "translatedText": "" }] }.',
                      ].join('\n'),
                    },
                    ...images.map((imageUrl) => ({ type: 'input_image', image_url: imageUrl, detail: 'high' })),
                  ],
                },
              ],
            }),
          })
          const result = await ocrResponse.json()

          if (!ocrResponse.ok) {
            sendJson(res, ocrResponse.status, { error: result?.error?.message || '图片文案识别请求失败' })
            return
          }

          const parsedOutput = parseJsonFromText(result.output_text)
          sendJson(res, 200, {
            provider: 'openai',
            rows: Array.isArray(parsedOutput.rows) ? parsedOutput.rows : [],
            rawOutput: result.output_text || '',
          })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : '图片文案识别请求失败' })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [localImageTextRecognitionPlugin(), rootIndexFallbackPlugin(), react()],
  publicDir: '../docs',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: true,
  },
})
