import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import './styles/reading.css';
import { App } from './app/App';
import { initAi } from './core/services/ai';
import { initPwa } from './core/services/pwa';
import { toast } from './ui';
import { ensurePlan } from './core/store/actions';
import { initSync, onPulled } from './core/store/sync';
import { initStudyTimer } from './features/layout/studyTimer';

ensurePlan();
onPulled(ensurePlan);
initStudyTimer();
render(<App />, document.getElementById('app')!);
// Capacidades del visor de Claude: se activan en segundo plano cuando responden.
void initSync();
void initAi();
initPwa(() => toast('App actualizada a la última versión'));
