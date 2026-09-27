import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { route } from '@/app/router';
import { dueCardIds, dueQuestions, secondsToday } from '@/core/store/selectors';
import { onReset, useDocs } from '@/core/store/store';
import { syncBackend, syncMessage, syncState } from '@/core/store/sync';
import { clock } from '@/core/utils/format';
import { Button, DialogHost, Icon, ToastHost, type IconName } from '@/ui';
import { contextLabel, pendingSeconds, tick, timer, toggleTimer } from './studyTimer';
import { AiActivity } from './AiActivity';
import { ClaudeBridge } from './ClaudeBridge';
import { UsageMini } from './UsageMini';
import './layout.css';

type NavItem = { name: string; label: string; icon: IconName; badge?: () => number };
type NavGroup = { id: string; label: string; tab: string; icon: IconName; items: NavItem[] };
/** Estructura única de navegación: el menú lateral la muestra entera y el móvil, un grupo por pestaña. */
const GROUPS: NavGroup[] = [
  { id: 'hoy', label: '', tab: 'Hoy', icon: 'today', items: [{ name: 'hoy', label: 'Hoy', icon: 'today' }] },
  { id: 'estudiar', label: 'Estudiar', tab: 'Estudiar', icon: 'book', items: [
    { name: 'temario', label: 'Temario', icon: 'book' },
    { name: 'tarjetas', label: 'Tarjetas', icon: 'cards', badge: () => dueCardIds().length },
  ] },
  { id: 'practicar', label: 'Practicar', tab: 'Practicar', icon: 'test', items: [
    { name: 'entrenamiento', label: 'Entrenamiento', icon: 'test' },
    { name: 'refuerzo', label: 'Refuerzo', icon: 'repeat', badge: () => dueQuestions().length },
    { name: 'examen', label: 'Examen', icon: 'timer' },
    { name: 'supuestos', label: 'Supuestos', icon: 'pen' },
    { name: 'cuadernos', label: 'Cuadernos', icon: 'folder' },
  ] },
  { id: 'seguimiento', label: 'Seguimiento', tab: 'Progreso', icon: 'chart', items: [
    { name: 'progreso', label: 'Progreso', icon: 'chart' },
    { name: 'plan', label: 'Plan', icon: 'calendar' },
  ] },
];
const SETTINGS: NavItem = { name: 'ajustes', label: 'Ajustes', icon: 'settings' };
/** Rutas de detalle (y alias antiguos) → sección del menú a la que pertenecen. */
const SECTION: Record<string, string> = { tema: 'temario', run: 'entrenamiento', resultado: 'entrenamiento', supuesto: 'supuestos', cuaderno: 'cuadernos', 'mi-examen': 'examen', test: 'entrenamiento', repaso: 'refuerzo', simulacros: 'examen', mas: 'hoy' };
const groupOf = (section: string) => GROUPS.find(g => g.items.some(i => i.name === section));
/** Última sección visitada de cada grupo: al volver a una pestaña, se abre donde estabas. */
const lastInGroup = signal<Record<string, string>>({});
onReset(() => { lastInGroup.value = {}; });
route.subscribe(r => {
  const section = SECTION[r.name] ?? r.name, g = groupOf(section);
  if (g && lastInGroup.peek()[g.id] !== section) lastInGroup.value = { ...lastInGroup.peek(), [g.id]: section };
});

/** Logotipo: cuaderno con marcapáginas amarillo (el color de subrayar). */
const Logo = ({ size = 34 }: { size?: number }) => (
  <svg class="l-logo" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
    <rect width="34" height="34" rx="9" style={{ fill: 'var(--accent)' }} />
    <path d="M10 8.5h11.5a3 3 0 0 1 3 3V25.5H13a3 3 0 0 1-3-3z" fill="none" stroke-width="1.9" style={{ stroke: 'var(--on-accent)' }} />
    <path d="M13.5 13h7M13.5 16.5h7" stroke-width="1.7" stroke-linecap="round" style={{ stroke: 'var(--on-accent)', opacity: .75 }} />
    <path d="M19 8.5v8l2-1.6 2 1.6v-8" style={{ fill: 'var(--mark)' }} />
  </svg>
);

const SYNC_LABEL = { local: 'Guardado en este dispositivo', ok: 'Sincronizado', error: 'Sin sincronizar' };

function TimerControl({ mobile }: { mobile?: boolean }) {
  void tick.value; useDocs();
  const t = timer.value, total = secondsToday() + pendingSeconds();
  return (
    <div class={`l-timer ${t.running ? 'l-timer--on' : ''} ${mobile ? 'l-mtimer' : ''}`}>
      <span class="l-timer__time" title="Tiempo de estudio hoy">{clock(total)}</span>
      <span class="l-timer__ctx">{t.running ? contextLabel(t.context) : 'hoy'}</span>
      <Button size="sm" variant={t.running ? 'secondary' : 'primary'} icon={t.running ? 'pause' : 'play'} iconOnly={mobile} onClick={toggleTimer} aria-label={t.running ? 'Pausar sesión de estudio' : 'Empezar sesión de estudio'}>{t.running ? 'Pausar' : 'Estudiar'}</Button>
    </div>
  );
}

/** Marca la lista del menú lateral cuando no cabe entera, para mostrar el degradado inferior hasta llegar al final. */
function fadeEdge(el: HTMLElement | null) {
  if (!el) return;
  el.classList.toggle('is-scrollable', el.scrollHeight > el.clientHeight + 1);
  el.classList.toggle('is-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
}

export function Shell({ children }: { children: ComponentChildren }) {
  useDocs();
  const sideNav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sideNav.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fadeEdge(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const active = SECTION[route.value.name] ?? route.value.name;
  const group = groupOf(active);
  return (
    <div class="l-app">
      <aside class="l-side no-print" aria-label="Navegación principal">
        <a class="l-brand" href="#hoy"><Logo /><span><span class="l-brand__name">Cuaderno GSI</span><span class="l-brand__sub" style={{ display: 'block' }}>Oposición A2</span></span></a>
        <div class="l-side__nav" ref={sideNav} onScroll={e => fadeEdge(e.currentTarget)}>
        {[...GROUPS.slice(0, 1).map(g => ({ ...g, items: [...g.items, ...GROUPS[1].items], label: 'Estudiar' })), ...GROUPS.slice(2), { id: 'ajustes', label: '', tab: '', icon: 'settings' as IconName, items: [SETTINGS] }].map(g => (
          <nav class="l-group" aria-label={g.label || g.items[0].label}>
            {g.label && <div class="l-group__label">{g.label}</div>}
            {g.items.map(it => { const n = it.badge?.() ?? 0; return (
              <a class="l-link" href={`#${it.name}`} aria-current={active === it.name ? 'page' : undefined}>
                <Icon name={it.icon} size={19} />{it.label}{n > 0 && <span class="l-link__badge" aria-label={`${n} pendientes`}>{n}</span>}
              </a>); })}
          </nav>
        ))}
        </div>
        <div class="l-side__foot">
          <TimerControl />
          <UsageMini />
          <a class={`l-sync l-sync--${syncState.value}`} href="#ajustes" title={syncMessage.value || (syncBackend.value === 'github' ? 'Sincronizado con tu repositorio privado de GitHub' : syncBackend.value === 'claude' ? 'Sincronizado con tu cuenta de Claude' : 'Activa la sincronización en Ajustes → Tus datos')}><i />{SYNC_LABEL[syncState.value]}</a>
        </div>
      </aside>
      <main class="l-main" id="main">
        <header class="l-mhead no-print">
          <a class="l-brand l-brand--compact" href="#hoy"><Logo size={28} /><span class="l-brand__name">Cuaderno GSI</span></a>
          <div class="u-row" style={{ flexWrap: 'nowrap' }}><TimerControl mobile /><a class={`l-iconlink ${active === 'ajustes' ? 'is-active' : ''}`} href="#ajustes" aria-label="Ajustes" aria-current={active === 'ajustes' ? 'page' : undefined}><Icon name="settings" size={22} /></a></div>
        </header>
        {group && group.items.length > 1 && (
          <nav class="l-subnav no-print" aria-label={group.label}>
            {group.items.map(it => { const n = it.badge?.() ?? 0; return <a href={`#${it.name}`} aria-current={active === it.name ? 'page' : undefined}>{it.label}{n > 0 && <span class="l-subnav__n">{n}</span>}</a>; })}
          </nav>
        )}
        <div class="l-content">{children}</div>
      </main>
      <nav class="l-tabbar no-print" aria-label="Navegación principal">
        {GROUPS.map(g => {
          const current = group?.id === g.id;
          const target = lastInGroup.value[g.id] ?? g.items[0].name;
          const pending = g.items.some(i => (i.badge?.() ?? 0) > 0);
          return <a class="l-tab" href={`#${target}`} aria-current={current ? 'page' : undefined}><Icon name={g.icon} size={22} />{g.tab}{pending && <span class="l-tab__dot" aria-label="Tienes pendientes" />}</a>;
        })}
      </nav>
      <ToastHost />
      <DialogHost />
      <ClaudeBridge />
      <AiActivity />
    </div>
  );
}

