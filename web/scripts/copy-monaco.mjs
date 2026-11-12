import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'node_modules/monaco-editor/min/vs')
const target = resolve(root, 'public/monaco/vs')

if (!existsSync(source)) {
  console.warn('[monaco] не найден node_modules/monaco-editor — пропускаю копирование')
  process.exit(0)
}
if (existsSync(target) && !process.argv.includes('--force')) {
  process.exit(0)
}
mkdirSync(dirname(target), { recursive: true })
cpSync(source, target, { recursive: true })
console.log('[monaco] скопирован в public/monaco/vs')
