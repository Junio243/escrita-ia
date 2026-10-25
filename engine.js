(() => {
  const languages = Object.fromEntries([
    ['auto','Detectar automaticamente'],['pt-BR','Português · Brasil'],['pt-PT','Português · Portugal'],['en-US','English · US'],['en-GB','English · UK'],
    ['es','Espanhol'],['fr','Francês'],['de','Alemão'],['it','Italiano'],['nl','Neerlandês'],['ca','Catalão'],['gl','Galego'],['eu','Basco'],['da','Dinamarquês'],['sv','Sueco'],['nb','Norueguês'],['fi','Finlandês'],['pl','Polonês'],['cs','Tcheco'],['sk','Eslovaco'],['sl','Esloveno'],['hr','Croata'],['sr','Sérvio'],['ro','Romeno'],['hu','Húngaro'],['el','Grego'],['tr','Turco'],['ru','Russo'],['uk','Ucraniano'],['bg','Búlgaro'],['ar','Árabe'],['he','Hebraico'],['hi','Hindi'],['ja','Japonês'],['ko','Coreano'],['zh','Chinês'],['id','Indonésio']
  ]);
  const categories={spelling:'Ortografia',grammar:'Gramática',punctuation:'Pontuação',typography:'Tipografia',style:'Estilo',tone:'Tom'};
  const styles={
    clear:'Mais claro',
    concise:'Mais conciso',
    formal:'Mais formal',
    fluent:'Mais fluido',
    persuasive:'Mais persuasivo',
    friendly:'Mais amigável',
    direct:'Direto ao ponto',
    academic:'Acadêmico e técnico',
    creative:'Mais criativo'
  };
  const norm=t=>t.normalize('NFC').toLocaleLowerCase();
  function metrics(text,locale='pt-BR') {
    const lang=locale==='auto'?'pt-BR':locale;
    return {words:[...new Intl.Segmenter(lang,{granularity:'word'}).segment(text)].filter(x=>x.isWordLike).length,characters:[...new Intl.Segmenter(lang,{granularity:'grapheme'}).segment(text)].length};
  }
  function textStats(text,locale='pt-BR') {
    const lang=locale==='auto'?'pt-BR':locale;
    const raw=String(text||'');
    const wordSegments=[...new Intl.Segmenter(lang,{granularity:'word'}).segment(raw)].filter(x=>x.isWordLike);
    const words=wordSegments.length;
    const graphemes=[...new Intl.Segmenter(lang,{granularity:'grapheme'}).segment(raw)];
    const characters=graphemes.length;
    const charactersNoSpaces=graphemes.filter(x=>!/^\s+$/.test(x.segment)).length;
    const sentences=words?[...new Intl.Segmenter(lang,{granularity:'sentence'}).segment(raw)].filter(x=>/\p{L}|\p{N}/u.test(x.segment)).length:0;
    const paragraphs=raw.trim()?raw.trim().split(/\r?\n\s*\r?\n/).filter(p=>p.trim()).length:0;
    const readingTimeMinutes=words?Math.max(1,Math.ceil(words/200)):0;
    const speakingTimeMinutes=words?Math.max(1,Math.ceil(words/130)):0;
    const uniqueWords=new Set(wordSegments.map(x=>norm(x.segment))).size;
    const totalWordChars=wordSegments.reduce((acc,x)=>acc+x.segment.length,0);
    const avgWordLength=words?Math.round((totalWordChars/words)*10)/10:0;
    const avgSentenceWords=sentences?Math.round((words/sentences)*10)/10:0;
    const readability=!words?'Vazio':avgSentenceWords>24||avgWordLength>6.2?'Densa':avgSentenceWords<12&&avgWordLength<4.8?'Muito leve':'Equilibrada';
    return {words,characters,charactersNoSpaces,sentences,paragraphs,readingTimeMinutes,speakingTimeMinutes,uniqueWords,avgWordLength,avgSentenceWords,readability};
  }
  function cleanText(text) {
    return String(text||'')
      .replace(/[ \t]+([,;:.!?])/g,'$1')
      .replace(/(?<=\S)[ ]{2,}(?=\S)/g,' ')
      .replace(/[ \t]+$/gm,'')
      .replace(/\n{3,}/g,'\n\n');
  }
  function chunks(text) {
    const result=[];let start=0;
    while(start<text.length){
      let end=Math.min(start+5600,text.length);
      if(end<text.length){const p=text.lastIndexOf('\n',end-1);if(p>start+2800)end=p+1;if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;}
      result.push({text:text.slice(start,end),start,end,before:text.slice(Math.max(0,start-200),start),after:text.slice(end,end+200)});start=end;
    }
    return result;
  }
  function locate(text,issue) {
    if(typeof issue.quote!=='string'||!issue.quote||typeof issue.left!=='string'||typeof issue.right!=='string')return null;
    const hits=[];let from=0;
    while(from<=text.length){const i=text.indexOf(issue.quote,from);if(i<0)break;const end=i+issue.quote.length;
      if(text.slice(0,i).endsWith(issue.left)&&text.slice(end).startsWith(issue.right))hits.push({start:i,end});from=i+1;
    }
    return hits.length===1?hits[0]:null;
  }
  // ── Regras PT-BR determinísticas (offline, implementação própria) ──
  const ACCENTS=new Map(Object.entries({
    'voce':'você','voçê':'você','voces':'vocês','nao':'não','naum':'não','ate':'até','apos':'após','tres':'três','sao':'são',
    'cafe':'café','facil':'fácil','dificil':'difícil','faceis':'fáceis','dificeis':'difíceis','possivel':'possível','possiveis':'possíveis',
    'impossivel':'impossível','impossiveis':'impossíveis','disponivel':'disponível','disponiveis':'disponíveis','menas':'menos',
    'horario':'horário','horarios':'horários','necessario':'necessário','necessaria':'necessária','necessarios':'necessários','necessarias':'necessárias',
    'unico':'único','unica':'única','unicos':'únicos','unicas':'únicas','ultimo':'último','ultima':'última','ultimos':'últimos','ultimas':'últimas',
    'proximo':'próximo','proxima':'próxima','proximos':'próximos','proximas':'próximas','medico':'médico','medica':'médica','medicos':'médicos','medicas':'médicas',
    'familia':'família','familias':'famílias','materia':'matéria','materias':'matérias','noticia':'notícia','noticias':'notícias',
    'informacao':'informação','informacoes':'informações','solucao':'solução','solucoes':'soluções','resolucao':'resolução','resolucoes':'resoluções',
    'situacao':'situação','situacoes':'situações','acao':'ação','acoes':'ações','decisao':'decisão','decisoes':'decisões','reuniao':'reunião','reunioes':'reuniões',
    'geracao':'geração','geracoes':'gerações',
    'historico':'histórico','historica':'histórica','obrigatorio':'obrigatório','obrigatoria':'obrigatória','maximo':'máximo','maxima':'máxima',
    'minimo':'mínimo','minima':'mínima','area':'área','areas':'áreas','saude':'saúde','saida':'saída','tambem':'também','ninguem':'ninguém','alguem':'alguém',
    'porem':'porém','parabens':'parabéns','seculo':'século','seculos':'séculos','decada':'década','decadas':'décadas','so':'só','ja':'já',
    'sera':'será','serao':'serão','estao':'estão','havera':'haverá','atras':'atrás','alem':'além','atraves':'através',
    'entao':'então','irmao':'irmão','irmaos':'irmãos','coracao':'coração','coracoes':'corações','atencao':'atenção','intencao':'intenção','intencoes':'intenções',
    'funcao':'função','funcoes':'funções','opiniao':'opinião','opinioes':'opiniões','questao':'questão','questoes':'questões',
    'versao':'versão','versoes':'versões','revisao':'revisão','revisoes':'revisões','discussao':'discussão','discussoes':'discussões',
    'condicao':'condição','condicoes':'condições','posicao':'posição','posicoes':'posições','relacao':'relação','relacoes':'relações',
    'educacao':'educação','producao':'produção','construcao':'construção','comunicacao':'comunicação','organizacao':'organização',
    'padrao':'padrão','padroes':'padrões','cidadao':'cidadão','cidadaos':'cidadãos','orgao':'órgão','orgaos':'órgãos',
    'responsavel':'responsável','responsaveis':'responsáveis','provavel':'provável','provaveis':'prováveis','agradavel':'agradável','agradaveis':'agradáveis',
    'confortavel':'confortável','sustentavel':'sustentável','compativel':'compatível','compativeis':'compatíveis','acessivel':'acessível','acessiveis':'acessíveis',
    'incrivel':'incrível','incriveis':'incríveis','invisivel':'invisível','sensivel':'sensível','flexivel':'flexível',
    'nivel':'nível','niveis':'níveis','util':'útil','uteis':'úteis','inutil':'inútil','inuteis':'inúteis',
    'onibus':'ônibus','bonus':'bônus','virus':'vírus','album':'álbum','albuns':'álbuns','acucar':'açúcar','carater':'caráter',
    'bau':'baú','ciume':'ciúme','ciumes':'ciúmes','conteudo':'conteúdo','conteudos':'conteúdos','paises':'países','raizes':'raízes','juizes':'juízes',
    'usuario':'usuário','usuarios':'usuários','relatorio':'relatório','relatorios':'relatórios','calendario':'calendário','dicionario':'dicionário','escritorio':'escritório',
    'metodo':'método','metodos':'métodos','periodo':'período','periodos':'períodos','codigo':'código','codigos':'códigos',
    'pagina':'página','paginas':'páginas','titulo':'título','titulos':'títulos','capitulo':'capítulo','capitulos':'capítulos',
    'veiculo':'veículo','veiculos':'veículos','otimo':'ótimo','otima':'ótima','otimos':'ótimos','otimas':'ótimas','pessimo':'péssimo','pessima':'péssima',
    'economico':'econômico','economica':'econômica','academico':'acadêmico','academica':'acadêmica'
  }));
  const CORRECTIONS_DB=new Map(Object.entries({
    'vc':'você','vcs':'vocês','tmb':'também','pq':'porque','qdo':'quando',
    'pra':'para','pro':'para o','hj':'hoje','amn':'amanhã','msg':'mensagem',
    'obrigad':'obrigado','blz':'beleza','sds':'saudades','bjs':'beijos',
    'tdb':'tudo bem','valeu':'obrigado','flw':'falou'
  }));
  const CORRECTION_CATEGORY={vc:'spelling',vcs:'spelling',tmb:'spelling',pq:'spelling',qdo:'spelling',pra:'spelling',pro:'spelling',hj:'spelling',amn:'spelling',msg:'spelling',obrigad:'spelling',blz:'style',sds:'style',bjs:'style',tdb:'style',valeu:'style',flw:'style'};
  function insideIdentifier(text,start,end){
    const before=text[start-1],after=text[end];
    if(before&&/[/@.]/.test(before))return true;
    if(after==='/'||after==='@')return true;
    if(after==='.'&&/\p{L}/u.test(text[end+1]??''))return true;
    return false;
  }
  function accentIssues(text,locale='pt-BR'){
    if(locale!=='pt-BR'&&locale!=='pt-PT')return[];
    const out=[];const re=/\p{L}+/gu;let m;
    while((m=re.exec(text))!==null){
      const word=m[0],start=m.index,end=start+word.length;
      const fix=ACCENTS.get(norm(word));
      if(!fix||norm(fix)===norm(word))continue;
      if(insideIdentifier(text,start,end))continue;
      const fixed=/^\p{Lu}/u.test(word)?fix[0].toLocaleUpperCase('pt-BR')+fix.slice(1):fix;
      out.push({start,end,quote:word,category:'spelling',rule:'Acentuação',explanation:`"${fixed}" leva acento; sem ele a palavra fica errada ou muda de sentido.`,replacements:[fixed],source:'local'});
    }
    return out;
  }
  function ptIssues(text){
    const out=[];
    const W='[^\\p{L}\\p{N}_]';
    const rules=[
      [new RegExp(`(?:^|${W})([Aa]s[ ]+menina)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar no plural: "as meninas".',['as meninas']],
      [new RegExp(`(?:^|${W})([Aa]s[ ]+menino)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar: "os meninos" ou "as meninas".',['os meninos']],
      [new RegExp(`(?:^|${W})([Oo]s[ ]+menina)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar: "as meninas".',['as meninas']],
      [new RegExp(`(?:^|${W})([Mm]uita[ ]+pessoa)(?=${W}|$)`,'gud'),'Concordância nominal','O correto é "muitas pessoas".',['muitas pessoas']],
      [new RegExp(`(?:^|${W})([Pp]ara[ ]+mim)[ ]+(?:fazer|falar|ver|ir|comer|beber|escrever|estudar|trabalhar|resolver|entender|começar|terminar)(?=${W}|$)`,'gud'),'Regência','Antes de verbo no infinitivo, use "para eu".',['para eu']],
      [new RegExp(`(?:^|${W})([Ee]ntre[ ]+eu[ ]+e)(?=${W}|$)`,'gud'),'Regência','Depois de preposição ("entre"), use "mim": "entre mim e você".',['entre mim e']],
      [new RegExp(`(?:^|${W})([Mm]eu[ ]+elo[ ]+fraco)(?=${W}|$)`,'gud'),'Estilo','Redundância: elo já é fraco por definição. Prefira "ponto fraco".',['ponto fraco'],'style'],
      [new RegExp(`(?:^|${W})([Ss]ubir[ ]+para[ ]+cima)(?=${W}|$)`,'gud'),'Estilo','Redundância: "subir" já indica movimento para cima.',['subir'],'style'],
      [new RegExp(`(?:^|${W})([Dd]escer[ ]+para[ ]+baixo)(?=${W}|$)`,'gud'),'Estilo','Redundância: "descer" já indica movimento para baixo.',['descer'],'style'],
      [new RegExp(`(?:^|${W})([Ee]ntrar[ ]+para[ ]+dentro)(?=${W}|$)`,'gud'),'Estilo','Redundância: "entrar" já indica movimento para dentro.',['entrar'],'style'],
      [new RegExp(`(?:^|${W})([Ss]air[ ]+para[ ]+fora)(?=${W}|$)`,'gud'),'Estilo','Redundância: "sair" já indica movimento para fora.',['sair'],'style'],
      [new RegExp(`(?:^|${W})([Aa]diar[ ]+para[ ]+depois)(?=${W}|$)`,'gud'),'Estilo','Redundância: "adiar" já significa deixar para depois.',['adiar'],'style'],
      [new RegExp(`(?:^|${W})([Cc]erteza[ ]+absoluta)(?=${W}|$)`,'gud'),'Estilo','Redundância: quem tem certeza já está seguro. Prefira "certeza".',['certeza'],'style'],
      [new RegExp(`(?:^|${W})([Hh]a[ ]+muitos[ ]+anos)(?=${W}|$)`,'gud'),'Gramática','Tempo passado pede "há" (verbo haver): "Há muitos anos".',['há muitos anos']],
      [new RegExp(`(?:^|${W})([Hh]a[ ]+dois[ ]+dias)(?=${W}|$)`,'gud'),'Gramática','Tempo passado pede "há" (verbo haver): "Há dois dias".',['há dois dias']],
      [new RegExp(`(?:^|${W})([Hh]á[ ]+muitos[ ]+anos[ ]+atrás)(?=${W}|$)`,'gud'),'Estilo','Evite usar "há" e "atrás" juntos para tempo passado.',['há muitos anos','muitos anos atrás'],'style'],
      [new RegExp(`(?:^|${W})([Hh]aviam[ ]+muitas[ ]+pessoas)(?=${W}|$)`,'gud'),'Concordância verbal','O verbo "haver" no sentido de existir é impessoal: "havia muitas pessoas".',['havia muitas pessoas']],
      [new RegExp(`(?:^|[.!?;:]\\s*)([Aa]gente[ ]+vai)(?=${W}|$)`,'gud'),'Gramática','A forma correta do pronome é "a gente": "A gente vai".',['a gente vai']],
      [new RegExp(`(?:^|${W})([Cc]oncerteza)(?=${W}|$)`,'gud'),'Grafia','Escreve-se separado: "com certeza".',['com certeza'],'spelling'],
      [new RegExp(`(?:^|${W})([Dd]erepente)(?=${W}|$)`,'gud'),'Grafia','Escreve-se separado: "de repente".',['de repente'],'spelling'],
      [new RegExp(`(?:^|${W})([Pp]orisso)(?=${W}|$)`,'gud'),'Grafia','Escreve-se separado: "por isso".',['por isso'],'spelling'],
      [new RegExp(`(?:^|${W})([Aa]partir)(?=${W}|$)`,'gud'),'Grafia','Escreve-se separado: "a partir".',['a partir'],'spelling'],
      [new RegExp(`(?:^|${W})([Aa]fim[ ]+de)(?=${W}|$)`,'gud'),'Gramática','Quando indica finalidade ("para"), escreve-se separado: "a fim de".',['a fim de']],
      [new RegExp(`(?:^|${W})([Aa][ ]+medida[ ]+que)(?=${W}|$)`,'gud'),'Crase','A locução proporcional leva crase: "à medida que".',['à medida que']],
    ];
    for(const [re,rule,explanation,replacements,category] of rules){
      for(const m of text.matchAll(re)){
        const [start,end]=m.indices[1];
        const quote=text.slice(start,end);
        const cap=/^\p{Lu}/u.test(quote);
        const reps=replacements.map(r=>cap?r[0].toLocaleUpperCase('pt-BR')+r.slice(1):r);
        out.push({start,end,quote,category:category||'grammar',rule,explanation,replacements:reps,source:'local'});
      }
    }
    for(const m of text.matchAll(new RegExp(`(?:^|${W})([Ff]azem[ ]+(?:dois|três|quatro|cinco|muitos|alguns|vários)[ ]+(?:anos|meses|dias))(?=${W}|$)`,'gud'))){
      const [start,end]=m.indices[1],quote=text.slice(start,end),
        replacement=quote.replace(/^fazem/i,match=>match[0]==='F'?'Faz':'faz');
      out.push({start,end,quote,category:'grammar',rule:'Concordância verbal',explanation:'O verbo "fazer" indicando tempo decorrido é impessoal (singular).',replacements:[replacement],source:'local'});
    }
    const subjectVerbFixes=[
      [['a gente','você','ele','ela'],{vamos:'vai',fazemos:'faz',podemos:'pode',queremos:'quer',ficamos:'fica',temos:'tem',somos:'é',estamos:'está',vão:'vai',são:'é',estão:'está',foram:'foi'}],
      [['eu'],{vamos:'vou',fazemos:'faço',podemos:'posso',queremos:'quero',ficamos:'fico',temos:'tenho',somos:'sou',estamos:'estou',vão:'vou',são:'sou',estão:'estou',foram:'fui'}],
      [['nós'],{vai:'vamos',faz:'fazemos',pode:'podemos',quer:'queremos',fica:'ficamos',tem:'temos',é:'somos',está:'estamos',foi:'fomos',vem:'vimos',gosta:'gostamos',chegou:'chegamos'}],
      [['vocês','eles','elas'],{vai:'vão',faz:'fazem',pode:'podem',quer:'querem',fica:'ficam',tem:'têm',é:'são',está:'estão',foi:'foram',vem:'vêm',gosta:'gostam',chegou:'chegaram'}],
    ];
    for(const [subjects,fixes] of subjectVerbFixes){
      const subjectPattern=subjects.map(subject=>`${subject[0].toLocaleUpperCase('pt-BR')}${subject.slice(1)}|${subject}`).join('|'),
        verbPattern=Object.keys(fixes).join('|');
      for(const m of text.matchAll(new RegExp(`(?:^|${W})(${subjectPattern})([ ]+)(${verbPattern})(?=${W}|$)`,'gud'))){
        const prefix=text.slice(Math.max(0,m.indices[1][0]-40),m.indices[1][0]);
        if(/(?:^|\s)(?:e|nem|ou)\s+$/i.test(prefix))continue;
        if(/(?:^|\s)(?:um|uma|algum|alguma|nenhum|nenhuma|qualquer|cada|maioria|parte|menos|mais)\s+de\s+$/i.test(prefix))continue;
        const quote=text.slice(m.indices[1][0],m.indices[3][1]),
          replacement=m[1]+m[2]+fixes[m[3]],
          cap=/^\p{Lu}/u.test(quote),
          fixed=cap?replacement[0].toLocaleUpperCase('pt-BR')+replacement.slice(1):replacement;
        out.push({start:m.indices[1][0],end:m.indices[3][1],quote,category:'grammar',rule:'Concordância verbal',explanation:`"${m[1]}" pede "${fixes[m[3]]}".`,replacements:[fixed],source:'local'});
      }
    }
    const craseVerbs=['[Vv]ou','[Vv]ai','[Vv]amos','[Vv]á','[Ii]r','[Ff]ui','[Ff]oi','[Ff]omos','[Ff]oram','[Vv]oltou','[Vv]oltei','[Cc]heguei','[Cc]hegou','[Cc]hegaram'],
      craseTargets=['praia','escola','igreja','reunião','festa','farmácia','padaria','academia','universidade','feira','cidade'];
    for(const m of text.matchAll(new RegExp(`(?:^|${W})((?:${craseVerbs.join('|')})(?:${W})([Aa][ ]+(?:${craseTargets.join('|')})))(?=${W}|$)`,'gud'))){
      const [start,end]=m.indices[2],target=text.slice(start,end),
        rep='à'+target.slice(1),
        cap=/^\p{Lu}/u.test(target),
        replacement=cap?rep[0].toLocaleUpperCase('pt-BR')+rep.slice(1):rep;
      out.push({start,end,quote:target,category:'grammar',rule:'Crase',explanation:`Antes de "${target.slice(2)}", a preposição "a" vira crase: "${replacement}".`,replacements:[replacement],source:'local'});
    }
    // Crase: "a aquela / a aquele / a aquilo" sem verbo antes vira "àquela / àquele / àquilo"
    for(const [target,fixed] of [['aquela','àquela'],['aquelas','àquelas'],['aquele','àquele'],['aqueles','àqueles'],['aquilo','àquilo']]){
      for(const m of text.matchAll(new RegExp(`(?:^|${W})([Aa][ ]+${target})(?=${W}|$)`,'gud'))){
        const [start,end]=m.indices[1];
        const quote=text.slice(start,end);
        const rep=/^\p{Lu}/u.test(quote)?fixed[0].toLocaleUpperCase('pt-BR')+fixed.slice(1):fixed;
        out.push({start,end,quote,category:'grammar',rule:'Crase',explanation:`Antes de "${target}", a preposição "a" funde-se em crase: "${rep}".`,replacements:[rep],source:'local'});
      }
    }
    return out;
  }
  function dbIssues(text,locale='pt-BR'){
    if(locale!=='pt-BR'&&locale!=='pt-PT')return[];
    const out=[];const re=/\p{L}+/gu;let m;
    while((m=re.exec(text))!==null){
      const word=m[0],start=m.index,end=start+word.length;
      const fix=CORRECTIONS_DB.get(norm(word));
      if(!fix||norm(fix)===norm(word)||ACCENTS.has(norm(word)))continue;
      if(insideIdentifier(text,start,end))continue;
      const fixed=/^\p{Lu}/u.test(word)?fix[0].toLocaleUpperCase('pt-BR')+fix.slice(1):fix;
      out.push({start,end,quote:word,category:CORRECTION_CATEGORY[norm(word)]||'spelling',rule:'Correção local',explanation:`"${word}" é uma forma informal ou abreviada; use "${fixed}".`,replacements:[fixed],source:'local'});
    }
    return out;
  }
  function localIssues(text) {
    const spacing=[...text.matchAll(/(?<=\S)[ ]{2,}(?=\S)/gu)].map(m=>({start:m.index,end:m.index+m[0].length,quote:m[0],category:'typography',rule:'Espaçamento duplicado',explanation:'Use um único espaço entre as palavras. Ignore se o espaçamento for intencional.',replacements:[' '],source:'local'}));
    const punctSpacing=[...text.matchAll(/(?<=\p{L})[ ]+([,;:])(?=\s|$)/gu)].map(m=>({start:m.index,end:m.index+m[0].length,quote:m[0],category:'punctuation',rule:'Espaço antes da pontuação',explanation:`Não se usa espaço antes de "${m[1]}". Coloque o sinal logo após a palavra.`,replacements:[m[1]],source:'local'}));
    const repeated=[];
    const allowedRepeats=new Set(['that','had']);
    for(const m of text.matchAll(/(^|[^\p{L}\p{N}_])(\p{L}{2,})(\s+)(\2)(?=[^\p{L}\p{N}_]|$)/giu)){
      if(allowedRepeats.has(norm(m[2])))continue;
      const start=m.index+m[1].length,quote=m[2]+m[3]+m[4];
      repeated.push({start,end:start+quote.length,quote,category:'grammar',rule:'Palavra duplicada',explanation:`"${m[2]}" aparece duas vezes seguidas. Remova a repetição, salvo ênfase intencional.`,replacements:[m[2]],source:'local'});
    }
    return [...spacing,...punctSpacing,...repeated];
  }
  function looksPortuguese(text){
    const low=norm(String(text||''));
    if(!low)return false;
    const markers=['você','voce','vocês','vocs','nós','nos','a gente','gente','não','nao','está','esta','estão','estao','também','tambem','obrigado','obrigada','amanhã','amanha','hoje','portanto','então','entao','já','ja','até','ate','são','sao','mensagem','minha','meu','meus','minhas','eu','porque','assim','muito','tudo','falar','bom','bem'];
    const pattern=new RegExp(`(?:^|[^\\p{L}\\p{N}_])(?:${markers.join('|')})(?=[^\\p{L}\\p{N}_]|$)`,'giu');
    let hits=0;
    while(hits<2&&pattern.exec(low))hits++;
    return hits>=2;
  }
  function allLocalIssues(text,locale='pt-BR'){
    const selectedPortuguese=locale==='pt-BR'||locale==='pt-PT',
      autoPortuguese=locale==='auto'&&looksPortuguese(text),
      portuguese=selectedPortuguese||autoPortuguese,
      ptLocale=locale==='pt-PT'?'pt-PT':'pt-BR';
    return [...localIssues(text),...accentIssues(text,portuguese?ptLocale:locale),...(portuguese?[...dbIssues(text,ptLocale),...ptIssues(text)]:[])];
  }
  function merge(issues,text,dictionary={},locale='pt-BR') {
    const seen=new Set();
    return issues.filter(i=>{
      if(!Object.hasOwn(categories,i.category)||!Number.isInteger(i.start)||!Number.isInteger(i.end)||i.start<0||i.end<=i.start||text.slice(i.start,i.end)!==i.quote)return false;
      if(i.category==='spelling'&&(dictionary[i.language||locale]||[]).some(w=>norm(w)===norm(i.quote)))return false;
      const key=i.start+':'+i.end+':'+i.replacements[0];if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>a.start-b.start||a.end-b.end).map((x,id)=>({...x,id:String(id),language:x.language||locale}));
  }
  globalThis.EscritaEngine={languages,categories,styles,norm,metrics,textStats,cleanText,chunks,locate,localIssues,accentIssues,ptIssues,dbIssues,allLocalIssues,merge,correctionsDB:CORRECTIONS_DB};
})();
