import { authorize, key, noStore, isLanguage } from '@/lib/server';
import { correctionRequest, DEFAULT_CORRECTION_MODEL, validateCorrection } from '@/lib/correction';
import { normalizeCorrection } from '@/lib/mirror';

export async function POST(request: Request) {
 const denied = await authorize(request);
 if (denied) return denied;
 if (!key()) return Response.json({ error: 'Personal corrections need an OpenAI API connection. You can explore sample corrections in demo mode.' }, { status: 503, headers: noStore });
 const started = performance.now();
 const model = process.env.OPENAI_TEXT_MODEL || DEFAULT_CORRECTION_MODEL;
 try {
  const raw = await request.text();
  if (raw.length > 12000) return Response.json({ error: 'Please use a shorter sentence.' }, { status: 413, headers: noStore });
  const b = JSON.parse(raw);
  if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 3000 || !isLanguage(b.language) || !['Sound natural', 'Grammar only'].includes(b.style)) {
   return Response.json({ error: 'Please enter a sentence of up to 3,000 characters and valid practice settings.' }, { status: 400, headers: noStore });
  }
  const context = Array.isArray(b.context) ? b.context.filter((x: unknown) => typeof x === 'string').slice(-3).map((x: string) => x.slice(0, 1000)) : [];
  const response = await fetch('https://api.openai.com/v1/responses', {
   method: 'POST', headers: { Authorization: 'Bearer ' + key(), 'Content-Type': 'application/json' },
   signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
   body: JSON.stringify(correctionRequest(b.text, b.language, b.style, context, model)),
  });
  if (!response.ok) return Response.json({ error: response.status === 429 ? 'Corrections are temporarily unavailable because the API limit was reached.' : 'This sentence could not be corrected. Please try again.' }, { status: 502, headers: noStore });
  const result = await response.json() as { status?: string; output?: { content?: { type: string; text?: string }[] }[] };
  if (result.status === 'incomplete') throw new Error('Incomplete correction');
  const text = (result.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text || '').join('');
  const correction = normalizeCorrection(b.text, validateCorrection(JSON.parse(text)));
  const durationMs = Math.round(performance.now() - started);
  // Timing metadata only: never log the learner's speech or credentials.
  console.info('[Fluent Mirror] correction', { model, durationMs });
  return Response.json({ ...correction, timing: { model, durationMs } }, { headers: { ...noStore, 'Server-Timing': 'correction;dur=' + durationMs } });
 } catch (error) {
  return Response.json({ error: error instanceof SyntaxError ? 'The correction response could not be read. Please try again.' : 'The correction could not finish. Please try again.' }, { status: 502, headers: noStore });
 }
}
