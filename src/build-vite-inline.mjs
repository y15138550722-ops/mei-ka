import childProcess from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const originalExec = childProcess.exec
childProcess.exec = (command, options, callback) => {
  if (String(command).trim().toLowerCase() === 'net use') {
    const done = typeof options === 'function' ? options : callback
    queueMicrotask(() => done?.(null, '', ''))
    return {
      stdout: null,
      stderr: null,
      stdin: null,
      kill() {},
      on() {
        return this
      },
      once() {
        return this
      },
    }
  }

  return originalExec(command, options, callback)
}
syncBuiltinESMExports()

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')

function loadLocalEnvValue(key) {
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function normalizeImageInput(value) {
  if (typeof value !== 'string') return ''
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  if (trimmedValue.startsWith('data:image/')) return trimmedValue
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue
  return ''
}

function parseJsonFromText(value) {
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

function typescriptTransformPlugin() {
  return {
    name: 'meika-typescript-transform',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0]
      if (!/\.[cm]?[tj]sx?$/.test(cleanId) || cleanId.includes('/node_modules/')) {
        return null
      }

      const result = ts.transpileModule(code, {
        fileName: cleanId,
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          useDefineForClassFields: true,
          importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
          sourceMap: true,
        },
      })

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      }
    },
  }
}

const { build } = await import('vite')

await build({
  configFile: false,
  plugins: [localImageTextRecognitionPlugin(), typescriptTransformPlugin()],
  publicDir: '../docs',
  oxc: false,
  build: {
    minify: false,
  },
})
