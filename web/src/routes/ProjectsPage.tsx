import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, FolderKanban, Lock, Play } from 'lucide-react'
import type { Bootstrap } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  title: string
  description: string
  module: string
  skills: string[]
  checkpoints: string[]
  starter: string
}

const PROJECTS: Project[] = [
  {
    id: 'visitka',
    title: 'Визитка в консоли',
    description: 'Первая мини-программа: красиво вывести информацию о себе с помощью print и f-строк.',
    module: 'm0',
    skills: ['print', 'строки'],
    checkpoints: [
      'Программа выводит имя и город',
      'Используется хотя бы одна f-строка',
      'Вывод оформлен в несколько строк',
    ],
    starter: `name = "Твоё имя"
city = "Твой город"

print("=== Визитка ===")
print(f"Имя: {name}")
print(f"Город: {city}")
`,
  },
  {
    id: 'calculator',
    title: 'Калькулятор',
    description: 'Считает два числа и выполняет выбранную операцию. Первый настоящий диалог с пользователем.',
    module: 'm1',
    skills: ['input', 'int/float', 'if'],
    checkpoints: [
      'Считываются два числа',
      'Поддерживаются +, -, *, /',
      'Деление на ноль обрабатывается без падения',
    ],
    starter: `a = float(input("Первое число: "))
b = float(input("Второе число: "))
operation = input("Операция (+ - * /): ")

if operation == "+":
    print(a + b)
elif operation == "-":
    print(a - b)
elif operation == "*":
    print(a * b)
elif operation == "/":
    if b == 0:
        print("На ноль делить нельзя")
    else:
        print(a / b)
else:
    print("Неизвестная операция")
`,
  },
  {
    id: 'guess',
    title: 'Угадай число',
    description: 'Игра: компьютер загадывает число, а ты угадываешь. Циклы и случайные числа.',
    module: 'm3',
    skills: ['while', 'random', 'break'],
    checkpoints: [
      'Число загадывается случайно от 1 до 100',
      'Игра подсказывает «больше» или «меньше»',
      'После угадывания выводится количество попыток',
    ],
    starter: `import random

secret = random.randint(1, 100)
attempts = 0

while True:
    guess = int(input("Твоя догадка: "))
    attempts += 1
    if guess < secret:
        print("Больше")
    elif guess > secret:
        print("Меньше")
    else:
        print(f"Угадал за {attempts} попыток!")
        break
`,
  },
  {
    id: 'todo',
    title: 'Менеджер задач',
    description: 'Список дел с добавлением и удалением. Списки, циклы и меню.',
    module: 'm5',
    skills: ['списки', 'циклы', 'функции'],
    checkpoints: [
      'Можно добавить задачу',
      'Можно показать все задачи',
      'Можно удалить задачу по номеру',
    ],
    starter: `tasks = []

while True:
    print("\\n1 — добавить, 2 — показать, 3 — удалить, 0 — выход")
    choice = input("> ")

    if choice == "1":
        tasks.append(input("Задача: "))
    elif choice == "2":
        for index, task in enumerate(tasks, start=1):
            print(index, task)
    elif choice == "3":
        number = int(input("Номер: "))
        if 1 <= number <= len(tasks):
            tasks.pop(number - 1)
    elif choice == "0":
        break
`,
  },
  {
    id: 'csv',
    title: 'Анализатор CSV',
    description: 'Читает файл с данными и считает статистику. Работа с файлами и словарями.',
    module: 'm6',
    skills: ['файлы', 'словари', 'циклы'],
    checkpoints: [
      'Файл открывается через with',
      'Строки разбираются через split',
      'Считается сумма или среднее по колонке',
    ],
    starter: `from pathlib import Path

path = Path("data.csv")
if not path.exists():
    path.write_text("name,score\\nАня,10\\nБоря,20\\n", encoding="utf-8")

total = 0
rows = 0
with path.open(encoding="utf-8") as file:
    next(file)  # заголовок
    for line in file:
        name, score = line.strip().split(",")
        total += int(score)
        rows += 1

print("Средний балл:", total / rows if rows else 0)
`,
  },
  {
    id: 'quest',
    title: 'Текстовый квест',
    description: 'История с выбором действий. Функции, словари и структура программы.',
    module: 'm7',
    skills: ['функции', 'словари', 'if'],
    checkpoints: [
      'Есть минимум три сцены',
      'Выбор игрока меняет сцену',
      'Есть хотя бы два финала',
    ],
    starter: `scenes = {
    "start": {
        "text": "Ты в тёмном лесу. Перед тобой тропа и пещера.",
        "options": {"тропа": "forest", "пещера": "cave"},
    },
    "forest": {"text": "Ты вышел к реке. Конец!", "options": {}},
    "cave": {"text": "В пещере спит медведь. Конец!", "options": {}},
}

current = "start"
while True:
    scene = scenes[current]
    print("\\n" + scene["text"])
    if not scene["options"]:
        break
    for option in scene["options"]:
        print(" -", option)
    choice = input("> ").lower()
    current = scene["options"].get(choice, current)
`,
  },
]

function storageKey(id: string) {
  return `pitonika:project:${id}`
}

export function ProjectsPage() {
  const data = useOutletContext<Bootstrap>()
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('pitonika:projects') || '{}')
    } catch {
      return {}
    }
  })

  const modules = useMemo(() => new Map(data.path.map((module) => [module.id, module])), [data.path])

  const toggle = (projectId: string, index: number) => {
    const key = `${projectId}:${index}`
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem('pitonika:projects', JSON.stringify(next))
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Проекты"
        title="Собери что-то настоящее"
        description="Небольшие программы, в которых знания складываются в рабочий результат. Открывай в песочнице и доводи до конца."
        action={
          <Link to="/playground">
            <Button variant="secondary">
              <Play className="size-4" />
              Песочница
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {PROJECTS.map((project) => {
          const module = modules.get(project.module)
          const available = (module?.progress ?? 0) >= 1
          const doneCount = project.checkpoints.filter((_, index) => checked[`${project.id}:${index}`]).length
          const percent = Math.round((doneCount / project.checkpoints.length) * 100)
          return (
            <Card key={project.id} className={cn('flex flex-col overflow-hidden', !available && 'opacity-80')}>
              <div className="flex items-start gap-3 border-b border-line p-5">
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-2xl',
                    available ? 'bg-primary-soft text-primary-strong' : 'bg-surface-2 text-muted',
                  )}
                >
                  {available ? <FolderKanban className="size-5" /> : <Lock className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold tracking-tight">{project.title}</h2>
                    {available ? (
                      <Badge tone="primary">доступен</Badge>
                    ) : (
                      <Badge tone="neutral">после модуля {module?.number ?? '?'}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">{project.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-ink-soft">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-5">
                {!available ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-3 text-[12px] leading-relaxed text-muted">
                    Откроется после прохождения модуля {module?.number} «{module?.title}». Сначала — базовые уроки.
                  </p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                      <span>Чек-лист проекта</span>
                      <span>
                        {doneCount}/{project.checkpoints.length}
                      </span>
                    </div>
                    <Progress value={percent} className="mb-3 h-1.5" />
                    <div className="space-y-1.5">
                      {project.checkpoints.map((checkpoint, index) => {
                        const isDone = Boolean(checked[`${project.id}:${index}`])
                        return (
                          <label
                            key={index}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-[12.5px] leading-snug transition hover:bg-surface-2/60"
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggle(project.id, index)}
                              className="mt-0.5 size-4 accent-[var(--color-primary)]"
                            />
                            <span className={cn(isDone && 'text-muted line-through')}>{checkpoint}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {available && (
                <div className="flex items-center gap-2 border-t border-line bg-surface-2/30 px-5 py-3">
                  <Link
                    to={`/playground?code=${encodeURIComponent(project.starter)}`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-strong hover:underline"
                  >
                    <Play className="size-3.5" />
                    Открыть стартовый код
                  </Link>
                  {percent === 100 && (
                    <span className="ml-auto flex items-center gap-1 text-[11.5px] font-medium text-primary-strong">
                      <Check className="size-3.5" /> готово
                    </span>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-muted">
        <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" />
        <p>
          Совет: доводи проект до рабочего состояния, даже если код неидеален. Затем попроси наставника разобрать его —
          так быстрее растёт понимание.
        </p>
      </div>
    </Page>
  )
}
