const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Número de día absoluto (UTC) a partir de una fecha local: útil para comparar días sin horas. */
export const dayNum = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
export const today = () => dayNum(new Date());
export const pad = (n: number) => String(n).padStart(2, '0');
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** 0 = lunes … 6 = domingo. */
export const weekdayIdx = (d: Date) => (d.getDay() + 6) % 7;
export const mondayOf = (d: Date) => addDays(d, -weekdayIdx(d));
export const fmtShort = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const fmtLong = (d: Date) => `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
export const fmtToday = (d = new Date()) => `${WEEKDAYS_LONG[weekdayIdx(d)]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
