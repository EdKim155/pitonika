import { expect, test } from '@playwright/test'

test.beforeEach(async ({ request, page }) => {
  await request.post('/api/dev/reset')
  await page.goto('/')
  await page.waitForURL('**/welcome')
})

test('онбординг и первый урок до квиза', async ({ page }) => {
  await page.fill('input[placeholder="Например, Эдгар"]', 'Тест')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: /С нуля для себя/ }).click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Начать обучение' }).click()

  await expect(page).toHaveURL(/\/path/)
  await expect(page.getByRole('heading', { name: /Привет, Тест/ })).toBeVisible()

  await page.getByRole('link', { name: /Первая программа/ }).first().click()
  await expect(page.getByText('Программа — это инструкции')).toBeVisible()

  await page.getByRole('button', { name: 'Понятно' }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()

  await page.locator('button[role="radio"]').first().click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
})

test('навигация по разделам и прогресс', async ({ page, request }) => {
  await request.post('/api/profile/onboarding', {
    data: { name: 'Навигация', goal: 'base', dailyMinutes: 10, experience: 'zero', interests: [], timezone: 'Europe/Moscow' },
  })

  for (const [path, marker] of [
    ['/path', 'Программа'],
    ['/practice', 'Практика по слабым местам'],
    ['/review', 'На сегодня всё повторено'],
    ['/projects', 'Собери что-то настоящее'],
    ['/progress', 'Твой прогресс'],
    ['/settings', 'Всё под контролем'],
    ['/playground', 'Песочница'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByText(marker).first()).toBeVisible()
  }
})

test('офлайн-подсказка работает без модели', async ({ page, request }) => {
  await request.post('/api/profile/onboarding', { data: { name: 'Подсказки', experience: 'zero' } })
  await page.goto('/lesson/m0.l1?step=m0.l1.s6')
  await expect(page.getByRole('button', { name: 'Проверить' })).toBeVisible()
  const level = page.getByRole('button', { name: /0\/3/ })
  await level.click()
  await expect(page.getByText('Подсказки')).toBeVisible()
  await expect(page.getByRole('button', { name: /1\/3/ })).toBeVisible()
})
