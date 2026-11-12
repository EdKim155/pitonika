import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { ReviewCard } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Progress } from '@/components/ui/Progress'
import { useToast } from '@/components/ui/Toast'
import { cn, plural } from '@/lib/utils'

export function ReviewPage() {
  const queryClient = useQueryClient()
  const toast = useToast((state) => state.push)
  const { data, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => api.get<{ cards: ReviewCard[]; due: number }>('/api/review/queue'),
    staleTime: 0,
  })

  const cards = data?.cards ?? []
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [inputs, setInputs] = useState<string[]>([])
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [selfCheck, setSelfCheck] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)

  const card = cards[index]
  const templateParts = useMemo(() => (card?.step?.template || '').split(/(\{\{\d+\}\})/g), [card?.step?.template])

  useEffect(() => {
    setInputs(new Array(card?.step?.blanks?.length || 0).fill(''))
    setSelected([])
    setAnswered(null)
    setSelfCheck(null)
  }, [card?.conceptId, card?.step?.blanks?.length])

  const isQuiz = card?.step?.type === 'quiz'
  const isPredict = card?.step?.type === 'predict'
  const isBlank = card?.step?.type === 'blank'

  const correctValue = card?.correctAnswers ?? []

  const checkAnswer = () => {
    if (!card) return
    if (isQuiz) {
      const expected = new Set(correctValue.map(String))
      const given = new Set(selected.map(String))
      setAnswered(expected.size === given.size && [...expected].every((item) => given.has(item)))
      return
    }
    if (isPredict) {
      setAnswered(selected.length === 1 && String(selected[0]) === String(correctValue[0]))
      return
    }
    if (isBlank) {
      const expected = correctValue.map((item) => String(item).trim())
      setAnswered(inputs.length === expected.length && inputs.every((value, position) => value.trim() === expected[position]))
      return
    }
    setAnswered(selfCheck)
  }

  const submitCard = async () => {
    if (!card) return
    const correct = answered ?? selfCheck ?? false
    setSaving(true)
    try {
      await api.post('/api/review/answer', { conceptId: card.conceptId, correct })
      if (correct) toast({ tone: 'success', title: '+2 XP', description: 'Тема закреплена' })
      if (index + 1 >= cards.length) {
        setFinished(true)
      } else {
        setIndex(index + 1)
        setSelected([])
        setInputs([])
        setAnswered(null)
        setSelfCheck(null)
      }
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось сохранить', description: (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!cards.length) {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Повторение" title="На сегодня всё повторено" />
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
            <Check className="size-6" />
          </div>
          <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-muted">
            Интервальное повторение вернёт темы, когда они начнут забываться. Продолжай учиться — и карточки появятся
            здесь.
          </p>
          <Link to="/path" className="mt-4 inline-block">
            <Button>Продолжить путь</Button>
          </Link>
        </Card>
      </Page>
    )
  }

  if (finished) {
    return (
      <Page width="narrow">
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-primary text-on-primary">
            <Trophy className="size-7" />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Повторение завершено</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            {cards.length} {plural(cards.length, 'тема', 'темы', 'тем')} освежены в памяти. Так знания остаются с тобой
            надолго.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to="/path">
              <Button size="lg">
                К карте пути
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setFinished(false)
                setIndex(0)
                setSelected([])
                setAnswered(null)
                setSelfCheck(null)
              }}
            >
              <RotateCcw className="size-4" />
              Ещё раз
            </Button>
          </div>
        </Card>
      </Page>
    )
  }

  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Интервальное повторение"
        title="Вспомни то, что уже изучал"
        description="Проверяем себя без подсказок: так память крепнет быстрее."
        action={
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-muted">
            {index + 1} / {cards.length}
          </span>
        }
      />

      <Progress value={((index + (answered !== null ? 1 : 0)) / cards.length) * 100} className="mb-4 h-1.5" />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Карточка {index + 1}</span>
          <span className="ml-auto text-[11.5px] text-muted">{card.conceptTitle}</span>
        </div>

        {isQuiz && card.step && (
          <>
            <h2 className="mt-3 text-[17px] font-semibold leading-snug">{card.step.question}</h2>
            {card.step.code && <CodeBlock code={card.step.code} className="mt-3" />}
            <div className="mt-4 space-y-2">
              {(card.step.options || []).map((option, position) => {
                const active = selected.includes(position)
                const right = answered !== null && String(position) === String(correctValue[0])
                return (
                  <button
                    key={position}
                    onClick={() => answered === null && setSelected([position])}
                    disabled={answered !== null}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left text-[13px] transition',
                      right && 'border-primary/50 bg-primary-soft/60',
                      active && !right && answered !== null && 'border-danger/40 bg-danger-soft/40',
                      active && answered === null && 'border-primary/60 bg-primary-soft/50',
                      !active && 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded-lg border border-line-strong text-[11px] font-bold">
                      {String.fromCharCode(65 + position)}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {isPredict && card.step && (
          <>
            <h2 className="mt-3 text-[17px] font-semibold leading-snug">Что выведет программа?</h2>
            <CodeBlock code={card.step.code || ''} className="mt-3" showLineNumbers />
            <div className="mt-4 space-y-2">
              {(card.step.options || []).map((option, position) => {
                const active = selected.includes(position)
                const right = answered !== null && String(position) === String(correctValue[0])
                return (
                  <button
                    key={position}
                    onClick={() => answered === null && setSelected([position])}
                    disabled={answered !== null}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left font-mono text-[12.5px] transition',
                      right && 'border-primary/50 bg-primary-soft/60',
                      active && !right && answered !== null && 'border-danger/40 bg-danger-soft/40',
                      active && answered === null && 'border-primary/60 bg-primary-soft/50',
                      !active && 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {isBlank && card.step && (
          <>
            <h2 className="mt-3 text-[17px] font-semibold leading-snug">{card.step.prompt}</h2>
            <div className="mt-3 rounded-2xl border border-line bg-[#0f1a16] p-4 text-[#e6efe9]">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-8">
                {templateParts.map((part, position) => {
                  const match = part.match(/^\{\{(\d+)\}\}$/)
                  if (!match) return <span key={position}>{part}</span>
                  const blankIndex = Number(match[1]) - 1
                  const value = inputs[blankIndex] ?? ''
                  return (
                    <input
                      key={position}
                      value={value}
                      disabled={answered !== null}
                      onChange={(event) =>
                        setInputs((current) =>
                          current.map((item, itemIndex) => (itemIndex === blankIndex ? event.target.value : item)),
                        )
                      }
                      style={{ width: `${Math.max(9, value.length + 2)}ch` }}
                      className="mx-0.5 inline-block rounded-md border-b-2 border-emerald-500/70 bg-white/10 px-1.5 py-0.5 text-center font-mono text-[12.5px] text-white outline-none"
                    />
                  )
                })}
              </pre>
            </div>
          </>
        )}

        {!card.step && (
          <>
            <h2 className="mt-3 text-[18px] font-semibold">{card.conceptTitle}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{card.conceptDescription}</p>
            <p className="mt-4 text-[13px] text-ink-soft">Вспомнил(а) суть темы без подсказки?</p>
            <div className="mt-2 flex gap-2">
              <Button variant={selfCheck === true ? 'primary' : 'secondary'} onClick={() => setSelfCheck(true)}>
                <Check className="size-4" /> Помню
              </Button>
              <Button variant={selfCheck === false ? 'danger' : 'secondary'} onClick={() => setSelfCheck(false)}>
                <X className="size-4" /> Забыл(а)
              </Button>
            </div>
          </>
        )}

        {answered !== null && (
          <div
            className={cn(
              'mt-4 rounded-xl border px-3.5 py-3 text-[12.5px]',
              answered ? 'border-primary/35 bg-primary-soft/50' : 'border-danger/30 bg-danger-soft/40',
            )}
          >
            <p className="font-semibold">{answered ? 'Верно!' : 'Не совсем'}</p>
            {!answered && correctValue.length > 0 && (
              <p className="mt-1 text-muted">
                Правильный ответ: <span className="font-mono text-ink">{correctValue.join(', ')}</span>
              </p>
            )}
            {isBlank && !answered && (
              <p className="mt-1 font-mono text-[11.5px] text-muted">Эталон: {correctValue.join(' | ')}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {answered === null ? (
            <Button onClick={checkAnswer} disabled={isQuiz || isPredict ? selected.length === 0 : isBlank ? inputs.every((item) => !item.trim()) : selfCheck === null}>
              Проверить
            </Button>
          ) : (
            <Button onClick={submitCard} loading={saving}>
              Дальше
              <ArrowRight className="size-4" />
            </Button>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
            <Sparkles className="size-3" />
            {answered === null ? 'Без подсказок' : answered ? '+2 XP' : 'вернёмся позже'}
          </span>
        </div>
      </Card>
    </Page>
  )
}
