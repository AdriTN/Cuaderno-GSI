import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { BLOCKS, CONTENT, TOPICS } from '@/core/content';
import { secondsOnTopic, statsOf, topicStatus } from '@/core/store/selectors';
import { onReset, useDocs } from '@/core/store/store';
import { hours } from '@/core/utils/format';
import { htmlToText } from '@/core/utils/text';
import { Empty, Input, List, Page, PageHeader, Panel, Row, Segmented, StatusDot } from '@/ui';
import './syllabus.css';

const filter = signal<{ block: string; q: string }>({ block: 'all', q: '' });
onReset(() => { filter.value = { block: 'all', q: '' }; });
let textIndex: Record<string, string> | null = null;
const searchIndex = () => (textIndex ??= Object.fromEntries(TOPICS.map(t => [t.id, htmlToText(CONTENT.content[t.id]).toLowerCase()])));

export function SyllabusPage() {
  useDocs();
  const { block, q } = filter.value, query = q.trim().toLowerCase();
  const shown = useMemo(() => TOPICS.filter(t => (block === 'all' || t.b === block) && (!query || t.title.toLowerCase().includes(query) || searchIndex()[t.id].includes(query))), [block, query]);
  const done = TOPICS.filter(t => topicStatus(t.id) >= 2).length;
  return (
    <Page>
      <PageHeader title="Temario" lede={`57 temas del programa oficial (Anexo IX, BOE-A-2025-26262). Llevas ${done} estudiados o dominados.`} />
      <div class="s-toolbar">
        <Segmented label="Filtrar por bloque" value={block} onChange={b => (filter.value = { ...filter.value, block: b })} options={[['all', 'Todos'], ...BLOCKS.map(b => [b.id, `B${b.n}`] as [string, string])]} />
        <Input class="s-search" type="search" placeholder="Buscar en títulos y apuntes" aria-label="Buscar en el temario" value={q} onInput={e => (filter.value = { ...filter.value, q: (e.target as HTMLInputElement).value })} />
      </div>
      {BLOCKS.filter(b => block === 'all' || b.id === block).map(b => {
        const ts = shown.filter(t => t.b === b.id); if (!ts.length) return null;
        return (
          <Panel title={`Bloque ${b.n}. ${b.title}`} subtitle={`${ts.length} temas`}>
            <List>{ts.map(t => { const s = statsOf(t.id), sec = secondsOnTopic(t.id); return <li><Row href={`#tema/${t.id}`} icon={<StatusDot status={topicStatus(t.id)} />} title={t.title} meta={`Tema ${t.n}`} trail={<span class="u-num" title="Tiempo y preguntas vistas">{sec ? `${hours(sec)} · ` : ''}{s.seen}/{s.total}</span>} /></li>; })}</List>
          </Panel>
        );
      })}
      {!shown.length && <Empty title="Sin resultados">Ningún tema contiene «{q}».</Empty>}
    </Page>
  );
}
