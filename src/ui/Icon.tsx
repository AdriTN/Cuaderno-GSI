/** Iconos propios en SVG (trazo de 1,8 px sobre rejilla de 24). */
const PATHS = {
  today: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4M8 14h3',
  book: 'M5 4.5h9.5A4.5 4.5 0 0 1 19 9v11H9.5A4.5 4.5 0 0 1 5 15.5zM9 9h6M9 12.5h6',
  test: 'M5 5h14v14H5zM8.5 12l2.3 2.3L15.5 9.6',
  repeat: 'M4.5 12a7.5 7.5 0 1 0 2.6-5.7M4.5 4v4.5H9',
  cards: 'M7 7.5 15.8 5l2.7 10.2-8.8 2.4zM5.5 10.5 7.9 19.4',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4.5l2.5 1.5M9.5 2.5h5',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  folder: 'M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2H19A1.5 1.5 0 0 1 20.5 9v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z',
  chart: 'M4.5 19.5h15M7.5 16v-5M12 16V7.5M16.5 16v-3',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 13.5h2M11 13.5h2M14 13.5h2M8 16.5h2M11 16.5h2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  play: 'M8 5.5v13l10-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  left: 'M14.5 6 8.5 12l6 6',
  right: 'M9.5 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  flag: 'M5.5 21V4.5M5.5 5h11l-2 4 2 4h-11',
  spark: 'M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  target: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  layers: 'M12 4 3.5 8.5 12 13l8.5-4.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  external: 'M13.5 5h5.5v5.5M19 5l-8 8M17 14v5H5V7h5',
  sync: 'M5 11a7 7 0 0 1 12.2-4.5L19.5 9M19 13a7 7 0 0 1-12.2 4.5L4.5 15M19.5 4.5V9H15M4.5 19.5V15H9',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, class: cls = '' }: { name: IconName; size?: number; class?: string }) {
  const fill = name === 'play';
  return (
    <svg class={`c-icon ${cls}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width={name === 'more' ? 3 : 1.8} stroke-linecap="round" stroke-linejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
