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
  function localIssues(text) {
    return [...text.matchAll(/(?<=\S)[ ]{2,}(?=\S)/gu)].map(m=>({start:m.index,end:m.index+m[0].length,quote:m[0],category:'typography',rule:'Espaçamento duplicado',explanation:'Use um único espaço entre as palavras. Ignore se o espaçamento for intencional.',replacements:[' '],source:'local'}));
  }
  function merge(issues,text,dictionary={},locale='pt-BR') {
    const seen=new Set();
    return issues.filter(i=>{
      if(!Object.hasOwn(categories,i.category)||!Number.isInteger(i.start)||!Number.isInteger(i.end)||i.start<0||i.end<=i.start||text.slice(i.start,i.end)!==i.quote)return false;
      if(i.category==='spelling'&&(dictionary[i.language||locale]||[]).some(w=>norm(w)===norm(i.quote)))return false;
      const key=i.start+':'+i.end+':'+i.replacements[0];if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>a.start-b.start||a.end-b.end).map((x,id)=>({...x,id:String(id),language:x.language||locale}));
  }
  globalThis.EscritaEngine={languages,categories,styles,norm,metrics,chunks,locate,localIssues,merge};
})();
