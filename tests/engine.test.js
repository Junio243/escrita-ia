import {test} from 'node:test';
import assert from 'node:assert/strict';
import {E} from '../core.js';

test('duplicate words are flagged with exact positions',()=>{
  const found=E.localIssues('isso isso é um teste');
  assert.equal(found.length,1);
  const [issue]=found;
  assert.equal(issue.category,'grammar');
  assert.equal(issue.rule,'Palavra duplicada');
  assert.equal(issue.quote,'isso isso');
  assert.deepEqual(issue.replacements,['isso']);
  assert.equal('isso isso é um teste'.slice(issue.start,issue.end),issue.quote);
});

test('duplicate detection ignores case and handles accents',()=>{
  assert.equal(E.localIssues('Teste teste').length,1);
  assert.equal(E.localIssues('Teste teste')[0].replacements[0],'Teste');
  assert.equal(E.localIssues('quero café café agora').length,1);
  assert.equal(E.localIssues('palavra\npalavra').length,1);
});

test('duplicate detection avoids single letters and distinct words',()=>{
  assert.equal(E.localIssues('a a').length,0);
  assert.equal(E.localIssues('e e').length,0);
  assert.equal(E.localIssues('isso aquilo').length,0);
  assert.equal(E.localIssues('teste testando').length,0);
});

test('triple repetition flags one pair per pass',()=>{
  assert.equal(E.localIssues('foi foi foi').length,1);
});

test('duplicate issues survive the merge pipeline',()=>{
  const text='veja veja isso';
  const merged=E.merge(E.localIssues(text),text,{},'pt-BR');
  assert.equal(merged.length,1);
  assert.equal(merged[0].source,'local');
});

test('Portuguese local review catches accents and selected grammar rules',()=>{
  const accent=E.allLocalIssues('A minha familia e eu estudamos.','pt-BR');
  assert.equal(accent.length,1);
  assert.equal(accent[0].rule,'Acentuação');
  assert.equal(accent[0].quote,'familia');
  const grammar=E.allLocalIssues('Nós vai amanhã.','pt-BR');
  assert.equal(grammar.length,1);
  assert.equal(grammar[0].rule,'Concordância verbal');
  assert.deepEqual(grammar[0].replacements,['Nós vamos']);
});

test('revisão automática detecta português claro e evita outros idiomas',()=>{
  assert.equal(E.allLocalIssues('Nós vai amanhã.','en-US').length,0);
  const autoPortuguese=E.allLocalIssues('Nós vai amanhã. Amanhã eu vou.','auto');
  assert.equal(autoPortuguese.filter(i=>i.rule==='Concordância verbal').length,1);
  const autoAccent=E.allLocalIssues('A minha familia e eu estudamos.','auto');
  assert.equal(autoAccent.filter(i=>i.rule==='Acentuação').length,1);
  assert.equal(E.allLocalIssues('teste teste','auto').length,1);
  assert.equal(E.allLocalIssues('the cat and the dog','auto').length,0);
});

test('metrics and chunks handle empty input',()=>{
  assert.deepEqual(E.metrics(''),{words:0,characters:0});
  assert.deepEqual(E.chunks(''),[]);
});

test('norm folds case and combining marks',()=>{
  assert.equal(E.norm('VOCE'),E.norm('voce'));
  assert.equal(E.norm('Á'),'á');
});

test('locate rejects context mismatches',()=>{
  const issue={quote:'teste',left:'x ',right:''};
  assert.equal(E.locate('teste teste',issue),null);
  assert.deepEqual(E.locate('x teste',{quote:'teste',left:'x ',right:''}),{start:2,end:7});
});

test('textStats calculates words, sentences, paragraphs, reading time and readability',()=>{
  const empty=E.textStats('');
  assert.equal(empty.words,0);
  assert.equal(empty.sentences,0);
  assert.equal(empty.paragraphs,0);
  assert.equal(empty.readingTimeMinutes,0);
  assert.equal(empty.readability,'Vazio');
  const stats=E.textStats('Primeira frase clara. Segunda frase curta.\n\nSegundo parágrafo aqui.');
  assert.equal(stats.words,9);
  assert.equal(stats.sentences,3);
  assert.equal(stats.paragraphs,2);
  assert.equal(stats.readingTimeMinutes,1);
  assert(stats.uniqueWords>=7);
});

test('cleanText normalizes duplicate spaces, space before punctuation and extra blank lines',()=>{
  assert.equal(E.cleanText('Olá ,  mundo !   \n\n\n\nTudo  bem ?'), 'Olá, mundo!\n\nTudo bem?');
});

test('expanded Portuguese rules catch orthography, impersonal verbs, crase and punctuation spacing',()=>{
  const issues=E.allLocalIssues('Concerteza faz sentido , mas fazem dois anos que fui a aquele lugar.','pt-BR');
  const rules=issues.map(i=>i.rule);
  assert(rules.includes('Grafia'));
  assert(rules.includes('Espaço antes da pontuação'));
  assert(rules.includes('Concordância verbal'));
  assert(rules.includes('Crase'));
});

test('banco de corretores locais sugere formas por extenso',()=>{
  const issues=E.dbIssues('vc tmb pq qdo blz', 'pt-BR');
  const map=Object.fromEntries(issues.map(i=>[i.quote,i.replacements[0]]));
  assert.equal(map.vc,'você');
  assert.equal(map.tmb,'também');
  assert.equal(map.pq,'porque');
  assert.equal(map.qdo,'quando');
  assert.equal(map.blz,'beleza');
  assert(issues.every(i=>i.source==='local'));
});

test('banco local ignora palavras já cobertas por acentos',()=>{
  assert.equal(E.dbIssues('familia', 'pt-BR').length,0);
});

test('banco local respeita maiúsculas',()=>{
  const [issue]=E.dbIssues('VC', 'pt-BR');
  assert.equal(issue.replacements[0],'Você');
});

test('allLocalIssues inclui banco local',()=>{
  const issues=E.allLocalIssues('vc tmb.', 'pt-BR');
  assert(issues.some(i=>i.quote==='vc' && i.replacements[0]==='você'));
  assert(issues.some(i=>i.quote==='tmb' && i.replacements[0]==='também'));
});

test('banco local não vaza para outros idiomas',()=>{
  assert.equal(E.dbIssues('vc tmb', 'en-US').length,0);
  assert.equal(E.allLocalIssues('vc tmb', 'auto').length,0);
});

test('gramática local offline cobre concordância verbal comum',()=>{
  const issues=E.allLocalIssues('Nós vai amanhã. Eu vamos sair. A gente vamos conversar. Eles tem razão. Ele estão bem.','pt-BR');
  const found=Object.fromEntries(issues.filter(i=>i.rule==='Concordância verbal').map(i=>[i.quote,i.replacements[0]]));
  assert.equal(found['Nós vai'],'Nós vamos');
  assert.equal(found['Eu vamos'],'Eu vou');
  assert.equal(found['A gente vamos'],'A gente vai');
  assert.equal(found['Eles tem'],'Eles têm');
  assert.equal(found['Ele estão'],'Ele está');
  assert.equal(issues.filter(i=>i.rule==='Concordância verbal').length,5);
});

test('crase local de destino comum funciona sem IA',()=>{
  const issues=E.allLocalIssues('Vou a escola de manhã. Ela foi a igreja. Nós vamos a praia.','pt-BR');
  const crase=issues.filter(i=>i.rule==='Crase');
  assert.equal(crase.length,3);
  assert.equal(crase[0].quote,'a escola');
  assert.equal(crase[0].replacements[0],'à escola');
});

test('gramática local evita corrupção em construções válidas',()=>{
  const compound=E.allLocalIssues('Você e eu vamos ao cinema.','pt-BR');
  assert.equal(compound.filter(i=>i.rule==='Concordância verbal').length,0);
  const quantified=E.allLocalIssues('Um de nós vai viajar amanhã.','pt-BR');
  assert.equal(quantified.filter(i=>i.rule==='Concordância verbal').length,0);
  const agent=E.allLocalIssues('O agente vai viajar.','pt-BR');
  assert.equal(agent.filter(i=>i.rule==='Gramática').length,0);
  const publico=E.allLocalIssues('Eu publico artigos semanais.','pt-BR');
  assert.equal(publico.filter(i=>i.rule==='Acentuação').length,0);
  const duration=E.allLocalIssues('Fazem três meses que não saio.','pt-BR');
  const durationIssue=duration.find(i=>i.rule==='Concordância verbal');
  assert.equal(durationIssue.replacements[0],'Faz três meses');
});

test('detecção automática reconhece português sem acentos',()=>{
  const issues=E.allLocalIssues('Voce vai amanha?','auto');
  assert(issues.some(i=>i.quote==='Voce'&&i.replacements[0]==='Você'));
  const english=E.allLocalIssues('The amateur bomb squad was so proud.','auto');
  assert.equal(english.filter(i=>i.rule==='Acentuação').length,0);
});

test('regras locais ignoram URLs e e-mails',()=>{
  assert.equal(E.accentIssues('veja https://exemplo.com/ate/fim','pt-BR').length,0);
  assert.equal(E.dbIssues('meu e-mail é vc.silva@exemplo.com','pt-BR').length,0);
});

test('acentuação funciona no fim da frase',()=>{
  const issues=E.accentIssues('O trabalho foi facil.','pt-BR');
  assert.equal(issues.length,1);
  assert.equal(issues[0].replacements[0],'fácil');
});
