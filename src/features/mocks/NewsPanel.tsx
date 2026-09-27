import { useEffect } from 'preact/hooks';
import { LIVE } from '@/core/content';
import { commit, docs, useDocs } from '@/core/store/store';
import { Button, Callout, Empty, Icon, Panel, Tag } from '@/ui';

/**
 * Novedades de la oposición detectadas por el vigilante diario (scripts/check_updates.py).
 * Lo «ya visto» se guarda en el documento sincronizado `misc`: lo que ves en un dispositivo deja de salir
 * como nuevo en los demás.
 */
const OLD_SEEN_KEY = 'cuaderno-gsi-news-seen'; // versiones anteriores lo guardaban solo en este navegador
try { const old = localStorage.getItem(OLD_SEEN_KEY); if (old) { localStorage.removeItem(OLD_SEEN_KEY); if (!docs.misc.news) { docs.misc.news = old; commit('misc'); } } } catch { /* */ }
const latest = LIVE.news[0]?.id ?? '';
export const unseenNews = () => { const seen = docs.misc.news; if (!latest || seen === latest) return 0; const i = LIVE.news.findIndex(n => n.id === seen); return i < 0 ? LIVE.news.length : i; };
const markSeen = () => { if (!latest || docs.misc.news === latest) return; docs.misc.news = latest; commit('misc'); };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export function NewsPanel() {
  useDocs();
  const count = unseenNews();
  useEffect(() => { const t = setTimeout(markSeen, 1500); return () => clearTimeout(t); }, []);
  return (
    <Panel id="novedades" title="Novedades de la oposición" subtitle={LIVE.checked ? `BOE e INAP revisados automáticamente cada día. Última comprobación: ${fmt(LIVE.checked)}.` : 'BOE e INAP se revisan automáticamente cada día en la versión publicada en GitHub.'}
      actions={count > 0 && <Tag tone="mark">{count} sin ver</Tag>}>
      {LIVE.news.length ? <ul class="n-list">{LIVE.news.slice(0, 12).map((n, i) => (
        <li class={i < count ? 'is-new' : ''}>
          <div class="n-list__meta"><span>{n.source}</span><span>{fmt(n.date)}</span></div>
          <a href={n.url} target="_blank" rel="noopener">{n.title}<Icon name="right" size={14} /></a>
        </li>))}</ul>
        : <Empty>{LIVE.checked ? 'Sin novedades desde que empezó la vigilancia.' : 'Aún no hay comprobaciones. Cuando publiques la app en GitHub, se revisarán el BOE y el INAP cada mañana.'}</Empty>}
    </Panel>
  );
}

/** Aviso para Hoy cuando hay novedades sin ver. */
export function NewsCallout() {
  useDocs();
  const count = unseenNews();
  if (!count) return null;
  return <Callout tone="info" action={<Button size="sm" variant="primary" href="#examen">Ver novedades</Button>}>Hay {count === 1 ? 'una novedad' : `${count} novedades`} de la oposición: {LIVE.news[0].title.slice(0, 90)}{LIVE.news[0].title.length > 90 ? '…' : ''}</Callout>;
}
