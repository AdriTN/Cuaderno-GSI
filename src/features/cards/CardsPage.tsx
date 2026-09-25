import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { BLOCKS, TOPICS, blockById, topicById, topicCode } from '@/core/content';
import { allCards, cardById, type StudyCard } from '@/core/domain/cards';
import type { CardGrade } from '@/core/domain/srs';
import { aiBackend, aiStatus } from '@/core/services/ai';
import { deleteOwnCard, gradeStudyCard } from '@/core/store/actions';
import { dueCardIds, newCardIds, topicStatus } from '@/core/store/selectors';
import { docs, onReset, useDocs } from '@/core/store/store';
import type { SrsEntry } from '@/core/types';
import { today } from '@/core/utils/date';
import { plural, truncate } from '@/core/utils/format';
import { shuffle } from '@/core/utils/random';
import { Button, Callout, Checkbox, confirmDialog, Dropdown, Empty, Field, Figures, Input, Kbd, Meter, Modal, Page, PageHeader, Panel, Segmented, Tag } from '@/ui';
import '../test/test.css';
import { CardForm } from './CardForm';
import { aiCardsOf, bulkJob, cancelBulk, clearBulk, generateBulk, generateCards } from './aiCards';
import './cards.css';

/* ---------- sesión de repaso ---------- */
type Run = { label: string; queue: string[]; i: number; shown: boolean; tally: [number, number, number] };
const run = signal<Run | null>(null);
onReset(() => { run.value = null; });
const NEW_PER_SESSION = 20;

/** Cola de repaso: primero las pendientes (hasta 200) y luego nuevas (hasta 20). */
function startSession(ids: string[], label: string) {
  const d = today();
  const due = ids.filter(id => docs.cards.m[id] && docs.cards.m[id][1] <= d).slice(0, 200);
  const fresh = ids.filter(id => !docs.cards.m[id]).slice(0, NEW_PER_SESSION);
  if (!due.length && !fresh.length) return false;
  run.value = { label, queue: [...shuffle(due), ...fresh], i: 0, shown: false, tally: [0, 0, 0] };
  return true;
}
const flip = () => { if (run.value) run.value = { ...run.value, shown: true }; };
function grade(g: CardGrade) {
  const r = run.value; if (!r || !r.shown) return;
  gradeStudyCard(r.queue[r.i], g);
  const tally = [...r.tally] as Run['tally']; tally[g - 1]++;
  run.value = { ...r, i: r.i + 1, shown: false, tally };
}

function Session() {
  const r = run.value!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select')) return;
      if (!run.value?.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); }
      else if (run.value?.shown && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); grade(Number(e.key) as CardGrade); }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (r.i >= r.queue.length) return (
    <Page class="t-run">
      <PageHeader title="Sesión terminada" lede={`${r.tally[2]} sabidas, ${r.tally[1]} con esfuerzo y ${r.tally[0]} olvidadas. Las olvidadas vuelven mañana.`} />
      <div class="u-row"><Button variant="primary" href="#hoy">Volver a hoy</Button><Button onClick={() => (run.value = null)}>Más tarjetas</Button></div>
    </Page>
  );
  const card = cardById(r.queue[r.i], docs.cards.own);
  if (!card) { run.value = { ...r, i: r.i + 1 }; return null; }
  return (
    <Page class="t-run">
      <div class="t-top"><span class="t-top__label">{r.label}</span><span class="u-muted">{r.i + 1} de {r.queue.length}</span></div>
      <div class="t-progress"><span style={{ width: `${(100 * r.i) / r.queue.length}%` }} /></div>
      <Panel class="k-card">
        <div class="k-card__ctx">{topicCode(card.t)}{card.c ? `, ${card.c}` : ''}{!docs.cards.m[card.i] && <> <Tag tone="accent">Nueva</Tag></>}</div>
        <div class="k-card__front">{card.f}</div>
        {r.shown && <div class="k-card__back u-enter">{card.b}</div>}
      </Panel>
      {r.shown
        ? <div class="k-grades"><Button onClick={() => grade(1)}>No me acordaba<small>vuelve mañana</small></Button><Button onClick={() => grade(2)}>Me costó<small>vuelve pronto</small></Button><Button variant="primary" onClick={() => grade(3)}>Lo sabía<small>vuelve más tarde</small></Button></div>
        : <Button variant="primary" size="lg" block onClick={flip}>Mostrar respuesta</Button>}
      <div class="u-spread"><Button variant="ghost" size="sm" onClick={() => (run.value = null)}>Terminar</Button><span class="u-muted u-small"><Kbd>Espacio</Kbd> girar, <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> puntuar</span></div>
    </Page>
  );
}

/* ---------- organización ---------- */
type GroupBy = 'topic' | 'block' | 'origin' | 'state';
type State = 'new' | 'due' | 'learning' | 'learned';
const STATE_LABEL: Record<State, string> = { new: 'Nuevas', due: 'Pendientes hoy', learning: 'En curso', learned: 'Aprendidas' };
const STATE_ONE: Record<State, string> = { new: 'Nueva', due: 'Pendiente', learning: 'En curso', learned: 'Aprendida' };
const ORIGIN_LABEL = { auto: 'Automáticas (de los apuntes)', u: 'Creadas por ti', ia: 'Generadas con IA' } as const;
const stateOf = (e: SrsEntry | undefined, d: number): State => !e ? 'new' : e[1] <= d ? 'due' : e[0] >= 4 ? 'learned' : 'learning';
const originOf = (c: StudyCard) => (c.own ?? 'auto') as keyof typeof ORIGIN_LABEL;
const view = signal<{ by: GroupBy; origin: string; q: string }>({ by: 'topic', origin: 'all', q: '' });
onReset(() => { view.value = { by: 'topic', origin: 'all', q: '' }; });

function BulkPanel() {
  const j = bulkJob.value; if (!j) return null;
  const pct = j.topics.length ? (100 * j.done) / j.topics.length : 0;
  return (
    <Panel title={j.finished ? 'Generación terminada' : j.cancelled ? 'Cancelando…' : 'Generando tarjetas con IA'}
      subtitle={j.finished ? `${plural(j.created, 'tarjeta creada', 'tarjetas creadas')} en ${plural(j.done, 'tema', 'temas')}.` : `${j.done} de ${j.topics.length} temas${j.current ? `: ahora ${topicCode(j.current)}` : ''}. Puedes seguir usando la app.`}
      actions={j.finished || j.cancelled ? <Button size="sm" variant="ghost" onClick={clearBulk}>Cerrar</Button> : <Button size="sm" variant="ghost" onClick={cancelBulk}>Cancelar</Button>}>
      <Meter size="lg" parts={[{ value: pct, color: 'var(--accent)', label: `${Math.round(pct)} %` }]} />
      {j.errors.length > 0 && <details style={{ marginTop: 'var(--space-3)' }}><summary class="u-small" style={{ cursor: 'pointer' }}>{plural(j.errors.length, 'error', 'errores')}</summary><ul class="u-small u-muted">{j.errors.map(e => <li>{e}</li>)}</ul></details>}
    </Panel>
  );
}

function BulkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDocs();
  const [scope, setScope] = useState('opened'), [skip, setSkip] = useState(true);
  const base = scope === 'opened' ? TOPICS.filter(t => topicStatus(t.id) >= 1) : scope === 'all' ? TOPICS : TOPICS.filter(t => t.b === scope);
  const topics = base.filter(t => !skip || aiCardsOf(t.id) === 0).map(t => t.id);
  return (
    <Modal open={open} title="Generar tarjetas con IA" onClose={onClose}
      actions={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon="spark" disabled={!topics.length} onClick={() => { onClose(); void generateBulk(topics); }}>Generar ({topics.length} {topics.length === 1 ? 'tema' : 'temas'})</Button></>}>
      <p style={{ margin: 0 }}>La IA crea 10 tarjetas por tema a partir de los apuntes, priorizando cifras, plazos, artículos y diferencias entre conceptos. Hace una consulta por tema.</p>
      <Field group label="Temas"><Dropdown block label="Temas" value={scope} onChange={setScope} options={[
        { value: 'opened', label: `Los que ya has abierto (${TOPICS.filter(t => topicStatus(t.id) >= 1).length})` },
        ...BLOCKS.map(b => ({ value: b.id as string, label: `Bloque ${b.n}. ${b.title}`, hint: `${TOPICS.filter(t => t.b === b.id).length} temas` })),
        { value: 'all', label: 'Todo el temario (57)' },
      ]} /></Field>
      <Checkbox checked={skip} onChange={setSkip}>Saltar los temas que ya tienen tarjetas de IA</Checkbox>
      {!topics.length && <p class="u-muted u-small" style={{ margin: 0 }}>No hay temas que cumplan esas condiciones.</p>}
      {aiBackend.value === 'manual' && topics.length > 1 && <Callout tone="warn">Con tu suscripción tendrás que copiar y pegar una vez por tema ({topics.length} veces). Para muchos temas es más cómodo hacerlo desde la app dentro de Claude, donde es automático.</Callout>}
    </Modal>
  );
}

function CardItem({ c, d }: { c: StudyCard; d: number }) {
  const st = stateOf(docs.cards.m[c.i], d), o = originOf(c);
  return (
    <li class="k-item">
      <div class="k-item__body"><strong>{c.f}</strong><span class="u-muted u-small">{truncate(c.b, 180)}</span></div>
      <div class="k-item__meta">
        <Tag tone={st === 'due' ? 'mark' : st === 'learned' ? 'ok' : st === 'new' ? 'accent' : 'neutral'}>{STATE_ONE[st]}</Tag>
        {o !== 'auto' && <Tag tone={o === 'ia' ? 'warn' : 'neutral'}>{o === 'ia' ? 'IA' : 'Tuya'}</Tag>}
        {o !== 'auto' && <Button size="sm" variant="ghost" icon="trash" iconOnly aria-label="Borrar tarjeta" onClick={async () => { if (await confirmDialog({ title: 'Borrar tarjeta', message: c.f, confirm: 'Borrar', danger: true })) deleteOwnCard(c.i); }} />}
      </div>
    </li>
  );
}

export function CardsPage({ topic }: { topic?: string }) {
  const d0 = useDocs();
  const t = topic && topicById[topic] ? topic : null;
  const [form, setForm] = useState(false), [bulk, setBulk] = useState(false);
  const v = view.value, d = today();
  const cards = useMemo(() => allCards(d0.cards.own).filter(c => (!t || c.t === t) && (v.origin === 'all' || originOf(c) === v.origin) && (!v.q || (c.f + ' ' + c.b).toLowerCase().includes(v.q.toLowerCase()))), [d0.cards.own, t, v.origin, v.q, d0.cards.u]);
  if (run.value) return <Session />;

  const due = dueCardIds().filter(id => !t || cardById(id, d0.cards.own)?.t === t);
  const fresh = newCardIds(t ? [t] : undefined);
  const groups = new Map<string, { label: string; hint?: string; items: StudyCard[] }>();
  const keyOf = (c: StudyCard): [string, string, string?] => {
    if (v.by === 'block') { const b = topicById[c.t].b; return [b, `Bloque ${b.slice(1)}. ${blockById[b].title}`]; }
    if (v.by === 'origin') return [originOf(c), ORIGIN_LABEL[originOf(c)]];
    if (v.by === 'state') { const s = stateOf(d0.cards.m[c.i], d); return [s, STATE_LABEL[s]]; }
    return [c.t, topicById[c.t].title, topicCode(c.t)];
  };
  for (const c of cards) { const [k, label, hint] = keyOf(c); if (!groups.has(k)) groups.set(k, { label, hint, items: [] }); groups.get(k)!.items.push(c); }
  const order = v.by === 'state' ? ['due', 'new', 'learning', 'learned'] : v.by === 'topic' ? TOPICS.map(x => x.id) : v.by === 'block' ? BLOCKS.map(b => b.id as string) : ['auto', 'u', 'ia'];
  const sorted = order.filter(k => groups.has(k)).map(k => [k, groups.get(k)!] as const);
  const studyGroup = (items: StudyCard[], label: string) => { if (!startSession(items.map(c => c.i), label)) void confirmDialog({ title: 'Nada que repasar', message: 'Este grupo no tiene tarjetas pendientes ni nuevas. Vuelve cuando toque repasarlas.', confirm: 'Entendido', cancel: 'Cerrar' }); };

  return (
    <Page>
      <PageHeader crumbs={t ? [{ label: 'Tarjetas', href: '#tarjetas' }, { label: topicCode(t), href: `#tema/${t}` }] : undefined}
        title={t ? `Tarjetas de ${topicCode(t)}` : 'Tarjetas'}
        lede="Intenta recordar la respuesta antes de girar la tarjeta y puntúa con sinceridad: el repaso se adapta a lo que te cuesta."
        actions={<>
          <Button variant="primary" icon="play" disabled={!due.length && !fresh.length} onClick={() => startSession(t ? [...due, ...fresh] : [...due, ...fresh], t ? `Tarjetas de ${topicCode(t)}` : 'Repaso de tarjetas')}>Repasar ({Math.min(due.length, 200) + Math.min(fresh.length, NEW_PER_SESSION)})</Button>
          <Button icon="plus" onClick={() => setForm(true)}>Crear tarjeta</Button>
          {aiStatus.value !== 'off' && (t ? <Button icon="spark" onClick={() => generateCards(t)}>Crear 10 con IA</Button> : <Button icon="spark" onClick={() => setBulk(true)} disabled={!!bulkJob.value && !bulkJob.value.finished}>Generar con IA</Button>)}
        </>} />
      <BulkPanel />
      <Figures items={[
        { value: due.length, label: 'pendientes de repaso hoy', mark: due.length > 0 },
        { value: fresh.length, label: t ? 'nuevas en este tema' : 'nuevas de temas ya abiertos' },
        { value: cards.length, label: t ? 'tarjetas en este tema' : 'tarjetas en total' },
      ]} />
      <div class="k-toolbar">
        <Segmented label="Agrupar por" value={v.by} onChange={(by: GroupBy) => (view.value = { ...v, by })} options={t ? [['state', 'Estado'], ['origin', 'Origen']] : [['topic', 'Tema'], ['block', 'Bloque'], ['origin', 'Origen'], ['state', 'Estado']]} />
        <div class="k-toolbar__right">
          <Dropdown label="Origen" value={v.origin} onChange={origin => (view.value = { ...v, origin })} options={[{ value: 'all', label: 'Todos los orígenes' }, { value: 'auto', label: 'Automáticas' }, { value: 'u', label: 'Creadas por ti' }, { value: 'ia', label: 'Generadas con IA' }]} />
          <Input type="search" placeholder="Buscar en las tarjetas" aria-label="Buscar en las tarjetas" value={v.q} onInput={e => (view.value = { ...v, q: (e.target as HTMLInputElement).value })} />
        </div>
      </div>
      {sorted.length ? <div class="k-groups">{sorted.map(([k, g]) => {
        const nDue = g.items.filter(c => stateOf(d0.cards.m[c.i], d) === 'due').length, nNew = g.items.filter(c => !d0.cards.m[c.i]).length;
        const learned = g.items.filter(c => stateOf(d0.cards.m[c.i], d) === 'learned').length;
        return (
          <details class="c-panel k-group" open={!!t || sorted.length === 1}>
            <summary class="k-group__head">
              <div class="k-group__title">{g.hint && <span class="u-muted u-small u-num">{g.hint}</span>}<strong title={g.label}>{g.label}</strong></div>
              <div class="k-group__stats">
                <span class="u-small u-muted">{plural(g.items.length, 'tarjeta', 'tarjetas')}</span>
                {nDue > 0 && <Tag tone="mark">{nDue} pendientes</Tag>}
                <div class="k-group__meter"><Meter parts={[{ value: (100 * learned) / g.items.length, color: 'var(--ok)', label: `${learned} aprendidas` }]} /></div>
                <Button size="sm" variant={nDue ? 'primary' : 'secondary'} disabled={!nDue && !nNew} onClick={(e: Event) => { e.preventDefault(); studyGroup(g.items, g.hint ? `Tarjetas de ${g.hint}` : g.label); }}>Repasar</Button>
              </div>
            </summary>
            <ul class="k-list">{g.items.slice(0, 150).map(c => <CardItem c={c} d={d} />)}</ul>
            {g.items.length > 150 && <p class="u-muted u-small" style={{ margin: 0 }}>Se muestran 150 de {g.items.length}. Usa el buscador para encontrar el resto.</p>}
          </details>
        );
      })}</div> : <Empty title={v.q || v.origin !== 'all' ? 'Sin resultados' : 'Aún no hay tarjetas'}>{v.q || v.origin !== 'all' ? 'Prueba con otra búsqueda u otro origen.' : 'Crea tarjetas desde un subrayado del temario, con «Crear tarjeta» o con la IA.'}</Empty>}
      <CardForm open={form} onClose={() => setForm(false)} topic={t ?? TOPICS[0].id} />
      <BulkDialog open={bulk} onClose={() => setBulk(false)} />
    </Page>
  );
}
