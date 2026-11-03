import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const teamChat = readFileSync(new URL('../src/components/admin/TeamChat.js', import.meta.url), 'utf8');
const adminCss = readFileSync(new URL('../src/app/admin.css', import.meta.url), 'utf8');

test('team chat images cannot expand a message or the conversation horizontally', () => {
  assert.match(teamChat, /\.tc-messages\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(teamChat, /\.tc-msg-row\s*\{[^}]*max-width:\s*min\(78%,\s*680px\)/s);
  assert.match(teamChat, /\.tc-bubble\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(teamChat, /\.tc-bubble img\s*\{[^}]*max-width:\s*100%[^}]*object-fit:\s*contain/s);
});

test('WhatsApp image messages stay inside a capped chat bubble', () => {
  assert.match(adminCss, /\.admin-wa-bubble\s*\{[^}]*max-width:\s*min\(76%,\s*680px\)[^}]*overflow:\s*hidden/s);
  assert.match(adminCss, /\.admin-wa-media\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(adminCss, /\.admin-wa-media-image\s*\{[^}]*max-width:\s*100%[^}]*max-height:\s*min\(320px,\s*46dvh\)[^}]*object-fit:\s*contain/s);
});
