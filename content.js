(() => {
  if (globalThis.__escritaV2) return;
  globalThis.__escritaV2 = true;
  const F = globalThis.EscritaFields,
    E = globalThis.EscritaEngine,
    U = globalThis.EscritaPanel.create();
  let current = null,
    revision = 0,
    timer,
    writing = false,
    composing = false,
    hasKey = false,
    enabled = true,
    connected = false,
    selection = null,
    undo = null,
    raf = 0;
  let prefs = {
      language: "auto",
      theme: "system",
      dictionary: {},
      picky: false,
    },
    message = "Conectando ao assistente…",
    phase = "connecting",
    issues = [],
    lastText = "",
    ignored = new Set();
  const n = U.node;
  let pinned = false,
    activeTab = "review",
    filter = "all";
  function tab(name) {
    activeTab = name;
    const review = name === "review";
    U.reviewPane.hidden = !review;
    U.rewritePane.hidden = review;
    for (const [button, on] of [
      [U.reviewTab, review],
      [U.rewriteTab, !review],
    ]) {
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
    }
    layout();
  }
  const safeText = (el) => F.snapshot(el).text;
  const signature = (i) => `${i.start}:${i.end}:${i.quote}:${i.rule}`;
  function status(text, state = phase) {
    message = text;
    phase = state;
    U.status.textContent = text;
    U.badge.title = text;
    U.badge.dataset.state = state;
    U.badgeText.textContent =
      state === "loading"
        ? "Revisando…"
        : state === "missingKey"
          ? "Configurar IA"
          : state === "error"
            ? "Verificar IA"
            : "Escrita IA";
  }
  function setPanel(open) {
    U.panel.hidden = !open;
    U.badge.setAttribute("aria-expanded", String(open));
  }
  async function send(msg) {
    const result = await chrome.runtime.sendMessage(msg);
    if (!result?.ok)
      throw Error(
        result?.error ||
          "Serviço indisponível. Recarregue a extensão e esta página.",
      );
    return result;
  }
  function invalidate() {
    revision++;
    clearTimeout(timer);
    send({ type: "cancel" }).catch(() => {});
    U.detail.hidden = true;
    selection = null;
    U.rewrite.replaceChildren();
  }
  function visible() {
    return issues.filter((i) => !ignored.has(signature(i)));
  }
  function geometry() {
    raf = 0;
    if (!current?.isConnected || !enabled || !F.safe(current)) {
      U.badge.hidden = true;
      setPanel(false);
      U.marks.replaceChildren();
      return;
    }
    const r = current.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) {
      U.badge.hidden = true;
      setPanel(false);
      U.marks.replaceChildren();
      return;
    }
    U.badge.hidden = false;
    const bw = U.badge.offsetWidth || 175,
      bh = U.badge.offsetHeight || 32;
    U.badge.style.left =
      Math.max(8, Math.min(r.right - bw, innerWidth - bw - 8)) + "px";
    U.badge.style.top =
      Math.max(8, Math.min(r.bottom + 5, innerHeight - bh - 8)) + "px";
    const pw = Math.min(390, innerWidth - 16),
      ph = U.panel.offsetHeight || 330;
    let x = r.right + 12,
      y = r.top;
    if (x + pw > innerWidth - 8) {
      if (r.left - pw - 12 >= 8) x = r.left - pw - 12;
      else {
        x = Math.max(8, Math.min(r.left, innerWidth - pw - 8));
        y = r.bottom + bh + 12;
      }
    }
    if (pinned) {
      x = innerWidth - pw - 12;
      y = 12;
    }
    U.panel.style.left = Math.max(8, Math.min(x, innerWidth - pw - 8)) + "px";
    U.panel.style.top = Math.max(8, Math.min(y, innerHeight - ph - 8)) + "px";
    U.marks.replaceChildren();
    if (safeText(current) !== lastText) return;
    let clip = {
      left: Math.max(0, r.left),
      right: Math.min(innerWidth, r.right),
      top: Math.max(0, r.top),
      bottom: Math.min(innerHeight, r.bottom),
    };
    for (let p = current.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (
        /auto|scroll|hidden|clip/.test(
          cs.overflow + cs.overflowY + cs.overflowX,
        )
      ) {
        const a = p.getBoundingClientRect();
        clip = {
          left: Math.max(clip.left, a.left),
          right: Math.min(clip.right, a.right),
          top: Math.max(clip.top, a.top),
          bottom: Math.min(clip.bottom, a.bottom),
        };
      }
    }
    for (const issue of visible()) {
      let rects = [];
      try {
        rects = F.rects(current, issue.start, issue.end);
      } catch {
        continue;
      }
      for (const a of rects) {
        const left = Math.max(a.left, clip.left),
          right = Math.min(a.right, clip.right);
        if (
          right <= left ||
          a.bottom > clip.bottom + 2 ||
          a.bottom < clip.top + 3
        )
          continue;
        const mark = n("button", {
          class: "mark",
          "aria-label": E.categories[issue.category] + ": " + issue.rule,
          title: issue.rule,
        });
        mark.style.setProperty("--color", U.colors[issue.category]);
        Object.assign(mark.style, {
          left: left + "px",
          top: a.bottom - 2 + "px",
          width: Math.max(3, right - left) + "px",
        });
        mark.onclick = () => showIssue(issue);
        U.marks.append(mark);
      }
    }
  }
  function layout() {
    if (!raf) raf = requestAnimationFrame(geometry);
  }
  function render() {
    U.list.replaceChildren();
    const all = visible(),
      list = all.filter((i) => filter === "all" || i.category === filter);
    U.count.textContent = String(all.length);
    U.filters.replaceChildren();
    for (const [value, label] of [
      ["all", "Todas"],
      ...Object.entries(E.categories).filter(([key]) =>
        all.some((i) => i.category === key),
      ),
    ]) {
      const b = n("button", {
        text: label,
        "aria-pressed": String(filter === value),
      });
      b.onclick = () => {
        filter = value;
        U.detail.hidden = true;
        render();
      };
      U.filters.append(b);
    }
    U.localApply.hidden = !all.some((i) => i.source === "local");
    if (!list.length)
      U.list.append(
        n("div", {
          class: "empty",
          text:
            phase === "complete"
              ? "Nenhuma ocorrência encontrada."
              : phase === "missingKey"
                ? "Configure a IA. A revisão local continua disponível."
                : "As sugestões aparecerão aqui.",
        }),
      );
    for (const issue of list) {
      const button = n("button", { class: "issue", "data-issue": issue.id }, [
        n("div", { class: "category", text: E.categories[issue.category] }),
        n("div", { class: "quote", text: issue.quote }),
        n("div", { text: issue.rule }),
      ]);
      button.style.setProperty("--color", U.colors[issue.category]);
      button.onclick = () => showIssue(issue);
      U.list.append(button);
    }
    if (current) {
      const m = E.metrics(lastText, prefs.language);
      U.metrics.textContent = `${m.words} palavras · ${m.characters} caracteres · ${F.adapter(current)}`;
      U.badgeMetrics.textContent = `${m.words} pal. · ${m.characters} car.`;
    }
    U.undo.hidden = !undo || undo.el !== current || undo.after !== lastText;
    layout();
  }
  function showIssue(issue) {
    if (!current || safeText(current) !== lastText) return;
    tab("review");
    setPanel(true);
    U.detail.hidden = false;
    U.detail.replaceChildren();
    U.detail.style.setProperty("--color", U.colors[issue.category]);
    U.detail.append(
      n("div", { class: "category", text: E.categories[issue.category] }),
      n("div", { class: "quote", text: issue.quote }),
      n("div", { class: "explain", text: issue.explanation }),
    );
    for (const replacement of issue.replacements) {
      const b = n("button", {
        class: "button primary replacement",
        text: replacement || "Remover trecho",
        "data-apply": "",
      });
      b.onclick = () =>
        applyRange(
          { el: current, before: lastText, start: issue.start, end: issue.end },
          replacement,
        );
      U.detail.append(b);
    }
    const row = n("div", { class: "toolbar" }),
      ignore = n("button", { class: "button", text: "Ignorar" });
    ignore.onclick = () => {
      ignored.add(signature(issue));
      U.detail.hidden = true;
      render();
    };
    row.append(ignore);
    if (issue.category === "spelling") {
      const add = n("button", {
        class: "button",
        text: "Adicionar ao dicionário",
      });
      add.onclick = async () => {
        try {
          await send({
            type: "dictionaryAdd",
            word: issue.quote,
            language: issue.language || "pt-BR",
          });
          status("Termo salvo no dicionário.", "ready");
        } catch (e) {
          status(e.message, "error");
        }
      };
      row.append(add);
    }
    U.detail.append(row);
    layout();
  }
  function applyRange(capture, replacement, countApplied = true) {
    if (
      !capture ||
      !F.safe(capture.el) ||
      !capture.el.isConnected ||
      safeText(capture.el) !== capture.before
    ) {
      status("O texto mudou. Aguarde a nova revisão.", "ready");
      return;
    }
    const { el, before, start, end } = capture,
      after = before.slice(0, start) + replacement + before.slice(end);
    invalidate();
    writing = true;
    let ok = false;
    try {
      el.focus();
      ok = F.replace(el, after);
    } catch {
      ok = false;
    } finally {
      writing = false;
    }
    const actual = safeText(el);
    if (actual !== before) undo = { el, before, after: actual };
    lastText = actual;
    issues = [];
    ignored.clear();
    tab("review");
    render();
    status(
      ok
        ? "Sugestão aplicada."
        : "O editor não aceitou a alteração integralmente. Use Desfazer ou copie a sugestão.",
      ok ? "ready" : "error",
    );
    if (ok) {
      if (countApplied) send({ type: "applied" }).catch(() => {});
      schedule();
    }
  }
  function selectionUI(whole = false) {
    if (!current || writing) return;
    const range = whole
      ? { start: 0, end: safeText(current).length }
      : F.selection(current);
    if (!range || range.start === range.end) {
      if (!U.root.activeElement) {
        selection = null;
        U.rewrite.replaceChildren();
      }
      return;
    }
    const before = safeText(current);
    if (
      selection?.el === current &&
      selection.before === before &&
      selection.start === range.start &&
      selection.end === range.end &&
      U.rewrite.childElementCount
    )
      return;
    selection = { el: current, before, ...range };
    U.rewrite.replaceChildren();
    const label = n("div", { class: "category", text: "Reescrever seleção" }),
      quote = n("div", {
        class: "selection",
        text: before.slice(range.start, range.end),
      }),
      select = n("select", { "aria-label": "Estilo da reescrita" });
    for (const [value, text] of Object.entries(E.styles))
      select.append(n("option", { value, text }));
    const button = n("button", {
      class: "button primary",
      text: "Gerar alternativas",
    });
    button.onclick = () => rewrite(select.value, button);
    U.rewrite.append(
      label,
      quote,
      select,
      n("div", { class: "toolbar" }, [button]),
    );
    layout();
  }
  async function rewrite(style, button) {
    const capture = selection;
    if (!capture) return;
    if (capture.end - capture.start > 6000) {
      status("Selecione até 6.000 caracteres para reescrever.", "error");
      return;
    }
    const rev = ++revision;
    clearTimeout(timer);
    U.rewrite
      .querySelectorAll("[data-alternative]")
      .forEach((el) => el.remove());
    button.disabled = true;
    status("Criando alternativas…", "loading");
    try {
      const r = await send({
        type: "rewrite",
        text: capture.before.slice(capture.start, capture.end),
        style,
        before: capture.before.slice(
          Math.max(0, capture.start - 200),
          capture.start,
        ),
        after: capture.before.slice(capture.end, capture.end + 200),
      });
      if (
        rev !== revision ||
        current !== capture.el ||
        safeText(current) !== capture.before
      )
        return;
      for (const alternative of r.alternatives) {
        const b = n("button", {
          class: "button replacement",
          text: alternative,
          "data-alternative": "",
        });
        b.onclick = () => applyRange(capture, alternative);
        U.rewrite.append(b);
      }
      status("Escolha uma alternativa para aplicar.", "ready");
      layout();
    } catch (e) {
      if (rev === revision) status(e.message, "error");
    } finally {
      button.disabled = false;
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (enabled && !composing && current) timer = setTimeout(analyze, 600);
  }
  async function analyze() {
    if (!current?.isConnected || !enabled || composing) return;
    const el = current,
      text = safeText(el),
      rev = ++revision;
    lastText = text;
    issues = E.merge(
      E.localIssues(text),
      text,
      prefs.dictionary,
      prefs.language === "auto" ? "pt-BR" : prefs.language,
    );
    render();
    if (!text.trim()) {
      status("Comece a escrever. A revisão é automática.", "ready");
      render();
      return;
    }
    if (!connected) {
      status(
        "Serviço desconectado. Abra o diagnóstico no ícone da extensão.",
        "error",
      );
      return;
    }
    if (!hasKey) {
      status(
        "Configure URL, modelo e credencial do provedor. A revisão local continua ativa.",
        "missingKey",
      );
      render();
      return;
    }
    status("Analisando ortografia, gramática e estilo…", "loading");
    try {
      const r = await send({ type: "analyze", text });
      if (
        rev !== revision ||
        current !== el ||
        safeText(el) !== text ||
        !enabled
      )
        return;
      issues = r.issues;
      status(
        "Revisão concluída · " + (E.languages[r.language] || r.language),
        "complete",
      );
      render();
    } catch (e) {
      if (rev === revision) {
        status(e.message, "error");
        render();
      }
    }
  }
  function activate(el) {
    if (!F.safe(el)) return;
    if (current !== el) {
      invalidate();
      current = el;
      filter = "all";
      tab("review");
      ignored = new Set();
      lastText = safeText(el);
      issues = [];
      U.detail.hidden = true;
      setPanel(false);
      resize.disconnect();
      resize.observe(el);
      status(
        hasKey ? "Pronto para revisar." : "Configure seu provedor de IA.",
        hasKey ? "ready" : "missingKey",
      );
      render();
      schedule();
    }
    layout();
  }
  function changed(el) {
    activate(el);
    invalidate();
    lastText = safeText(el);
    issues = E.merge(
      E.localIssues(lastText),
      lastText,
      prefs.dictionary,
      prefs.language === "auto" ? "pt-BR" : prefs.language,
    );
    ignored.clear();
    status("Aguardando sua pausa…", "ready");
    render();
    schedule();
  }
  async function refresh() {
    try {
      const r = await send({ type: "prefs" });
      prefs = r.prefs;
      hasKey = r.hasKey;
      enabled = r.siteEnabled && prefs.assistantEnabled;
      connected = true;
      U.ui.classList.toggle(
        "dark",
        prefs.theme === "dark" ||
          (prefs.theme === "system" &&
            matchMedia("(prefers-color-scheme: dark)").matches),
      );
      invalidate();
      if (!enabled) {
        status("Assistente pausado.", "paused");
        U.badge.hidden = true;
        setPanel(false);
        U.marks.replaceChildren();
        return;
      }
      const el = F.focused();
      if (F.safe(el)) activate(el);
      status(
        hasKey ? "Pronto para revisar." : "Configure seu provedor de IA.",
        hasKey ? "ready" : "missingKey",
      );
      render();
      schedule();
    } catch {
      connected = false;
      status(
        "Serviço desconectado. Recarregue a extensão e esta página.",
        "error",
      );
      const el = F.focused();
      if (F.safe(el)) activate(el);
      layout();
    }
  }
  const resize = new ResizeObserver(layout);
  new ResizeObserver(layout).observe(U.panel);
  U.badge.onclick = () => {
    setPanel(U.panel.hidden);
    if (!U.panel.hidden) selectionUI();
    layout();
  };
  U.close.onclick = () => setPanel(false);
  U.settings.onclick = () =>
    send({ type: "openSettings" }).catch(() =>
      status("Abra Configurações pelo ícone da extensão.", "error"),
    );
  U.pin.onclick = () => {
    pinned = !pinned;
    U.pin.setAttribute("aria-pressed", String(pinned));
    U.pin.setAttribute("aria-label", pinned ? "Soltar painel" : "Fixar painel");
    layout();
  };
  U.reviewTab.onclick = () => tab("review");
  U.rewriteTab.onclick = () => {
    tab("rewrite");
    selectionUI();
  };
  U.whole.onclick = () => {
    selectionUI(true);
  };
  U.tabs.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      tab(
        e.key === "Home"
          ? "review"
          : e.key === "End"
            ? "rewrite"
            : activeTab === "review"
              ? "rewrite"
              : "review",
      );
      (activeTab === "review" ? U.reviewTab : U.rewriteTab).focus();
    }
  });
  U.localApply.onclick = () => {
    if (!current || safeText(current) !== lastText) return;
    const selected = [];
    let end = -1;
    for (const issue of visible()
      .filter((i) => i.source === "local")
      .sort((a, b) => a.start - b.start || b.end - a.end)) {
      if (issue.start >= end) {
        selected.push(issue);
        end = issue.end;
      }
    }
    let result = lastText;
    for (const issue of selected.reverse())
      result =
        result.slice(0, issue.start) +
        issue.replacements[0] +
        result.slice(issue.end);
    if (selected.length)
      applyRange(
        { el: current, before: lastText, start: 0, end: lastText.length },
        result,
      );
  };
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !U.panel.hidden) {
        setPanel(false);
        if (U.root.activeElement && current?.isConnected) current.focus();
      }
    },
    true,
  );
  U.retry.onclick = () => {
    refresh();
  };
  U.undo.onclick = () => {
    const previous = undo;
    if (!previous || safeText(previous.el) !== previous.after) {
      status("O texto mudou; não é possível desfazer esta alteração.", "error");
      return;
    }
    applyRange(
      {
        el: previous.el,
        before: previous.after,
        start: 0,
        end: previous.after.length,
      },
      previous.before,
      false,
    );
    undo = null;
    U.undo.hidden = true;
  };
  U.root.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault();
  });
  document.addEventListener(
    "focusin",
    (e) => {
      if (writing || e.composedPath().includes(U.host)) return;
      const el = F.field(e.composedPath()[0]);
      if (F.safe(el)) activate(el);
      else {
        invalidate();
        current = null;
        setPanel(false);
        U.badge.hidden = true;
        U.marks.replaceChildren();
      }
    },
    true,
  );
  document.addEventListener(
    "input",
    (e) => {
      if (writing || !e.isTrusted || e.composedPath().includes(U.host)) return;
      const el = F.field(e.composedPath()[0]);
      if (F.safe(el)) changed(el);
    },
    true,
  );
  document.addEventListener(
    "compositionstart",
    (e) => {
      if (F.field(e.composedPath()[0])) {
        composing = true;
        invalidate();
      }
    },
    true,
  );
  document.addEventListener(
    "compositionend",
    (e) => {
      composing = false;
      const el = F.field(e.composedPath()[0]);
      if (F.safe(el)) changed(el);
    },
    true,
  );
  document.addEventListener("selectionchange", () => {
    if (current && !U.root.activeElement) selectionUI();
  });
  document.addEventListener("scroll", layout, true);
  window.addEventListener("resize", layout);
  visualViewport?.addEventListener("resize", layout);
  const observer = new MutationObserver((records) => {
    if (
      records.every(
        (r) =>
          [...r.addedNodes, ...r.removedNodes].length &&
          [...r.addedNodes, ...r.removedNodes].every(
            (x) => x.nodeType === 1 && x.hasAttribute("data-escrita-ignore"),
          ),
      )
    )
      return;
    if (!U.host.isConnected) document.documentElement.append(U.host);
    const el = F.focused();
    if (F.safe(el)) {
      if (el !== current) activate(el);
      else if (!writing && safeText(el) !== lastText) changed(el);
    } else if (current && !current.isConnected) {
      invalidate();
      current = null;
      layout();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === "prefsChanged") {
      refresh();
      return;
    }
    if (msg.type === "togglePanel") {
      if (current && enabled) {
        setPanel(U.panel.hidden);
        if (!U.panel.hidden) selectionUI();
        layout();
      }
      return;
    }
    if (msg.type === "diagnose") {
      reply({
        version: chrome.runtime.getManifest().version,
        fieldDetected: !!current,
        adapter: current ? F.adapter(current) : null,
        connected,
        phase,
        enabled,
        hasKey,
      });
    }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (prefs.theme === "system")
      U.ui.classList.toggle(
        "dark",
        matchMedia("(prefers-color-scheme: dark)").matches,
      );
  });
  const initial = F.focused();
  if (F.safe(initial)) activate(initial);
  refresh();
})();
