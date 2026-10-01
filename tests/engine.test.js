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

test('Portuguese-only local rules do not leak into other or automatic languages',()=>{
  assert.equal(E.allLocalIssues('Nós vai amanhã.','en-US').length,0);
  assert.equal(E.allLocalIssues('Nós vai amanhã.','auto').length,0);
  assert.equal(E.allLocalIssues('teste teste','auto').length,1);
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
