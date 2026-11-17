// in-browser AI on top of smart taps (Jesuye 17 Nov 2026 👍): lazy worker, MiniLM embeddings, bonus into scoreOf, ?noai=1, Chrome Prompt API bonus
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const ai = fs.readFileSync(new URL('../assets/intent_ai.js', import.meta.url), 'utf8');
const wk = fs.readFileSync(new URL('../assets/intent_ai_worker.js', import.meta.url), 'utf8');
const st = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const ix = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('loads after stage.js, lazily, in a module worker, with an opt-out', () => {
  assert.match(ix, /'intent_ai\.js\?v=\d+'/); assert.match(ai, /new Worker\('assets\/intent_ai_worker\.js\?v=\d+', \{type: 'module'\}\)/);
  assert.match(ai, /noai=1/); assert.match(ai, /requestIdleCallback/); assert.match(ai, /saveData/); assert.match(ai, /deviceMemory/);
  assert.match(wk, /@huggingface\/transformers@\d/); assert.match(wk, /Xenova\/all-MiniLM-L6-v2/); assert.match(wk, /dtype: 'q8'/);
});
test('the AI bonus feeds the existing scoring rule and can never auto-fire by itself', () => {
  assert.match(st, /\.5 \* Math\.min\(1, freq\) \+ \.3 \* rec \+ \.2 \* fitOf\(x, g\) \+ aiB\(c, x\)/);
  assert.match(ai, /return Math\.round\(\.2 \* Math\.max\(0, Math\.min\(1, \(s - \.25\) \/ \.6\)\) \* 1000\) \/ 1000/);
});
test('typed commands: nearest real function, auto-apply only when confident; Chrome AI only when available', () => {
  assert.match(ai, /top\[0\]\.s >= \.82 && conf >= \.08 && top\[0\]\.live/); assert.match(ai, /LanguageModel/); assert.match(ai, /\^\(available\|readily\)\$/);
});
