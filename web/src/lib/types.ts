export type StepType = 'theory' | 'quiz' | 'predict' | 'blank' | 'parsons' | 'code' | 'debug' | 'open'

export interface LevelInfo {
  level: number
  title: string
  xp: number
  levelStartXp: number
  nextLevelXp: number
  percent: number
}

export interface StreakInfo {
  current: number
  best: number
  freezes: number
  lastActiveDate?: string | null
}

export interface ProfileInfo {
  name: string
  goal: string
  dailyMinutes: number
  dailyGoalXp: number
  experience: string
  interests: string[]
  onboarded: boolean
  timezone: string
  xpToday: number
  goalMet: boolean
  streak: StreakInfo
  level: LevelInfo
  unlockedIndex: number
}

export interface LLMSettings {
  provider: string | null
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

export interface ProviderInfo {
  id: string
  label: string
  baseUrl: string
  requiresKey: boolean
}

export interface SettingsInfo {
  pythonPath: string
  timeoutSeconds: number
  strictMode: boolean
  dailyGoalXp: number
  llm: LLMSettings
  hasKey: boolean
  keyMasked: string
  providers?: ProviderInfo[]
}

export interface LessonSummary {
  id: string
  title: string
  goal: string
  minutes: number
  order: number
  steps: number
  status: 'done' | 'current' | 'available' | 'locked'
  score: number
  index: number
}

export interface ModuleInfo {
  id: string
  title: string
  subtitle: string
  number: number
  color: string
  icon: string
  description: string
  lessons: LessonSummary[]
  total: number
  done: number
  progress: number
}

export interface Bootstrap {
  profile: ProfileInfo
  settings: SettingsInfo
  path: ModuleInfo[]
  dueReviews: number
  today: string
  modulesCount: number
  lessonsCount: number
  version: string
}

export interface StepState {
  status: 'pending' | 'done'
  score: number
  attempts: number
  hintsUsed: number
}

export interface Step {
  id: string
  type: StepType
  title?: string | null
  concepts: string[]
  state?: StepState
  body?: string
  example?: string
  aside?: string
  question?: string
  options?: string[]
  multiple?: boolean
  code?: string
  prompt?: string
  template?: string
  blanks?: { hint: string }[]
  lines?: string[]
  mode?: 'io' | 'unit'
  starter?: string
  fixtures?: { stdin: string; stdout: string }[]
  hints?: string[]
  testCount?: number
  signature?: string | null
  rubric?: string[]
  minWords?: number
}

export interface LessonPayload {
  id: string
  module: { id: string; title: string; color: string } | null
  title: string
  goal: string
  minutes: number
  concepts: string[]
  steps: Step[]
  streak: number
}

export interface TestResult {
  name: string
  passed: boolean
  message: string
  got: string
  expected: string
  output?: string
}

export interface IoCase {
  stdin: string
  expected: string
  actual: string
  stderr: string
  passed: boolean
  timedOut: boolean
  exitCode: number | null
}

export interface GradeDetails {
  kind: string
  cases?: IoCase[]
  tests?: TestResult[]
  stdout?: string
  stderr?: string
  timedOut?: boolean
  loadError?: string | null
  diagnosis?: string
  errorLine?: number | null
  limitHit?: string | null
  message?: string
  checks?: { given: string; expected: string; passed: boolean; hint: string }[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: string | null
}

export interface GradeResponse {
  stepId: string
  stepType: StepType
  passed: boolean
  score: number
  firstTry: boolean
  xpGained: number
  newlyDone: boolean
  details: GradeDetails
  explanation?: string | null
  correctAnswers?: (string | number)[]
  level: LevelInfo
  streak: StreakInfo
  daily: { xp: number; goalMet: boolean; goalXp: number }
  achievements: Achievement[]
}

export interface LessonCompleteResponse {
  lessonId: string
  firstTime: boolean
  xpGained: number
  level: LevelInfo
  streak: StreakInfo
  daily: { xp: number; goalMet: boolean; goalXp: number }
  achievements: Achievement[]
}

export interface ProgressSummary {
  totals: { steps: number; lessons: number; attempts: number; accuracy: number; minutes: number; reviews: number }
  heatmap: { date: string; xp: number; minutes: number; qualifies: boolean }[]
  level: LevelInfo
  streak: StreakInfo
  accuracyByKind: { kind: string; total: number; passed: number; accuracy: number }[]
  concepts: { id: string; title: string; module: string; mastery: number; attempts: number; dueAt: string | null }[]
  coreConcepts: { id: string; title: string; module: string; mastery: number; attempts: number; dueAt: string | null }[]
  weakConcepts: { id: string; title: string; module: string; mastery: number; attempts: number; dueAt: string | null }[]
  reviewsDue: number
  achievements: Achievement[]
  modules: ModuleInfo[]
}

export interface ReviewCard {
  conceptId: string
  conceptTitle: string
  conceptDescription: string
  lessonId: string | null
  dueAt: string | null
  interval: number
  step: Step | null
  correctAnswers?: (string | number)[]
}

export interface PracticeSuggestion {
  stepId: string
  lessonId: string
  lessonTitle: string
  type: StepType
  conceptIds: string[]
  conceptTitle: string
  mastery: number
}

export interface RunResponse {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  durationMs: number
  truncated: boolean
  limitHit: string | null
  runnerError: string | null
}
