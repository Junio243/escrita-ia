import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {E,requestBody} from '../core.js';
const corpus=JSON.parse(readFileSync(new URL('./linguistic-cases.json',import.meta.url),'utf8'));
test('corpus covers every category and every configured language variant',()=>{
  const locales=new Set([...corpus.cases.map(x=>x.language),...Object.keys(corpus.samples)]);
  assert.deepEqual([...locales].sort(),Object.keys(E.languages).filter(x=>x!=='auto').sort());
  assert.deepEqual([...new Set(corpus.cases.map(x=>x.category).filter(Boolean))].sort(),Object.keys(E.categories).sort());
});
test('unicode samples survive request serialization without normalization or translation',()=>{
  for(const [language,text]of Object.entries(corpus.samples)){
    const r=requestBody('analyze',{text},{language,picky:false},'gpt-4.1-mini');assert.equal(JSON.parse(r.input).text,text);
  }
});
