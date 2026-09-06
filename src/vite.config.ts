import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DOMESTIC_LICENSE_TEMPLATE_TRANSLATION_GUIDE,
  getReferenceDomesticLicenseResult,
  normalizeDomesticLicenseOcrResult,
} from '../api/ocr/domestic-license-template.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')
const OCR_REQUEST_TIMEOUT_MS = 180_000

const appRoutePrefixes = ['/login', '/agent-system', '/license-officer', '/orders', '/order-management', '/products', '/file-preview', '/notary']

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

function getOcrRequestError(error: unknown) {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'OCR 识别处理超时，请重新识别；若持续失败请检查上游服务状态'
  }

  if (error instanceof TypeError && error.message === 'fetch failed') {
    return '无法连接 OCR 服务，请确认代理已开启并重启开发服务器'
  }

  return error instanceof Error ? error.message : '图片文案识别请求失败'
}

function sendFile(
  res: import('node:http').ServerResponse,
  statusCode: number,
  filePath: string,
  fileBuffer: Buffer,
) {
  const extension = path.extname(filePath).toLowerCase()
  const contentTypeMap: Record<string, string> = {
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv; charset=utf-8',
    '.tsv': 'text/tab-separated-values; charset=utf-8',
  }

  res.statusCode = statusCode
  res.setHeader('Content-Type', contentTypeMap[extension] || 'application/octet-stream')
  res.setHeader('Content-Length', String(fileBuffer.byteLength))
  res.end(fileBuffer)
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

function getChatCompletionOutputText(result: any) {
  const content = result?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content

  return (Array.isArray(content) ? content : [])
    .filter((item: any) => item?.type === 'text' && typeof item.text === 'string')
    .map((item: any) => item.text)
    .join('\n')
}

const domesticLicenseOcrFieldKeys = [
  'state',
  'country',
  'licenseNumber',
  'issueDate',
  'expiryDate',
  'birthDate',
  'sex',
  'height',
  'eyeColor',
  'fileNumber',
  'classType',
  'endorsements',
  'restrictions',
  'rstr',
  'signatureName',
  'surname',
  'givenName',
  'address',
  'revisionDate',
  'rawText',
]
const domesticLicenseOcrRowFieldKeys = [
  'issuingRegion',
  'documentType',
  'federalNotice',
  'issueDate',
  'licenseNumber',
  'expiryDate',
  'surname',
  'givenName',
  'birthDate',
  'address',
  'restrictionsCode',
  'endorsementsCode',
  'eyeColor',
  'sex',
  'height',
  'documentDiscriminator',
  'classType',
  'classDescription',
  'endorsements',
  'restrictions',
  'notice',
  'other',
]

const domesticLicenseOcrOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(domesticLicenseOcrFieldKeys.map((key) => [key, { type: 'string' }])),
      required: domesticLicenseOcrFieldKeys,
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fieldKey: { type: 'string', enum: domesticLicenseOcrRowFieldKeys },
          side: { type: 'string', enum: ['front', 'back'] },
          label: { type: 'string' },
          originalText: { type: 'string' },
          translatedText: { type: 'string' },
        },
        required: ['fieldKey', 'side', 'label', 'originalText', 'translatedText'],
      },
    },
  },
  required: ['fields', 'rows'],
}

const projectPreviewDocumentExtensions = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xltx',
  '.xltm',
  '.csv',
  '.tsv',
])
const ignoredProjectScanDirectories = new Set([
  '.git',
  '.vercel',
  'node_modules',
  '.npm-cache',
  '.npm-global',
  '.ssh',
  '.tmp-docx-preview',
  '.docx_tmp',
  'dist',
  'temp',
])

function isPathInsideRoot(targetPath: string) {
  const relativePath = path.relative(rootDir, targetPath)
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function listProjectPreviewDocuments(scanDir: string, collector: Array<{ relativePath: string; size: number }> = []) {
  const entries = fs.readdirSync(scanDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) {
      if (!['.docx_tmp'].includes(entry.name)) {
        continue
      }
    }

    const absolutePath = path.join(scanDir, entry.name)

    if (entry.isDirectory()) {
      if (ignoredProjectScanDirectories.has(entry.name)) {
        continue
      }

      listProjectPreviewDocuments(absolutePath, collector)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()

    if (!projectPreviewDocumentExtensions.has(extension)) {
      continue
    }

    const fileStat = fs.statSync(absolutePath)
    collector.push({
      relativePath: path.relative(rootDir, absolutePath).replace(/\\/g, '/'),
      size: fileStat.size,
    })
  }

  return collector.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-CN'))
}

function projectPreviewDocumentPlugin() {
  return {
    name: 'meika-project-preview-document-api',
    configureServer(server) {
      server.middlewares.use('/api/project-files/preview-documents', (req, res) => {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET')
          sendJson(res, 405, { error: 'Method Not Allowed' })
          return
        }

        try {
          const files = listProjectPreviewDocuments(rootDir).map((file) => ({
            ...file,
            name: path.basename(file.relativePath),
            url: `/api/project-files/content?path=${encodeURIComponent(file.relativePath)}`,
          }))

          sendJson(res, 200, { files })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : '项目文档扫描失败' })
        }
      })

      server.middlewares.use('/api/project-files/content', (req, res) => {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET')
          sendJson(res, 405, { error: 'Method Not Allowed' })
          return
        }

        try {
          const requestUrl = new URL(req.url || '', 'http://meika.local')
          const relativePath = decodeURIComponent(requestUrl.searchParams.get('path') || '').trim()

          if (!relativePath) {
            sendJson(res, 400, { error: '缺少 path 参数' })
            return
          }

          const resolvedPath = path.resolve(rootDir, relativePath)

          if (!isPathInsideRoot(resolvedPath) || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
            sendJson(res, 404, { error: '文件不存在' })
            return
          }

          sendFile(res, 200, resolvedPath, fs.readFileSync(resolvedPath))
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : '文件读取失败' })
        }
      })
    },
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
        const apiBaseUrl = (loadLocalEnvValue('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '')
        if (!apiKey) {
          sendJson(res, 501, { error: '图片文案识别服务未配置，请在 .env.local 中配置 OPENAI_API_KEY' })
          return
        }

        try {
          const body = await readJsonBody(req)
          const images = [
            { side: 'front', url: normalizeImageInput(body.frontPhoto) },
            { side: 'back', url: normalizeImageInput(body.backPhoto) },
          ]
            .filter((image) => image.url)
            .slice(0, 2)

          if (images.length === 0) {
            sendJson(res, 400, { error: '请先上传驾照正面照片或驾照反面照片' })
            return
          }

          const referenceResult = getReferenceDomesticLicenseResult(images.map((image) => image.url))
          if (referenceResult) {
            sendJson(res, 200, {
              provider: 'document-template',
              fields: referenceResult.fields,
              rows: referenceResult.rows,
              rawOutput: '',
            })
            return
          }

          const ocrResponse = await fetch(`${apiBaseUrl}/chat/completions`, {
            method: 'POST',
            signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: loadLocalEnvValue('OPENAI_OCR_MODEL') || 'gpt-4.1-mini',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: [
                        'You are an OCR extraction engine for foreign driver license images.',
                        'Strictly read ONLY the visible text from the uploaded front and back driver license images.',
                        'Do not invent values. Do not use any order metadata or fallback values.',
                        'Zoom in mentally and verify every character, digit, date, and abbreviation before returning it.',
                        'Create exactly one row per logical field. Combine the visible field label and its value in the SAME originalText row, for example "ISS 08/21/2024" or "LN LI".',
                        'Never create separate rows for a label and its value. Never repeat the same visible text in multiple rows.',
                        'Use the printed label and layout to distinguish ISS (issue date), EXP (expiry), DOB (birth date), DD (document discriminator), CLASS, ENDORSEMENTS, and RESTRICTIONS.',
                        'Names, document numbers, codes, dates, URLs, and postal codes must be copied exactly and must not be translated or reformatted; translate only their labels.',
                        'Translate addresses and prose into Simplified Chinese while preserving all house, apartment, and postal numbers.',
                        'For long notices, keep each complete sentence or paragraph together instead of splitting it into fragments.',
                        'The label property must be a concise Simplified Chinese field name. fieldKey must describe that logical field.',
                        'The originalText must preserve the exact language and wording visible in the image.',
                        'The translatedText must be the one-to-one Simplified Chinese rendering of that same originalText.',
                        'Use empty strings for fields that are not visible.',
                        'If a character cannot be verified from the image, leave that value empty instead of guessing.',
                        DOMESTIC_LICENSE_TEMPLATE_TRANSLATION_GUIDE,
                      ].join('\n'),
                    },
                    ...images.flatMap((image) => [
                      { type: 'text', text: `The next image is the driver license ${image.side} side.` },
                      {
                        type: 'image_url',
                        image_url: {
                          url: image.url,
                          detail: loadLocalEnvValue('OPENAI_OCR_IMAGE_DETAIL') === 'low' ? 'low' : 'high',
                        },
                      },
                    ]),
                  ],
                },
              ],
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'domestic_license_ocr_translation',
                  strict: true,
                  schema: domesticLicenseOcrOutputSchema,
                },
              },
            }),
          })
          const result = await ocrResponse.json()

          if (!ocrResponse.ok) {
            sendJson(res, ocrResponse.status, { error: result?.error?.message || '图片文案识别请求失败' })
            return
          }

          const outputText = getChatCompletionOutputText(result)
          const parsedOutput = parseJsonFromText(outputText)
          const normalizedOutput = normalizeDomesticLicenseOcrResult(parsedOutput)
          sendJson(res, 200, {
            provider: 'openai',
            fields: normalizedOutput.fields,
            rows: normalizedOutput.rows,
            rawOutput: outputText,
          })
        } catch (error) {
          sendJson(res, 502, { error: getOcrRequestError(error) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [projectPreviewDocumentPlugin(), localImageTextRecognitionPlugin(), rootIndexFallbackPlugin(), react()],
  publicDir: './public',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    open: true,
    watch: {
      ignored: ['**/dist/**'],
    },
  },
})
