import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const localUrlPattern = /(https?:\/\/)(?:localhost|\[::1\]):/g

function wrapStreamWrite(stream) {
  const originalWrite = stream.write.bind(stream)

  stream.write = (chunk, encoding, callback) => {
    let nextEncoding = encoding
    let nextCallback = callback

    if (typeof nextEncoding === 'function') {
      nextCallback = nextEncoding
      nextEncoding = undefined
    }

    let nextChunk = chunk

    if (typeof chunk === 'string') {
      nextChunk = chunk.replace(localUrlPattern, '$1127.0.0.1:')
    } else if (Buffer.isBuffer(chunk)) {
      nextChunk = Buffer.from(
        chunk.toString('utf8').replace(localUrlPattern, '$1127.0.0.1:'),
        'utf8',
      )
    }

    return originalWrite(nextChunk, nextEncoding, nextCallback)
  }
}

wrapStreamWrite(process.stdout)
wrapStreamWrite(process.stderr)

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)
const viteBinPath = path.join(currentDirPath, 'node_modules', 'vite', 'bin', 'vite.js')

process.argv = [process.argv[0], viteBinPath, ...process.argv.slice(2)]

await import(pathToFileURL(viteBinPath).href)
