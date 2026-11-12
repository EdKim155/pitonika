import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8420'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

async function shot(name) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

async function typeIntoEditor(text) {
  const editor = page.locator('.monaco-editor').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(text)
}

// чистый профиль
await context.request.post(`${BASE}/api/dev/reset`)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForURL('**/welcome')
await page.fill('input[placeholder="Например, Эдгар"]', 'Аня')
await page.getByRole('button', { name: 'Далее' }).click()
await page.getByRole('button', { name: /С нуля для себя/ }).click()
await page.getByRole('button', { name: 'Далее' }).click()
await page.getByRole('button', { name: /Совсем с нуля/ }).click()
await page.getByRole('button', { name: 'Далее' }).click()
await page.getByRole('button', { name: /Автоматизация/ }).click()
await page.getByRole('button', { name: 'Далее' }).click()
await shot('05b-onboarding-ready')
await page.getByRole('button', { name: 'Начать обучение' }).click()
await page.waitForURL('**/path', { timeout: 15000 })
await shot('06-path')

await page.getByRole('link', { name: /Первая программа/ }).first().click()
await page.waitForURL('**/lesson/**')
await page.waitForTimeout(600)
await shot('07-lesson-theory')

await page.getByRole('button', { name: 'Понятно' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(500)
await shot('08-lesson-quiz')

await page.locator('button[role="radio"]').first().click()
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(900)
await shot('09-lesson-result')

await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(500)
await page.locator('button[role="radio"]').nth(1).click()
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(500)
await shot('10-lesson-blank')

await page.locator('input[aria-label="Пропуск 1"]').fill('"Python"')
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(500)
await shot('11-lesson-errors-theory')

await page.getByRole('button', { name: 'Понятно' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(1800)
await shot('12-lesson-code')

await typeIntoEditor('print("Привет, мир!")')
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(1200)
await shot('13-lesson-code-result')

await page.getByRole('button', { name: 'Дальше' }).click()
await page.waitForTimeout(1800)
await typeIntoEditor('print("Первая строка")\nprint("Вторая строка")')
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(1200)
await shot('14-lesson-last-result')

await page.getByRole('button', { name: 'Завершить урок' }).click()
await page.waitForTimeout(900)
await shot('15-lesson-complete')

await page.goto(`${BASE}/path`, { waitUntil: 'networkidle' })
await shot('16-path-after')

await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('17-progress')

await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle' })
await shot('18-practice')

await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
await shot('19-review')

await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' })
await shot('20-projects')

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
await shot('21-settings')

await page.goto(`${BASE}/playground`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await shot('22-playground')

await page.getByRole('button', { name: /Наставник/ }).click()
await page.waitForTimeout(700)
await shot('23-ai-panel')

await page.getByRole('button', { name: 'Закрыть наставника' }).click()
await page.waitForTimeout(400)

// мобильный вид
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/path`, { waitUntil: 'networkidle' })
await shot('24-mobile-path')
await page.goto(`${BASE}/lesson/m0.l1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await shot('25-mobile-lesson')

console.log('done. URL:', page.url())
if (errors.length) {
  console.log('ERRORS:')
  for (const error of errors.slice(0, 30)) console.log(' -', error)
} else {
  console.log('no console errors')
}
await browser.close()
