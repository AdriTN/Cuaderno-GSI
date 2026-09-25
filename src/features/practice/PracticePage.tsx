import { useEffect, useRef, useState } from 'preact/hooks';
import { CONTENT, packById } from '@/core/content';
import { Button, Empty, List, Page, PageHeader, Panel, Row, Tabs } from '@/ui';
import '@/styles/reading.css';

export function PracticeListPage() {
  return (
    <Page>
      <PageHeader title="Cuadernos prácticos" lede="19 cuadernos de ejercicios con su solucionario razonado: cálculos de redes, bases de datos, planificación de proyectos, seguridad y supuestos integradores. Intenta cada ejercicio antes de abrir la solución." />
      <Panel flush><div style={{ padding: 'var(--space-2) var(--space-4)' }}><List>{CONTENT.packs.map(p => <li><Row href={`#cuaderno/${p.id}`} lead={p.id} title={p.name} /></li>)}</List></div></Panel>
    </Page>
  );
}

export function PracticePage({ id }: { id: string }) {
  const pack = packById[id];
  const [tab, setTab] = useState<'cuaderno' | 'solucionario'>('cuaderno');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { setTab('cuaderno'); }, [id]);
  useEffect(() => { if (ref.current && pack) ref.current.innerHTML = pack[tab] ?? '<p>No disponible.</p>'; }, [id, tab]);
  if (!pack) return <Empty title="Cuaderno no encontrado" action={<Button href="#cuadernos">Ver cuadernos</Button>} />;
  return (
    <Page>
      <PageHeader compact crumbs={[{ label: 'Cuadernos prácticos', href: '#cuadernos' }, { label: id }]} title={pack.name} />
      <Tabs label="Parte del cuaderno" value={tab} onChange={setTab} items={[['cuaderno', 'Ejercicios'], ['solucionario', 'Solucionario']]} />
      <article ref={ref} class="reading" style={{ maxWidth: 'none' }} />
    </Page>
  );
}
