import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { onReset, useDocs } from '@/core/store/store';
import { CardsPage } from '@/features/cards/CardsPage';
import { CasePage } from '@/features/cases/CasePage';
import { CasesPage } from '@/features/cases/CasesPage';
import { Shell } from '@/features/layout/Shell';
import { ExamPage } from '@/features/mocks/ExamPage';
import { OwnExamPage } from '@/features/mocks/OwnExamPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { PracticeListPage, PracticePage } from '@/features/practice/PracticePage';
import { ProgressPage } from '@/features/progress/ProgressPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SyllabusPage } from '@/features/syllabus/SyllabusPage';
import { TopicPage } from '@/features/syllabus/TopicPage';
import { ResultsPage } from '@/features/test/ResultsPage';
import { RunPage } from '@/features/test/RunPage';
import { TrainingPage } from '@/features/test/TrainingPage';
import { TodayPage } from '@/features/today/TodayPage';
import { route } from './router';

/** Tabla de rutas: nombre del hash → página. */
const ROUTES: Record<string, (param?: string) => JSX.Element> = {
  hoy: () => <TodayPage />,
  temario: () => <SyllabusPage />,
  tema: p => <TopicPage id={p ?? ''} />,
  tarjetas: p => <CardsPage topic={p} />,
  entrenamiento: () => <TrainingPage />,
  run: () => <RunPage />,
  resultado: () => <ResultsPage />,
  refuerzo: () => <ReviewPage />,
  examen: () => <ExamPage />,
  'mi-examen': () => <OwnExamPage />,
  // Alias de versiones anteriores para no romper enlaces guardados.
  test: () => <TrainingPage />,
  repaso: () => <ReviewPage />,
  simulacros: () => <ExamPage />,
  supuestos: () => <CasesPage />,
  supuesto: p => <CasePage id={p ?? ''} />,
  cuadernos: () => <PracticeListPage />,
  cuaderno: p => <PracticePage id={p ?? ''} />,
  progreso: () => <ProgressPage />,
  plan: () => <PlanPage />,
  ajustes: () => <SettingsPage />,
  mas: () => <TodayPage />,
};

function useTheme() {
  const theme = useDocs().core.settings.theme;
  useEffect(() => { if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme); }, [theme]);
}

/** Se incrementa en cada reinicio: al cambiar la key, Preact descarta todo el árbol y cualquier estado interno. */
const generation = signal(0);
onReset(() => { generation.value++; });

export function App() {
  useTheme();
  const { name, param } = route.value;
  const page = (ROUTES[name] ?? ROUTES.hoy)(param);
  return <Shell key={generation.value}>{page}</Shell>;
}
