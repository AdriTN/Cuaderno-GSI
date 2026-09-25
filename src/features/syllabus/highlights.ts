/**
 * Subrayado persistente sobre HTML estático. Cada subrayado se guarda como {texto, nº de aparición}
 * y se restaura envolviendo los nodos de texto en <mark>, sin alterar el textContent del artículo.
 */
import type { Highlight } from '@/core/types';
import { nthIndexOf } from '@/core/utils/text';

function textNodes(root: Node): Text[] {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const out: Text[] = []; let n: Node | null;
  while ((n = w.nextNode())) out.push(n as Text);
  return out;
}

function wrap(root: HTMLElement, start: number, end: number, index: number) {
  let pos = 0;
  for (const n of textNodes(root)) {
    const len = n.data.length, a = pos, b = pos + len; pos = b;
    if (b <= start || a >= end) continue;
    let node = n; const s0 = Math.max(0, start - a), e0 = Math.min(len, end - a);
    if (e0 < len) node.splitText(e0);
    if (s0 > 0) node = node.splitText(s0);
    if (!node.data.trim()) continue;
    const mark = document.createElement('mark'); mark.className = 'hl'; mark.dataset.h = String(index);
    node.parentNode!.insertBefore(mark, node); mark.appendChild(node);
  }
}

export function applyHighlights(root: HTMLElement, list: Highlight[]) {
  list.forEach((h, k) => { const i = nthIndexOf(root.textContent ?? '', h.t, h.o); if (i >= 0) wrap(root, i, i + h.t.length, k); });
}

/** Convierte la selección actual (si está dentro de `root`) en un subrayado almacenable. */
export function selectionToHighlight(root: HTMLElement): { highlight: Highlight; rect: DOMRect } | null {
  const sel = getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;
  const raw = r.toString(), text = raw.trim();
  if (text.length < 3) return null;
  const before = document.createRange(); before.setStart(root, 0); before.setEnd(r.startContainer, r.startOffset);
  const offset = before.toString().length + (raw.length - raw.trimStart().length);
  const full = root.textContent ?? ''; let o = 0, i = -1;
  while ((i = full.indexOf(text, i + 1)) >= 0 && i < offset) o++;
  return { highlight: { t: text.slice(0, 800), o }, rect: r.getBoundingClientRect() };
}
