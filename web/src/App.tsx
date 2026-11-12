import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingPage } from '@/routes/OnboardingPage'
import { PathPage } from '@/routes/PathPage'
import { LessonPage } from '@/routes/LessonPage'
import { PracticePage } from '@/routes/PracticePage'
import { ReviewPage } from '@/routes/ReviewPage'
import { ProjectsPage } from '@/routes/ProjectsPage'
import { ProgressPage } from '@/routes/ProgressPage'
import { PlaygroundPage } from '@/routes/PlaygroundPage'
import { SettingsPage } from '@/routes/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route path="/path" element={<PathPage />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/path" replace />} />
      </Route>
    </Routes>
  )
}
