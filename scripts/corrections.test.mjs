import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCorrection, sameSpokenWords, wordDiff, samples } from '../lib/mirror.ts';
import { createCorrectionQueue } from '../lib/correction-queue.ts';
import { correctionRequest, validateCorrection } from '../lib/correction.ts';

test('punctuation-only and capitalization-only edits leave the transcript unchanged', () => {
 for (const [original, corrected] of [
  ['Heute fahre ich mit dem Zug nach Hamburg', 'Heute fahre ich mit dem Zug nach Hamburg.'],
  ['Gut, dann vielleicht morgen', 'Gut. Dann, vielleicht morgen.'],
  ['lesen', 'lesen…'],
  ['hello world', 'Hello, world!'],
  ['hello , world', 'Hello world .'],
 ]) {
  assert.equal(normalizeCorrection(original, { corrected, explanation: 'Added punctuation.', category: 'Punctuation' }).corrected, original);
  const diff = wordDiff(original, corrected);
  assert.ok([...diff.old, ...diff.next].every(w => !w.changed));
 }
});

test('real German corrections remain highlighted while punctuation does not', () => {
 const result = wordDiff('Gut, dann vielleicht morgen, ich besuche das Museum', 'Gut. Dann, vielleicht besuche ich das Museum.');
 assert.ok(result.next.some(w => w.changed));
 assert.ok(result.next.filter(w => /Gut|Dann|Museum/.test(w.text)).every(w => !w.changed));
 assert.equal(sameSpokenWords('mit meine Freunde', 'mit meinen Freunden'), false);
 assert.equal(sameSpokenWords('schon', 'schön'), false);
 assert.equal(sameSpokenWords('in meinen', 'inmeinen'), false);
 assert.deepEqual(normalizeCorrection('mit meine Freunde', { corrected: 'mit meinen Freunden', explanation: 'Dative plural.', category: 'Case' }), { corrected: 'mit meinen Freunden', explanation: 'Dative plural.', category: 'Case' });
});

test('all multilingual samples reconstruct exactly after word diff', () => {
 for (const turns of Object.values(samples)) for (const turn of turns) {
  const diff = wordDiff(turn.original, turn.corrected);
  assert.equal(diff.old.map(x => x.text).join(' '), turn.original);
  assert.equal(diff.next.map(x => x.text).join(' '), turn.corrected);
 }
 assert.equal(wordDiff('I I like it', 'I like it').old.filter(x => x.changed).length, 1);
});

test('unreviewed failures are not presented as successful corrections', () => {
 const value = { corrected: 'Hallo', category: 'Not reviewed', explanation: 'The session ended.' };
 assert.deepEqual(normalizeCorrection('Hallo', value), value);
});

test('a guessed continuation of an unfinished phrase is never shown as a correction', () => {
 for (const [original, corrected] of [
  ['Ich möchte morgen mit meinen Freunden', 'Ich möchte morgen mit meinen Freunden ausgehen'],
  ['I would like to', 'I would like to travel'],
 ]) {
  assert.equal(normalizeCorrection(original, { corrected, explanation: 'Completed the sentence.', category: 'Grammar' }).corrected, original);
 }
 assert.equal(normalizeCorrection('Ich würde morgen gern mit meinen Nachbarn', { corrected: 'Ich würde gern morgen mit meinen Nachbarn …', explanation: 'Unfinished.', category: 'Incomplete sentence' }).corrected, 'Ich würde morgen gern mit meinen Nachbarn');
});

const tick = () => new Promise(resolve => setImmediate(resolve));

test('two requests run concurrently and later sentences are not blocked by a slow first request', async () => {
 const queue = createCorrectionQueue(2);
 const started = [], completed = [], release = [];
 for (let i = 0; i < 3; i++) queue.enqueue(async () => {
  started.push(i);
  await new Promise(resolve => { release[i] = resolve; });
  completed.push(i);
 });
 await tick();
 assert.deepEqual(started, [0, 1]);
 release[1](); await tick();
 assert.deepEqual(completed, [1]);
 assert.deepEqual(started, [0, 1, 2]);
 release[2](); release[0](); await tick();
 assert.deepEqual(completed, [1, 2, 0]);
});

test('ending a session aborts active work, drops queued work, and allows a new session', async () => {
 const queue = createCorrectionQueue(2);
 const signals = []; let staleQueued = false, restarted = false;
 const work = signal => new Promise(resolve => { signals.push(signal); signal.addEventListener('abort', resolve, { once: true }); });
 queue.enqueue(work); queue.enqueue(work); queue.enqueue(async () => { staleQueued = true; });
 await tick(); queue.cancel();
 queue.enqueue(async () => { restarted = true; });
 await tick();
 assert.equal(signals.length, 2);
 assert.ok(signals.every(s => s.aborted));
 assert.equal(staleQueued, false);
 assert.equal(restarted, true);
});

test('a failed request releases its queue slot', async () => {
 const queue = createCorrectionQueue(1); let nextRan = false;
 queue.enqueue(async () => { throw new Error('Simulated failure'); });
 queue.enqueue(async () => { nextRan = true; });
 await tick();
 assert.equal(nextRan, true);
});

test('the correction contract is short, speech-focused, and accepts explicit model overrides', () => {
 const request = correctionRequest('Hallo', 'German', 'Grammar only', []);
 assert.equal(request.model, 'gpt-4.1-nano');
 assert.equal(request.store, false);
 assert.equal(request.max_output_tokens, 400);
 assert.ok(correctionRequest('a'.repeat(3000), 'German', 'Grammar only', []).max_output_tokens >= 1500);
 assert.ok(request.instructions.includes('Ignore punctuation'));
 assert.ok(request.instructions.includes('Leave incomplete phrases'));
 assert.equal('reasoning' in request, false);
 assert.equal(correctionRequest('Hallo', 'German', 'Sound natural', [], 'gpt-5.6-luna').reasoning.effort, 'none');
 assert.throws(() => validateCorrection({ corrected: 'Hallo' }));
 assert.throws(() => validateCorrection(null));
});
