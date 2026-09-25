(() => {
  const engine = globalThis.EscritaEngine;
  const writing = document.querySelector('#writing');
  const suggestions = document.querySelector('#suggestions');
  const status = document.querySelector('#status');
  const undo = document.querySelector('#undo');
  const example = writing.value;
  let previous = null;

  function render(message = '') {
    const text = writing.value;
    const metrics = engine.metrics(text);
    document.querySelector('#metrics').textContent = `${metrics.words} palavras · ${metrics.characters} caracteres`;
    const issues = engine.merge(engine.localIssues(text), text);
    status.textContent = message || (issues.length ? `${issues.length} sugestões locais. Escolha o que deseja ajustar.` : text.trim() ? 'Nenhum espaço ou palavra duplicada encontrado. A revisão com IA está disponível na extensão.' : 'Comece a escrever para ver as sugestões.');
    suggestions.replaceChildren();
    for (const issue of issues.slice(0, 20)) {
      const card = document.createElement('div');
      card.className = 'suggestion';
      const detail = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = issue.rule;
      const description = document.createElement('p');
      description.textContent = `“${issue.quote.replaceAll(' ', '·')}” → “${issue.replacements[0].replaceAll(' ', '·')}”`;
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.textContent = 'Aplicar';
      apply.setAttribute('aria-label', `Aplicar: ${issue.rule}, ${issue.quote}`);
      apply.addEventListener('click', () => {
        if (writing.value !== text) { render(); return; }
        previous = text;
        writing.value = text.slice(0, issue.start) + issue.replacements[0] + text.slice(issue.end);
        render('Sugestão aplicada. Você pode desfazer a última alteração.');
        writing.focus();
        writing.setSelectionRange(issue.start, issue.start + issue.replacements[0].length);
      });
      detail.append(title, description);
      card.append(detail, apply);
      suggestions.append(card);
    }
    if (issues.length > 20) status.textContent += ' Exibindo as primeiras 20 sugestões.';
    undo.disabled = previous === null;
  }
  writing.addEventListener('input', () => { previous = null; render(); });
  undo.addEventListener('click', () => {
    if (previous === null) return;
    writing.value = previous;
    previous = null;
    render('Última alteração desfeita.');
    writing.focus();
  });
  document.querySelector('#reset').addEventListener('click', () => {
    previous = writing.value;
    writing.value = example;
    render();
    writing.focus();
  });
  render();
})();
