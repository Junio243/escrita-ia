(() => {
  if (globalThis.EscritaFields) return;
  const plain = el => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text');
  function field(target) {
    if (!(target instanceof Element)) return null;
    if (plain(target)) return target;
    if (!target.isContentEditable) return null;
    let el = target;
    while (el.parentElement?.isContentEditable) el = el.parentElement;
    return el;
  }
  function safe(el) {
    if (!el || (!plain(el) && !el.isContentEditable) || el.disabled || el.readOnly || el.getAttribute('aria-readonly') === 'true') return false;
    const metadata = [el.name,el.id,el.getAttribute('autocomplete'),el.getAttribute('aria-label')].join(' ');
    return !/(password|senha|token|secret|cpf|cart[aã]o|credit.?card|cc-|one-time-code|username)/i.test(metadata) && !el.closest('[data-escrita-ignore]');
  }
  // Project editable text onto DOM positions, including paragraph and BR boundaries.
  function snapshot(el) {
    if (plain(el)) return {text:el.value};
    let text = ''; const points = [{node:el,offset:0}];
    const blocks = new Set(['DIV','P','LI','PRE','BLOCKQUOTE','H1','H2','H3']);
    function append(value, start, end) { points[text.length] = start; text += value; points[text.length] = end; }
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        for (let i=0;i<node.data.length;i++) append(node.data[i],{node,offset:i},{node,offset:i+1});
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT','STYLE'].includes(node.tagName)) return;
      const parent = node.parentNode, index = parent ? Array.prototype.indexOf.call(parent.childNodes,node) : 0;
      if (node.tagName === 'BR') { append('\n',{node:parent,offset:index},{node:parent,offset:index+1}); return; }
      if (node !== el && blocks.has(node.tagName) && text && !text.endsWith('\n')) append('\n',points[text.length],{node,offset:0});
      for (const child of node.childNodes) walk(child);
      if (node !== el && blocks.has(node.tagName) && node.nextSibling && !text.endsWith('\n')) append('\n',points[text.length],{node:parent,offset:index+1});
    }
    walk(el); return {text,points};
  }
  function diff(before, after) {
    let start=0, end=before.length, nextEnd=after.length;
    while (start<end && start<nextEnd && before[start]===after[start]) start++;
    while (end>start && nextEnd>start && before[end-1]===after[nextEnd-1]) {end--;nextEnd--;}
    return {start,end,insert:after.slice(start,nextEnd)};
  }
  function shift(pos,d) { return pos<=d.start ? pos : pos>=d.end ? pos+d.insert.length-(d.end-d.start) : d.start+d.insert.length; }
  function selectionOffsets(el, snap) {
    const sel=el.getRootNode().getSelection?.() || window.getSelection();
    if (!sel?.rangeCount || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
    function offset(node,n) {
      const exact=snap.points.findIndex(p=>p.node===node && p.offset===n);
      if(exact>=0) return exact;
      const r=document.createRange();r.setStart(el,0);r.setEnd(node,n);
      return Math.min(snap.text.length,r.toString().length);
    }
    return {anchor:offset(sel.anchorNode,sel.anchorOffset),focus:offset(sel.focusNode,sel.focusOffset)};
  }
  function replace(el, value) {
    const snap=snapshot(el), d=diff(snap.text,value);
    if (snap.text===value) return true;
    if (plain(el)) {
      const a=el.selectionStart,b=el.selectionEnd,direction=el.selectionDirection,top=el.scrollTop,left=el.scrollLeft;
      const proto=el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
      el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertReplacementText',data:d.insert}));
      el.setSelectionRange(shift(a,d),shift(b,d),direction);el.scrollTop=top;el.scrollLeft=left;
      return el.value===value;
    }
    const saved=selectionOffsets(el,snap), sel=el.getRootNode().getSelection?.() || window.getSelection();
    const range=document.createRange(),a=snap.points[d.start],b=snap.points[d.end];
    range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);
    if([...el.querySelectorAll('[contenteditable="false"]')].some(node=>range.intersectsNode(node)))return false;
    sel.removeAllRanges();sel.addRange(range);
    // Native editing keeps undo and lets editors observe input. No innerHTML assignment.
    const ok=document.execCommand('insertText',false,d.insert);
    const next=snapshot(el);
    if(saved) {
      const a=next.points[Math.min(next.text.length,shift(saved.anchor,d))],b=next.points[Math.min(next.text.length,shift(saved.focus,d))];
      try {sel.setBaseAndExtent(a.node,a.offset,b.node,b.offset);} catch {}
    }
    return ok && next.text===value;
  }
  function selection(el) {
    if(plain(el))return {start:Math.min(el.selectionStart,el.selectionEnd),end:Math.max(el.selectionStart,el.selectionEnd)};
    const offsets=selectionOffsets(el,snapshot(el));return offsets?{start:Math.min(offsets.anchor,offsets.focus),end:Math.max(offsets.anchor,offsets.focus)}:null;
  }
  function rects(el,start,end) {
    if(!plain(el)){
      const snap=snapshot(el);if(!snap.points[start]||!snap.points[end])return [];
      const range=document.createRange();range.setStart(snap.points[start].node,snap.points[start].offset);range.setEnd(snap.points[end].node,snap.points[end].offset);
      return [...range.getClientRects()].map(r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}));
    }
    const cs=getComputedStyle(el),mirror=document.createElement('div');mirror.setAttribute('data-escrita-ignore','');
    for(const p of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','lineHeight','letterSpacing','wordSpacing','textAlign','textIndent','textTransform','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing','wordBreak','overflowWrap','tabSize','direction'])mirror.style[p]=cs[p];
    Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',borderStyle:'solid',boxSizing:'border-box',whiteSpace:el instanceof HTMLInputElement?'pre':'pre-wrap',width:(el.clientWidth+parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth))+'px',overflow:'hidden'});
    if(el instanceof HTMLInputElement)mirror.style.lineHeight=Math.max(1,el.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom))+'px';
    const node=document.createTextNode(el.value);mirror.append(node);document.documentElement.append(mirror);
    const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);
    const mr=mirror.getBoundingClientRect(),r=el.getBoundingClientRect(),sx=r.width/el.offsetWidth,sy=r.height/el.offsetHeight;
    const result=[...range.getClientRects()].map(x=>({left:r.left+(x.left-mr.left-el.scrollLeft)*sx,top:r.top+(x.top-mr.top-el.scrollTop)*sy,right:r.left+(x.right-mr.left-el.scrollLeft)*sx,bottom:r.top+(x.bottom-mr.top-el.scrollTop)*sy,width:x.width*sx,height:x.height*sy}));
    mirror.remove();return result;
  }
  function adapter(el){
    const host=location.hostname;
    if(host==='chatgpt.com'&&(el.matches('#prompt-textarea,.ProseMirror')||el.closest('form')))return 'ChatGPT · ProseMirror';
    if(host.endsWith('instagram.com'))return 'Instagram · '+(plain(el)?'texto':'editável');
    if(host.endsWith('facebook.com'))return el.matches('[data-lexical-editor]')?'Facebook · Lexical':'Facebook · editável';
    if(host.endsWith('linkedin.com'))return el.matches('.ql-editor')?'LinkedIn · Quill':'LinkedIn · editável';
    if(host==='x.com'||host.endsWith('.x.com'))return 'X · Draft/editor';
    return plain(el)?'Campo HTML':'Editor HTML';
  }
  function focused(){let el=document.activeElement;while(el?.shadowRoot?.activeElement)el=el.shadowRoot.activeElement;return field(el);}
  globalThis.EscritaFields={plain,field,safe,snapshot,diff,shift,replace,selection,rects,adapter,focused};
})();
