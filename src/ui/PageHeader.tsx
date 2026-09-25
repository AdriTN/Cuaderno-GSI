import type { ComponentChildren } from 'preact';
import './page.css';

type Crumb = { label: string; href?: string };
type Props = { title: ComponentChildren; lede?: ComponentChildren; crumbs?: Crumb[]; actions?: ComponentChildren; compact?: boolean };

export function PageHeader({ title, lede, crumbs, actions, compact }: Props) {
  return (
    <header class="c-page__head">
      {crumbs && crumbs.length > 0 && (
        <nav class="c-page__crumbs" aria-label="Ruta">
          {crumbs.map((c, i) => <>{i > 0 && <span aria-hidden="true">/</span>}{c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}</>)}
        </nav>
      )}
      <h1 class={`c-page__title ${compact ? 'c-page__title--sm' : ''}`}>{title}</h1>
      {lede && <p class="c-page__lede">{lede}</p>}
      {actions && <div class="c-page__actions u-row">{actions}</div>}
    </header>
  );
}

export const Page = ({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) => <div class={`c-page u-enter ${cls}`}>{children}</div>;
