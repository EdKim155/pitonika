import type { GradeResponse, Step } from '@/lib/types'

export interface SubmitPayload {
  code?: string
  stdin?: string
  answers?: (string | number)[]
  answer?: number
  order?: string[]
  text?: string
}

export interface StepViewProps {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: SubmitPayload) => void
}

export const STEP_LABELS: Record<Step['type'], string> = {
  theory: 'Теория',
  quiz: 'Вопрос',
  predict: 'Что выведет',
  blank: 'Заполни пропуски',
  parsons: 'Собери программу',
  code: 'Практика',
  debug: 'Найди ошибку',
  open: 'Свободный ответ',
}
