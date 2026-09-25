import type { ComponentChildren } from 'preact';
import './panel.css';

type Props = { title?: ComponentChildren; subtitle?: ComponentChildren; actions?: ComponentChildren; tone?: 'default' | 'sunken'; flush?: boolean; class?: string; children?: ComponentChildren; id?: string };

export function Panel({ title, subtitle, actions, tone = 'default', flush, class: cls = '', children, id }: Props) {
  return (
    <section id={id} class={`c-panel ${tone === 'sunken' ? 'c-panel--sunken' : ''} ${flush ? 'c-panel--flush' : ''} ${cls}`}>
      {(title || actions) && (
        <header class="c-panel__head">
          <div>{title && <h2 class="c-panel__title">{title}</h2>}{subtitle && <p class="c-panel__sub">{subtitle}</p>}</div>
          {actions && <div class="u-row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
