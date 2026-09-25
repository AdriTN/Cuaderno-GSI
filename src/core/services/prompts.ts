/**
 * Plantillas de prompts. Centralizadas para poder ajustarlas sin tocar la interfaz.
 * Cada llamada a Claude es independiente: el prompt debe incluir todo el contexto.
 */
import { LETTERS } from '../content';
import type { Question } from '../types';

const ROLE = 'Eres preparador de la oposición al Cuerpo de Gestión de Sistemas e Informática de la Administración del Estado (GSI, A2).';

export const outlinePrompt = (title: string, notes: string) => `${ROLE} A partir SOLO de los apuntes siguientes, elabora un esquema de estudio que quepa en una página.
Reglas:
- Estructura jerárquica con guiones y sangría de dos espacios, nada de párrafos.
- Palabras clave, no frases largas. Listas completas cuando el tema enumera (clasificaciones, fases, tipos).
- Marca con **doble asterisco** los datos más preguntables: cifras, plazos, artículos, siglas, órganos.
- Si hay conceptos que se confunden, añade al final una línea "Ojo, no confundir:" con la diferencia.
- No inventes nada que no aparezca en los apuntes. Escribe en español. Devuelve solo el esquema.

TEMA: ${title}

APUNTES:
${notes}`;

export const cardsPrompt = (title: string, notes: string, existing: string[]) => `${ROLE} Crea 10 tarjetas de memoria (pregunta y respuesta) a partir SOLO de estos apuntes. Prioriza lo más preguntable en un test: cifras, plazos, artículos, siglas, clasificaciones y diferencias entre conceptos. Preguntas concretas y cortas; respuestas de una o dos frases. No repitas estas tarjetas ya existentes: ${existing.join(' | ') || 'ninguna'}.
Devuelve SOLO un array JSON con 10 objetos {"f": "pregunta", "b": "respuesta"} en español.

TEMA: ${title}
APUNTES:
${notes}`;

export const explainPrompt = (q: Question, topicTitle: string, answer: number) => {
  const chose = answer >= 0 && answer !== q.c;
  return `${ROLE} Explica esta pregunta de test a un opositor, en español y en un máximo de 6 frases:
1) por qué la opción correcta es la correcta, citando el concepto, norma o artículo cuando proceda;
2) por qué ${chose ? 'la opción que eligió no lo es' : 'las otras opciones no lo son'};
3) una regla o truco breve para recordarlo.
Si la clave te parece discutible o la norma ha cambiado, dilo con claridad. Texto plano, sin markdown.

Tema: ${topicTitle}
Pregunta: ${q.s}
${q.a.map((t, k) => `${LETTERS[k]}) ${t}`).join('\n')}
Respuesta correcta según la clave: ${LETTERS[q.c]}
Respuesta del opositor: ${answer >= 0 ? LETTERS[answer] : 'en blanco'}
Explicación del material: ${q.f}`;
};

export const gradeCasePrompt = (statement: string, questions: string[], answers: string[], guide: string) => `Actúa como miembro del tribunal de la oposición GSI A2. Corrige el supuesto práctico de un opositor con la rúbrica oficial: aplicación de conocimientos técnicos (0-30), capacidad de análisis (0-10), sistemática (0-5) y expresión escrita (0-5). Sé exigente y concreto, como un tribunal real; no regales puntos. Usa la guía de corrección como referencia.

ENUNCIADO:
${statement}

PREGUNTAS Y RESPUESTAS DEL OPOSITOR:
${questions.map((p, k) => `Pregunta ${k + 1}: ${p}\nRespuesta: ${(answers[k] || '(sin responder)').slice(0, 4500)}`).join('\n\n')}

GUÍA DE CORRECCIÓN (no la reveles literalmente):
${guide.slice(0, 8000)}

Devuelve SOLO un objeto JSON con esta forma exacta:
{"technical": número, "analysis": número, "systematic": número, "expression": número, "summary": "valoración global en 2-3 frases", "questions": [{"strengths": "qué está bien", "improvements": "qué falta o sobra, concreto"}, ... una entrada por cada pregunta]}`;

export const generateCasePrompt = (focus: string, hard: boolean, context: string) => `Eres miembro del tribunal de la oposición GSI A2. Redacta un supuesto práctico NUEVO y realista para el segundo ejercicio (5 preguntas, 180 minutos; se puntúa aplicación técnica 30, análisis 10, sistemática 5, expresión 5).
Enunciado de unas 350-550 palabras: un organismo público español concreto (ficticio pero verosímil), situación de partida, datos cuantitativos (usuarios, volúmenes, picos, SLA, RTO/RPO o presupuesto cuando proceda), restricciones (plazos, equipo, tecnologías existentes, normativa: ENS, RGPD, accesibilidad, interoperabilidad, contratación pública) y alguna decisión discutible que el opositor deba analizar.
Las 5 preguntas deben exigir decisiones justificadas, cálculos o diseños (no teoría memorística) y cubrir varios temas.
Enfoque: ${focus}. Dificultad: ${hard ? 'más exigente que un examen real' : 'similar a un examen real'}.
Apóyate en estos temas del programa:
${context}

Devuelve SOLO un objeto JSON:
{"title": "título corto", "statement": "enunciado con párrafos separados por \\n\\n", "questions": ["…", "…", "…", "…", "…"], "checklist": ["4-6 comprobaciones previas a escribir"], "guide": "guía de corrección: por pregunta, puntos clave esperados, errores típicos y qué distingue una respuesta excelente (800-1500 palabras, párrafos separados por \\n\\n)"}`;
