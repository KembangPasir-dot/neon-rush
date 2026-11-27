// NEON RUSH — inline build (dev convenience only, NOT part of the entry).
// Reads game/index.template.html + game/vendor/three.min.js + game/src/*.js
// and writes the single self-contained game/index.html the brief asks for
// (no <script src> left, no network at runtime). Run: node inline-build.mjs
// Safety: refuses if any inlined source contains "</script" (which would
// close the script tag early) or if the result is over the 1 MiB cap.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

let html = read('game/index.template.html');
const three = read('game/vendor/three.min.js');
const order = ['util', 'audio', 'input', 'world', 'plane', 'effects', 'hud', 'main'];
const srcs = order.map((n) => read('game/src/' + n + '.js'));

for (const [name, code] of [['three.min.js', three], ...order.map((n, i) => [n + '.js', srcs[i]])]) {
  if (code.includes('</script')) throw new Error('inline-build: ' + name + ' contains "</script" — cannot inline safely');
}

// NOTE: replacements use a function replacer, never a string: the
// inlined code contains "$&" (three.min.js has one), and String.replace
// would expand it into a copy of the matched tag.
html = html.replace(
  '<script src="./vendor/three.min.js"></script>',
  () => '<script>\n' + three + '\n</script>',
);
for (const n of order) {
  const tag = '<script src="./src/' + n + '.js"></script>';
  if (!html.includes(tag)) throw new Error('inline-build: template is missing ' + tag);
  html = html.replace(tag + '\n', '');
}
html = html.replace('</body>', () => '<script>\n' + srcs.join('\n;\n') + '\n</script>\n</body>');

if (html.includes('<script src=')) throw new Error('inline-build: a <script src> survived');
const bytes = Buffer.byteLength(html, 'utf8');
if (bytes > 1048576) throw new Error('inline-build: index.html is ' + bytes + ' bytes, over the 1 MiB cap');
writeFileSync(join(here, 'game', 'index.html'), html);
console.log('NEON RUSH single-file index.html: ' + bytes + ' bytes');
