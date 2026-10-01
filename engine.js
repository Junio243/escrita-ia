(() => {
  const languages = Object.fromEntries([
    ['auto','Detectar automaticamente'],['pt-BR','Português · Brasil'],['pt-PT','Português · Portugal'],['en-US','English · US'],['en-GB','English · UK'],
    ['es','Espanhol'],['fr','Francês'],['de','Alemão'],['it','Italiano'],['nl','Neerlandês'],['ca','Catalão'],['gl','Galego'],['eu','Basco'],['da','Dinamarquês'],['sv','Sueco'],['nb','Norueguês'],['fi','Finlandês'],['pl','Polonês'],['cs','Tcheco'],['sk','Eslovaco'],['sl','Esloveno'],['hr','Croata'],['sr','Sérvio'],['ro','Romeno'],['hu','Húngaro'],['el','Grego'],['tr','Turco'],['ru','Russo'],['uk','Ucraniano'],['bg','Búlgaro'],['ar','Árabe'],['he','Hebraico'],['hi','Hindi'],['ja','Japonês'],['ko','Coreano'],['zh','Chinês'],['id','Indonésio']
  ]);
  const categories={spelling:'Ortografia',grammar:'Gramática',punctuation:'Pontuação',typography:'Tipografia',style:'Estilo',tone:'Tom'};
  const styles={clear:'Mais claro',concise:'Mais conciso',formal:'Mais formal',fluent:'Mais fluido',persuasive:'Mais persuasivo'};
  const norm=t=>t.normalize('NFC').toLocaleLowerCase();
  function metrics(text,locale='pt-BR') {
    const lang=locale==='auto'?'pt-BR':locale;
    return {words:[...new Intl.Segmenter(lang,{granularity:'word'}).segment(text)].filter(x=>x.isWordLike).length,characters:[...new Intl.Segmenter(lang,{granularity:'grapheme'}).segment(text)].length};
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
    'cafe':'café','facil':'fácil','dificil':'difícil','possivel':'possível','possiveis':'possíveis','menas':'menos',
    'horario':'horário','horarios':'horários','necessario':'necessário','necessaria':'necessária','necessarios':'necessários','necessarias':'necessárias',
    'unico':'único','unica':'única','unicos':'únicos','unicas':'únicas','ultimo':'último','ultima':'última','ultimos':'últimos','ultimas':'últimas',
    'proximo':'próximo','proxima':'próxima','proximos':'próximos','proximas':'próximas','medico':'médico','medica':'médica','medicos':'médicos','medicas':'médicas',
    'familia':'família','familias':'famílias','materia':'matéria','materias':'matérias','noticia':'notícia','noticias':'notícias',
    'informacao':'informação','informacoes':'informações','solucao':'solução','solucoes':'soluções','resolucao':'resolução','resolucoes':'resoluções',
    'situacao':'situação','situacoes':'situações','acao':'ação','acoes':'ações','decisao':'decisão','decisoes':'decisões','reuniao':'reunião','reunioes':'reuniões',
    'geracao':'geração','geracoes':'gerações','publico':'público','publica':'pública','publicos':'públicos','publicas':'públicas',
    'historico':'histórico','historica':'histórica','obrigatorio':'obrigatório','obrigatoria':'obrigatória','maximo':'máximo','maxima':'máxima',
    'minimo':'mínimo','minima':'mínima','area':'área','areas':'áreas','saude':'saúde','saida':'saída','tambem':'também','ninguem':'ninguém','alguem':'alguém',
    'porem':'porém','parabens':'parabéns','seculo':'século','seculos':'séculos','decada':'década','decadas':'décadas','so':'só','ja':'já',
    'sera':'será','serao':'serão','estao':'estão','ira':'irá','havera':'haverá','atras':'atrás','alem':'além'
  }));
  function accentIssues(text,locale='pt-BR'){
    if(locale!=='pt-BR'&&locale!=='pt-PT')return[];
    const out=[];const re=/\p{L}+/gu;let m;
    while((m=re.exec(text))!==null){
      const word=m[0],start=m.index,end=start+word.length;
      const fix=ACCENTS.get(norm(word));
      if(!fix||norm(fix)===norm(word))continue;
      const before=text[start-1],after=text[end];
      if(before&&/[/@.]/.test(before))continue;
      if(after&&/[.@]/.test(after))continue;
      const fixed=/^\p{Lu}/u.test(word)?fix[0].toLocaleUpperCase('pt-BR')+fix.slice(1):fix;
      out.push({start,end,quote:word,category:'spelling',rule:'Acentuação',explanation:`"${fixed}" leva acento; sem ele a palavra fica errada ou muda de sentido.`,replacements:[fixed],source:'local'});
    }
    return out;
  }
  function ptIssues(text){
    const out=[];
    const W='[^\\p{L}\\p{N}_]';
    const rules=[
      [new RegExp(`(?:^|${W})([Nn]ós[ ]+vai)(?=${W}|$)`,'gud'),'Concordância verbal','O verbo concorda com "nós": vamos.',['Nós vamos']],
      [new RegExp(`(?:^|${W})([Aa]s[ ]+menina)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar no plural: "as meninas".',['as meninas']],
      [new RegExp(`(?:^|${W})([Aa]s[ ]+menino)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar: "os meninos" ou "as meninas".',['os meninos']],
      [new RegExp(`(?:^|${W})([Oo]s[ ]+menina)(?=${W}|$)`,'gud'),'Concordância nominal','Artigo e substantivo devem concordar: "as meninas".',['as meninas']],
      [new RegExp(`(?:^|${W})([Mm]uita[ ]+pessoa)(?=${W}|$)`,'gud'),'Concordância nominal','O correto é "muitas pessoas".',['muitas pessoas']],
      [new RegExp(`(?:^|${W})([Pp]ara[ ]+mim)[ ]+(?:fazer|falar|ver|ir|comer|beber|escrever|estudar|trabalhar)(?=${W}|$)`,'gud'),'Regência','Antes de verbo no infinitivo, use "para eu fazer".',['para eu']],
      [new RegExp(`(?:^|${W})([Ee]ntre[ ]+eu[ ]+e)(?=${W}|$)`,'gud'),'Regência','Depois de "entre", use "mim": "entre mim e você".',['entre mim e']],
      [new RegExp(`(?:^|${W})([Mm]eu[ ]+elo[ ]+fraco)(?=${W}|$)`,'gud'),'Estilo','Redundância: elo já é fraco por definição. Prefira "ponto fraco".',['ponto fraco'],'style'],
      [new RegExp(`(?:^|${W})([Ss]ubir[ ]+para[ ]+cima)(?=${W}|$)`,'gud'),'Estilo','Redundância: "subir" já indica movimento para cima.',['subir'],'style'],
      [new RegExp(`(?:^|${W})([Ee]ntrar[ ]+para[ ]+dentro)(?=${W}|$)`,'gud'),'Estilo','Redundância: "entrar" já indica movimento para dentro.',['entrar'],'style'],
      [new RegExp(`(?:^|${W})([Hh]a[ ]+muitos[ ]+anos)(?=${W}|$)`,'gud'),'Gramática','Tempo passado pede "há" (verbo haver): "Há muitos anos".',['Há muitos anos']],
      [new RegExp(`(?:^|${W})([Hh]a[ ]+dois[ ]+dias)(?=${W}|$)`,'gud'),'Gramática','Tempo passado pede "há" (verbo haver): "Há dois dias".',['Há dois dias']],
      [new RegExp(`(?:^|${W})([Aa]gente[ ]+vai)(?=${W}|$)`,'gud'),'Gramática','A forma correta do pronome é "a gente": "A gente vai".',['A gente vai']],
    ];
    for(const [re,rule,explanation,replacements,category] of rules){
      for(const m of text.matchAll(re)){
        const [start,end]=m.indices[1];
        out.push({start,end,quote:text.slice(start,end),category:category||'grammar',rule,explanation,replacements,source:'local'});
      }
    }
    // Crase: "a aquela" sem verbo antes vira "àquela"
    for(const m of text.matchAll(new RegExp(`(?:^|${W})([Aa][ ]+aquela)(?=${W}|$)`,'gud'))){
      const [start,end]=m.indices[1];
      out.push({start,end,quote:text.slice(start,end),category:'grammar',rule:'Crase',explanation:'Antes de "aquela", quando não há verbo, use crase: "àquela".',replacements:['àquela'],source:'local'});
    }
    return out;
  }
  function localIssues(text) {
    const spacing=[...text.matchAll(/(?<=\S)[ ]{2,}(?=\S)/gu)].map(m=>({start:m.index,end:m.index+m[0].length,quote:m[0],category:'typography',rule:'Espaçamento duplicado',explanation:'Use um único espaço entre as palavras. Ignore se o espaçamento for intencional.',replacements:[' '],source:'local'}));
    const repeated=[];
    for(const m of text.matchAll(/(^|[^\p{L}\p{N}_])(\p{L}{2,})(\s+)(\2)(?=[^\p{L}\p{N}_]|$)/giu)){
      const start=m.index+m[1].length,quote=m[2]+m[3]+m[4];
      repeated.push({start,end:start+quote.length,quote,category:'grammar',rule:'Palavra duplicada',explanation:`"${m[2]}" aparece duas vezes seguidas. Remova a repetição, salvo ênfase intencional.`,replacements:[m[2]],source:'local'});
    }
    return [...spacing,...repeated];
  }
  function allLocalIssues(text,locale='pt-BR'){
    return [...localIssues(text),...accentIssues(text,locale),...ptIssues(text)];
  }
  function merge(issues,text,dictionary={},locale='pt-BR') {
    const seen=new Set();
    return issues.filter(i=>{
      if(!Object.hasOwn(categories,i.category)||!Number.isInteger(i.start)||!Number.isInteger(i.end)||i.start<0||i.end<=i.start||text.slice(i.start,i.end)!==i.quote)return false;
      if(i.category==='spelling'&&(dictionary[i.language||locale]||[]).some(w=>norm(w)===norm(i.quote)))return false;
      const key=i.start+':'+i.end+':'+i.replacements[0];if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>a.start-b.start||a.end-b.end).map((x,id)=>({...x,id:String(id),language:x.language||locale}));
  }
  globalThis.EscritaEngine={languages,categories,styles,norm,metrics,chunks,locate,localIssues,accentIssues,ptIssues,allLocalIssues,merge};
})();
