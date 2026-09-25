import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = new URL('../dist-site/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../site/', import.meta.url), output, { recursive: true });
await cp(new URL('../engine.js', import.meta.url), new URL('engine.js', output));
await cp(new URL('../icons/', import.meta.url), new URL('icons/', output), { recursive: true });
console.log(`Site pronto: ${fileURLToPath(output)}`);
