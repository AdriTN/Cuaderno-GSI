import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CONTENT, TOPICS, topicById, topicCode } from '@/core/content';
import { allCards } from '@/core/domain/cards';
import { aiErrorMessage, aiStatus, askText } from '@/core/services/ai';
import { outlinePrompt } from '@/core/services/prompts';
import { addHighlight, markTopicOpened, removeHighlight, saveNote, setTopicStatus } from '@/core/store/actions';
import { secondsOnTopic, statsOf, topicStatus } from '@/core/store/selectors';
import { docs as store, useDocs } from '@/core/store/store';
import type { TopicStatus } from '@/core/types';
import { hours, pct, truncate } from '@/core/utils/format';
import { htmlToText } from '@/core/utils/text';
import { Button, Callout, Empty, Field, Icon, Page, PageHeader, Panel, Segmented, STATUS_LABEL, TextArea, toast } from '@/ui';
import { CardForm } from '../cards/CardForm';
import { aiJob, aiJobs, runAiJob } from '@/core/services/aiJobs';
import { generateCards } from '../cards/aiCards';
import { startTest } from '../test/session';
import { applyHighlights, selectionToHighlight } from './highlights';
import './syllabus.css';

type SelState = { rect: DOMRect; kind: 'new'; t: string; o: number } | { rect: DOMRect; kind: 'existing'; index: number } | null;

/** Barra fina con el porcentaje leído del artículo. */
function ReadingProgress({ target }: { target: () => HTMLElement | null }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => { const el = target(); if (!el) return; const r = el.getBoundingClientRect(); const total = r.height - innerHeight * 0.6; setP(Math.max(0, Math.min(1, (-r.top + innerHeight * 0.2) / Math.max(total, 1)))); };
    on(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on);
  }, []);
  return <div class="s-readbar" aria-hidden="true"><span style={{ transform: `scaleX(${p})` }} /></div>;
}

function Reading({ id, onSelect }: { id: string; onSelect: (s: SelState) => void }) {
  const docs = useDocs();
  const ref = useRef<HTMLElement>(null);
  const hl = docs.notes.hl[id] ?? [];
  const hlKey = JSON.stringify(hl);
  // El HTML se gestiona fuera de Preact para poder envolver texto en <mark> sin que el diff lo deshaga.
  useEffect(() => { const el = ref.current!; el.innerHTML = CONTENT.content[id]; applyHighlights(el, hl); }, [id, hlKey]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onSel = () => { clearTimeout(t); t = setTimeout(() => { const r = selectionToHighlight(ref.current!); if (r) onSelect({ rect: r.rect, kind: 'new', ...r.highlight }); }, 180); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const jump = target.closest<HTMLElement>('[data-jump]');
      if (jump) { e.preventDefault(); document.getElementById(jump.dataset.jump!)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const mark = target.closest<HTMLElement>('mark.hl');
      if (mark && getSelection()?.isCollapsed) onSelect({ rect: mark.getBoundingClientRect(), kind: 'existing', index: Number(mark.dataset.h) });
    };
    document.addEventListener('selectionchange', onSel); ref.current!.addEventListener('click', onClick);
    return () => { document.removeEventListener('selectionchange', onSel); ref.current?.removeEventListener('click', onClick); clearTimeout(t); };
  }, [id]);
  return <article ref={ref} class="reading" />;
}

function SelectionBar({ sel, onHighlight, onRemove, onCard, onClose }: { sel: NonNullable<SelState>; onHighlight: () => void; onRemove: () => void; onCard: () => void; onClose: () => void }) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const top = (touch ? sel.rect.bottom + 10 : sel.rect.top - 50) + scrollY;
  const left = Math.max(8, Math.min(sel.rect.left + sel.rect.width / 2 - 110 + scrollX, scrollX + document.documentElement.clientWidth - 240));
  useEffect(() => { const h = () => onClose(); addEventListener('scroll', h, { passive: true, once: true }); return () => removeEventListener('scroll', h); }, [sel]);
  return (
    <div class="s-selbar" style={{ top, left }} onMouseDown={e => e.preventDefault()} role="toolbar" aria-label="Acciones sobre el texto">
      {sel.kind === 'new' ? <button onClick={onHighlight}><Icon name="pen" size={16} />Subrayar</button> : <button onClick={onRemove}><Icon name="close" size={16} />Quitar subrayado</button>}
      <button onClick={onCard}><Icon name="cards" size={16} />Crear tarjeta</button>
    </div>
  );
}

function Outline({ id }: { id: string }) {
  const key = `outline:${id}`, job = aiJob(key), text = job?.text ?? '', busy = !!job?.busy;
  if (aiStatus.value === 'off') return null;
  const run = () => runAiJob(key, 'Preparando el esquema…', onText => askText(outlinePrompt(topicById[id].title, htmlToText(CONTENT.content[id]).slice(0, 16000)), { onText }), aiErrorMessage);
  const html = text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>');
  return <>
    <div class="u-row"><Button size="sm" icon="spark" onClick={run} disabled={busy}>Proponer un esquema con IA</Button><Button size="sm" icon="cards" onClick={() => generateCards(id)}>Crear 10 tarjetas con IA</Button></div>
    {text && <><pre class="s-outline" dangerouslySetInnerHTML={{ __html: html }} />{!busy && <div><Button size="sm" variant="primary" onClick={() => { const cur = store.notes.m[id] ?? ''; saveNote(id, (cur ? cur + '\n\n' : '') + text); toast('Esquema añadido a tus notas'); aiJobs.value = { ...aiJobs.value, [key]: { text: '', busy: false } }; }}>Añadir a mis notas</Button></div>}</>}
  </>;
}

export function TopicPage({ id }: { id: string }) {
  const docs = useDocs();
  const topic = topicById[id];
  const [sel, setSel] = useState<SelState>(null);
  const [card, setCard] = useState<{ open: boolean; back: string }>({ open: false, back: '' });
  useEffect(() => { if (topic) markTopicOpened(id); setSel(null); }, [id]);
  // Sección visible ahora mismo (para resaltarla en el índice lateral).
  const [active, setActive] = useState('');
  useEffect(() => {
    const onScroll = () => {
      const heads = [...document.querySelectorAll<HTMLElement>('article.reading h2[id], article.reading h3[id]')];
      let cur = heads[0]?.id ?? '';
      for (const h of heads) { if (h.getBoundingClientRect().top < 140) cur = h.id; else break; }
      setActive(cur);
    };
    const t = setTimeout(onScroll, 300); addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(t); removeEventListener('scroll', onScroll); };
  }, [id]);
  const toc = useMemo(() => { if (!topic) return []; const d = document.createElement('div'); d.innerHTML = CONTENT.content[id]; return [...d.querySelectorAll<HTMLElement>('h2[id], h3[id]')].map(h => ({ id: h.id, text: h.textContent ?? '', sub: h.tagName === 'H3' })); }, [id]);
  if (!topic) return <Empty title="Tema no encontrado" action={<Button href="#temario">Ver temario</Button>} />;

  const idx = TOPICS.indexOf(topic), prev = TOPICS[idx - 1], next = TOPICS[idx + 1];
  const st = topicStatus(id), s = statsOf(id), sec = secondsOnTopic(id), hl = docs.notes.hl[id] ?? [];
  const nCards = allCards(docs.cards.own).filter(c => c.t === id).length;
  const updates = CONTENT.updates.filter(u => u.topics.includes(id));
  const minutes = Math.max(5, Math.round(htmlToText(CONTENT.content[id]).split(/\s+/).length / 190));

  return (
    <Page>
      <PageHeader compact crumbs={[{ label: 'Temario', href: '#temario' }, { label: `Bloque ${topic.b.slice(1)}, tema ${topic.n}` }]} title={topic.title} />
      <Panel>
        <div class="s-topic-meta">
          <Segmented label="Estado del tema" value={st} onChange={(v: TopicStatus) => { setTopicStatus(id, v); toast(`Tema marcado como «${STATUS_LABEL[v].toLowerCase()}»`); }} options={STATUS_LABEL.map((l, i) => [i as TopicStatus, l])} />
          <div class="u-row"><Button variant="primary" icon="test" onClick={() => startTest({ topics: [id], count: 25, mode: 'practice', label: `Test ${topicCode(id)}` })}>Test del tema ({s.total})</Button><Button icon="cards" href={`#tarjetas/${id}`}>Tarjetas ({nCards})</Button></div>
        </div>
        <p class="u-muted u-small" style={{ margin: 'var(--space-3) 0 0' }}>
          {s.seen ? `Has visto ${s.seen} de ${s.total} preguntas, con un ${pct(s.right, s.right + s.wrong)} % de aciertos.` : 'Aún no has hecho preguntas de este tema.'}
          {` Lectura de unos ${minutes} minutos.`}{sec ? ` Llevas ${hours(sec)} de estudio.` : ''} Selecciona texto de los apuntes para subrayarlo o convertirlo en tarjeta.
        </p>
      </Panel>
      {updates.map(u => <Callout tone="warn"><strong>Aviso de vigencia ({u.date}): {u.title}.</strong> {u.summary}</Callout>)}
      <details class="c-panel s-toc"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Índice del tema</summary>
        <ol style={{ marginTop: 'var(--space-3)' }}>{toc.map(h => <li class={h.sub ? 'is-sub' : ''}><a href="#" data-jump={h.id} onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); }}>{h.text}</a></li>)}</ol>
      </details>
      <details class="c-panel" open={!!docs.notes.m[id] || hl.length > 0}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Mis notas, esquema y subrayados</summary>
        <div class="u-stack" style={{ marginTop: 'var(--space-4)' }}>
          <Field label="Mi esquema" hint="Se guarda mientras escribes."><TextArea value={docs.notes.m[id] ?? ''} onInput={e => saveNote(id, (e.target as HTMLTextAreaElement).value)} placeholder="Escribe aquí tu esquema del tema…" /></Field>
          <Outline id={id} />
          {hl.length > 0 && <div><strong class="u-small">Subrayados ({hl.length})</strong><ul class="s-hl-list">{hl.map((h, k) => <li><a href="#" onClick={e => { e.preventDefault(); document.querySelector(`mark.hl[data-h="${k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{truncate(h.t, 160)}</a></li>)}</ul></div>}
        </div>
      </details>
      <ReadingProgress target={() => document.querySelector('article.reading')} />
      <div class="s-layout">
        <Reading id={id} onSelect={setSel} />
        <aside class="s-aside" aria-label="Índice del tema">
          <div class="s-aside__title">En este tema</div>
          <ol>{toc.map(h => <li class={h.sub ? 'is-sub' : ''}><a href="#" aria-current={active === h.id ? 'location' : undefined} onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); }}>{h.text.replace(/^\d+(\.\d+)*\.?\s*/, '')}</a></li>)}</ol>
        </aside>
      </div>
      {sel && <SelectionBar sel={sel} onClose={() => setSel(null)}
        onHighlight={() => { if (sel.kind === 'new' && !addHighlight(id, { t: sel.t, o: sel.o })) toast('Máximo 200 subrayados por tema'); getSelection()?.removeAllRanges(); setSel(null); }}
        onRemove={() => { if (sel.kind === 'existing') removeHighlight(id, sel.index); setSel(null); }}
        onCard={() => { const back = sel.kind === 'new' ? sel.t : hl[sel.index]?.t ?? ''; getSelection()?.removeAllRanges(); setSel(null); setCard({ open: true, back }); }} />}
      <CardForm open={card.open} onClose={() => setCard({ open: false, back: '' })} topic={id} back={card.back} />
      <nav class="s-pager" aria-label="Temas">
        {prev ? <Button icon="left" href={`#tema/${prev.id}`} aria-label={`Tema anterior: ${topicCode(prev.id)}`}><span class="s-pager__code">{topicCode(prev.id)}</span></Button> : <span />}
        {st < 2 ? <Button variant="primary" icon="check" onClick={() => { setTopicStatus(id, 2); toast('Tema marcado como estudiado'); }}><span class="s-pager__long">Marcar como estudiado</span><span class="s-pager__short">Estudiado</span></Button> : <Button variant="ghost" icon="test" onClick={() => startTest({ topics: [id], count: 25, mode: 'practice', label: `Test ${topicCode(id)}` })}>Test del tema</Button>}
        {next ? <Button href={`#tema/${next.id}`} aria-label={`Tema siguiente: ${topicCode(next.id)}`}><span class="s-pager__code">{topicCode(next.id)}</span><Icon name="right" size={18} /></Button> : <span />}
      </nav>
    </Page>
  );
}
