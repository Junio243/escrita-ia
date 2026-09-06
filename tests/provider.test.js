import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProviderUrl,endpointFor,transportOrder,requestFor,parseProviderResponse} from '../provider.js';
const prefs={language:'pt-BR',picky:false},credential={url:'https://example.com/v1',model:'modelo'};
test('normalizes safe provider URLs and resolves complete endpoints',()=>{
  assert.equal(normalizeProviderUrl('example.com/v1/'),'https://example.com/v1');assert.equal(normalizeProviderUrl('http://localhost:11434/v1'),'http://localhost:11434/v1');assert.equal(normalizeProviderUrl('http://[::1]:11434/v1'),'http://[::1]:11434/v1');
  assert.equal(endpointFor('https://example.com/v1/responses','chat'),'https://example.com/v1/chat/completions');assert.deepEqual(transportOrder('https://example.com/v1/chat/completions','auto'),['chat']);
  assert.deepEqual(transportOrder('https://example.com/v1','auto'),['chat','responses']);assert.deepEqual(transportOrder('https://api.openai.com/v1','auto'),['responses','chat']);
  for(const value of ['ftp://example.com/v1','http://example.com/v1','https://u:p@example.com/v1','https://example.com/v1#secret'])assert.throws(()=>normalizeProviderUrl(value));
});
test('builds Responses and Chat Completions requests in strict, JSON and plain modes',()=>{
  for(const transport of ['responses','chat'])for(const structure of ['strict','json','plain']){const r=requestFor('analyze',{text:'Teste'},prefs,credential,transport,structure);assert(r.url.includes(transport==='responses'?'/responses':'/chat/completions'));assert.equal(r.body.model,'modelo');}
  assert.equal(requestFor('analyze',{text:'Teste'},prefs,credential,'responses','strict').body.store,undefined);
  const chat=requestFor('analyze',{text:'Teste'},prefs,credential,'chat','strict').body;assert.equal(chat.response_format.type,'json_schema');assert.equal(JSON.parse(chat.messages[1].content).text,'Teste');
});
test('parses Chat Completions text, content arrays and fenced JSON',()=>{
  const value={language:'pt-BR',issues:[]};
  for(const content of [JSON.stringify(value),'```json\n'+JSON.stringify(value)+'\n```',[{type:'text',text:JSON.stringify(value)}]])assert.deepEqual(parseProviderResponse({choices:[{message:{content}}]},'analyze','chat'),value);
  assert.throws(()=>parseProviderResponse({choices:[]},'analyze','chat'));
});
