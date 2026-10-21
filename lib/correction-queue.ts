// Independent sentences may run together; results update their original slots.
export function createCorrectionQueue(concurrency = 2) {
 let waiting: ((signal: AbortSignal) => Promise<void>)[] = [];
 const active = new Set<AbortController>();
 let generation = 0;
 function pump() {
  while (waiting.length && active.size < concurrency) {
   const work = waiting.shift()!;
   const controller = new AbortController();
   const ticket = generation;
   active.add(controller);
   void Promise.resolve().then(() => {
    if (!controller.signal.aborted) return work(controller.signal);
   }).catch(() => {
    // The caller reports request failures; release capacity after failures too.
   }).finally(() => {
    active.delete(controller);
    if (ticket === generation) pump();
   });
  }
 }
 return {
  enqueue(work: (signal: AbortSignal) => Promise<void>) { waiting.push(work); pump(); },
  cancel() {
   generation++;
   waiting = [];
   for (const controller of active) controller.abort();
   active.clear();
  },
 };
}
