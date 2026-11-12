import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8420'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

async function shot(name) {
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log('shot', name)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await shot('01-onboarding-name')

await page.fill('input[placeholder="Например, Эдгар"]', 'Эдгар')
await page.getByRole('button', { name: 'Далее' }).click()
await shot('02-onboarding-goal')

await page.getByRole('button', { name: /С нуля для себя/ }).click()
await page.getByRole('button', { name: 'Далее' }).click()
await shot('03-onboarding-time')

await page.getByRole('button', { name: 'Далее' }).click()
await shot('04-onboarding-interests')

await page.getByRole('button', { name: /Автоматизация/ }).click()
await page.getByRole('button', { name: 'Далее' }).click()
await shot('05-onboarding-ready')

await page.getByRole('button', { name: 'Начать обучение' }).click()
await page.waitForURL('**/path', { timeout: 15000 })
await shot('06-path')

await page.locator('a[href^="/lesson/"]').first().click()
await page.waitForURL('**/lesson/**', { timeout: 15000 })
await shot('07-lesson-theory')

await page.getByRole('button', { name: 'Понятно' }).click()
await page.waitForTimeout(600)
await shot('08-lesson-quiz')

const option = page.locator('button[role="radio"]').first()
await option.click()
await page.getByRole('button', { name: 'Проверить' }).click()
await page.waitForTimeout(900)
await shot('09-lesson-result')

await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' })
await shot('10-progress')

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
await shot('11-settings')

await page.goto(`${BASE}/playground`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await shot('12-playground')

console.log('URL', page.url())
if (errors.length) {
  console.log('ERRORS:')
  for (const error of errors.slice(0, 20)) console.log(' -', error)
} else {
  console.log('no console errors')
}
await browser.close()
