import {requestBody,parseResponse} from './core.js';
export const DEFAULT_PROVIDER_URL='https://api.openai.com/v1';
export const providerFormats={auto:'Detectar automaticamente',responses:'Responses API',chat:'Chat Completions'};

export function normalizeProviderUrl(value=DEFAULT_PROVIDER_URL){
  let raw=String(value||'').trim();if(!raw)raw=DEFAULT_PROVIDER_URL;if(!/^[a-z][a-z\d+.-]*:\/\//i.test(raw))raw='https://'+raw;
  let url;try{url=new URL(raw);}catch{throw Error('A URL do provedor é inválida.');}
  if(url.username||url.password||url.hash)throw Error('Não coloque credenciais nem fragmentos na URL do provedor.');
  const local=['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw Error('Use HTTPS. HTTP é aceito somente em localhost.');
  url.pathname=url.pathname.replace(/\/+$/,'');return url.toString().replace(/\/$/,'');
}
export function endpointFor(value,transport){
  const url=new URL(normalizeProviderUrl(value));url.pathname=url.pathname.replace(/\/(responses|chat\/completions)$/,'').replace(/\/+$/,'')+(transport==='responses'?'/responses':'/chat/completions');return url.toString();
}
export function transportOrder(value,format='auto'){
  if(!Object.hasOwn(providerFormats,format))throw Error('Formato da API inválido.');const path=new URL(normalizeProviderUrl(value)).pathname.replace(/\/+$/,'');
  if(format!=='auto')return [format];if(path.endsWith('/chat/completions'))return ['chat'];if(path.endsWith('/responses'))return ['responses'];return new URL(normalizeProviderUrl(value)).hostname==='api.openai.com'?['responses','chat']:['chat','responses'];
}
export function requestFor(operation,input,prefs,credential,transport,structure='strict'){
  const base=requestBody(operation,input,prefs,credential.model),schema=base.text.format.schema,name=base.text.format.name;
  if(transport==='responses'){
    if(new URL(normalizeProviderUrl(credential.url)).hostname!=='api.openai.com')delete base.store;
    if(structure==='json')base.text={format:{type:'json_object'}};
    if(structure==='plain'){delete base.text;base.instructions+=' Retorne somente JSON válido que siga este JSON Schema: '+JSON.stringify(schema);}
    return {url:endpointFor(credential.url,'responses'),body:base};
  }
  const instruction=base.instructions+(structure==='strict'?'':' Retorne somente JSON válido que siga este JSON Schema: '+JSON.stringify(schema));
  const body={model:credential.model,max_tokens:base.max_output_tokens,messages:[{role:'system',content:instruction},{role:'user',content:base.input}]};
  if(structure==='strict')body.response_format={type:'json_schema',json_schema:{name,strict:true,schema}};
  if(structure==='json')body.response_format={type:'json_object'};
  return {url:endpointFor(credential.url,'chat'),body};
}
function clean(text){let raw=String(text||'').trim(),match=raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(match)raw=match[1];try{JSON.parse(raw);return raw;}catch{}const a=raw.indexOf('{'),b=raw.lastIndexOf('}');if(a>=0&&b>a){const value=raw.slice(a,b+1);JSON.parse(value);return value;}return raw;}
export function parseProviderResponse(data,operation,transport){
  if(transport==='responses')return parseResponse(data,operation);
  const message=data?.choices?.[0]?.message;if(!message)throw Error('O provedor não retornou Chat Completions compatível.');if(message.refusal)throw Error('A IA não pôde analisar este texto.');
  const content=typeof message.content==='string'?message.content:Array.isArray(message.content)?message.content.map(x=>typeof x==='string'?x:x?.text||'').join(''):'';
  return parseResponse({status:'completed',output:[{type:'message',content:[{type:'output_text',text:clean(content)}]}]},operation);
}
