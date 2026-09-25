import type { ComponentChildren, JSX } from 'preact';
import './button.css';
import { Icon, type IconName } from './Icon';

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName; iconOnly?: boolean; block?: boolean;
  href?: string; target?: string; rel?: string; children?: ComponentChildren; class?: string;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'icon'>;

/** Botón o enlace con aspecto de botón. `iconOnly` exige `aria-label`. */
export function Button({ variant = 'secondary', size = 'md', icon, iconOnly, block, href, target, rel, children, class: cls = '', ...rest }: Props) {
  const className = ['c-btn', `c-btn--${variant}`, size !== 'md' && `c-btn--${size}`, iconOnly && 'c-btn--icon', block && 'c-btn--block', cls].filter(Boolean).join(' ');
  const body = <>{icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}{!iconOnly && children}</>;
  if (href) return <a class={className} href={href} target={target} rel={rel ?? (target === '_blank' ? 'noopener' : undefined)} {...(rest as any)}>{body}</a>;
  return <button type="button" class={className} {...rest}>{body}</button>;
}
