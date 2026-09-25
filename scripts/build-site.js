import { cp, mkdir, rm, readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const output = new URL('../dist-site/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../site/', import.meta.url), output, { recursive: true });
await cp(new URL('../engine.js', import.meta.url), new URL('engine.js', output));
await cp(new URL('../icons/', import.meta.url), new URL('icons/', output), { recursive: true });
// Bind each HTML deployment to its matching assets, even in returning browsers.
let html = await readFile(new URL('index.html', output), 'utf8');
for (const asset of ['style.css', 'demo.js', 'engine.js']) {
  const contents = await readFile(new URL(asset, output));
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12);
  const versioned = asset.replace(/\.(css|js)$/, `.${hash}.$1`);
  await writeFile(new URL(versioned, output), contents);
  await unlink(new URL(asset, output));
  html = html.replaceAll(`"${asset}"`, `"${versioned}"`);
}
await writeFile(new URL('index.html', output), html);
console.log(`Site pronto: ${fileURLToPath(output)}`);
