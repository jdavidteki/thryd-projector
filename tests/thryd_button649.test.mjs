// v649 (Jesuye 5:28 PM "instead of \"send\", that button on god should be \"#thryd\"")
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), ai = rd('assets/intent_ai.js');

test('job card send button reads #thryd (label, aria-label, title), same send', ()=>{
  assert.match(js, /\? '#thryd again' : '#thryd'\)\); go\.disabled = locked;/);
  assert.match(js, /go\.setAttribute\('aria-label', '#thryd/);
  assert.match(js, /go\.title = '#thryd/);
  assert.match(js, /tapOnce\(go, \(\) => sendCard\(go\)\)/);
  assert.match(js, /if\(e\.key === 'Enter'\)\{ e\.preventDefault\(\); sendCard\(/);
  assert.doesNotMatch(js, /: 'Send'\)\)/);
  assert.match(js, /\.aicgo\{[^}]*min-width:104px;white-space:nowrap/);
});

test('[[god]] composer button reads #thryd', ()=>{
  assert.match(ai, /sendBtn\.textContent = '#thryd'/);
  assert.match(ai, /sendBtn\.setAttribute\('aria-label', '#thryd/);
  assert.match(ai, /sendBtn\.title = '#thryd/);
  assert.match(ai, /#aisend\{[^}]*white-space:nowrap/);
});
