(() => {
  const ns = "http://www.w3.org/2000/svg";
  const paths = {
    spark: "m12 2.5 2.4 6.1L20.5 11l-6.1 2.4L12 19.5l-2.4-6.1L3.5 11l6.1-2.4ZM19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8Z",
    check: "m5 12.5 4.2 4.2L19 7",
    close: "m6 6 12 12M18 6 6 18",
    settings: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4v6M9 14v6",
    undo: "M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2",
    pin: "M9 3h6l-1 6 4 4H6l4-4ZM12 13v8",
    refresh: "M20 11a8 8 0 0 0-14.3-4.7M4 4v4h4M4 13a8 8 0 0 0 14.3 4.7M20 20v-4h-4",
    copy: "M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    wand: "m15 4-1 1m5 4 1-1M18 3l.6 1.9L20.5 5.5l-1.9.6L18 8l-.6-1.9-1.9-.6 1.9-.6ZM3 21 15 9m-2.5 2.5 3 3",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z",
    eyeOff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.7 10.7 0 0 1 12 5c5.5 0 9.5 5 10 7-.3 1.1-1.2 2.9-2.8 4.5M6.2 6.2C4.3 7.6 2.9 9.7 2 12c.8 2.4 4.6 7 10 7 1.8 0 3.4-.5 4.8-1.2",
    bolt: "M13 2 4 14h7l-1 8 10-12h-7l1-8Z",
    selectAll: "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3",
    clean: "M4 6h16M4 12h10M4 18h14m3-7-3 3 3 3",
  };
  function icon(name) {
    const svg = document.createElementNS(ns, "svg");
    for (const [k, v] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.85",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    }))
      svg.setAttribute(k, v);
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", paths[name] || paths.spark);
    svg.append(p);
    return svg;
  }
  function node(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v);
    }
    for (const c of children) n.append(c);
    return n;
  }
  function create() {
    const host = node("div", {
        "data-escrita-root": "3",
        "data-escrita-ignore": "",
      }),
      root = host.attachShadow({ mode: "open" });
    const css = node("style", {
      text: `
      :host{all:initial;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}button,select{font:inherit}button{cursor:pointer;transition:background .15s,border-color .15s,transform .1s}button:active:not(:disabled){transform:scale(.98)}button:disabled{cursor:default;opacity:.45}svg{width:16px;height:16px;flex-shrink:0}button:focus-visible,select:focus-visible{outline:3px solid #80aaff;outline-offset:2px}
      .ui{--bg:#fff;--fg:#18263e;--muted:#5e7089;--line:#dde5f0;--soft:#f3f7fd;--accent:#275cda;--accent-soft:#e8f0fe;font:13px/1.5 system-ui,-apple-system,sans-serif;color:var(--fg)}.ui.dark{--bg:#162235;--fg:#eef4ff;--muted:#a4b7d2;--line:#30415a;--soft:#1f3049;--accent:#96bcff;--accent-soft:#253a5a;color-scheme:dark}
      .badge{position:absolute;pointer-events:auto;display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:999px;padding:6px 11px 6px 9px;color:var(--fg);background:var(--bg);box-shadow:0 6px 20px #0f224226;font-size:11px;font-weight:600;white-space:nowrap;max-width:calc(100vw - 16px);cursor:grab;touch-action:none}.badge:hover{border-color:var(--accent)}.badge:active{cursor:grabbing}.badge svg{color:var(--accent);width:16px;height:16px}.badge .count{background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:1px 7px;font-weight:750;font-size:11px}.badge-metrics{display:none}.badge[data-state=loading] svg{animation:pulse .9s ease-in-out infinite alternate}.badge[data-state=error]{border-color:#dc6850}
      .drag-hint{color:var(--muted);font-size:15px;letter-spacing:-3px;padding-right:2px;line-height:1;opacity:.7}.panel{position:absolute;pointer-events:auto;width:392px;max-width:calc(100vw - 16px);max-height:calc(100vh - 24px);overflow:auto;border:1px solid var(--line);border-radius:18px;background:var(--bg);box-shadow:0 22px 72px #0f213d3b;overscroll-behavior:contain}.head{padding:15px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--soft),var(--bg))}.brand-mark{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#1e40af,#3b5bdb 55%,#6d28d9);color:#fff;display:grid;place-content:center;font:800 19px/1 Georgia,serif;position:relative;box-shadow:0 3px 10px #275cda38;flex-shrink:0}.brand-mark span{position:absolute;right:2px;top:1px;font:10px system-ui;color:#fde047}.brand{font-weight:750;font-size:16px;flex:1;letter-spacing:-.4px;line-height:1.2}.brand small{display:block;font-size:9.5px;letter-spacing:.9px;color:var(--muted);font-weight:600;margin-top:2px}.head button{background:var(--bg);color:var(--muted);border:1px solid var(--line);border-radius:9px;padding:7px;display:flex}.head button:hover{color:var(--fg);border-color:var(--accent)}.head button[aria-pressed=true]{color:var(--accent);background:var(--accent-soft);border-color:var(--accent)}
      .tabs{display:flex;gap:0;border-bottom:1px solid var(--line);padding:0 14px;background:var(--bg)}.tab{background:transparent;border:0;border-bottom:2.5px solid transparent;color:var(--muted);padding:11px 10px;flex:1;font-size:12px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px}.tab[aria-selected=true]{color:var(--accent);border-color:var(--accent)}.body{padding:15px 16px}.status{font-size:11.5px;color:var(--muted);padding:9px 12px;margin-bottom:11px;background:var(--soft);border:1px solid var(--line);border-radius:10px;overflow-wrap:anywhere}.metrics{font-size:10.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:11px;margin-top:12px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:11px 0 0}.button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:var(--soft);color:var(--fg);border-radius:9px;padding:8px 11px;font-weight:600;font-size:11.5px}.button:hover:not(:disabled){border-color:var(--accent);background:var(--accent-soft)}.primary{background:#275cda;color:white;border-color:#275cda}.primary:hover:not(:disabled){background:#1e4bb8;color:white;border-color:#1e4bb8}.issue{width:100%;text-align:left;display:block;border:1px solid var(--line);border-left:3.5px solid var(--color);border-radius:10px;background:var(--bg);color:var(--fg);padding:11px 12px;margin:8px 0 4px}.issue:hover{background:var(--soft)}.category{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--color,var(--accent));font-weight:750;display:flex;align-items:center;justify-content:space-between}.quote{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:650;margin:4px 0}.detail{border:1px solid var(--line);border-left:3.5px solid var(--color);border-radius:11px;padding:13px;margin-top:11px;background:var(--soft)}.explain{color:var(--muted);margin:6px 0 10px;font-size:11.5px}.applied-feedback:empty{display:none}.applied-feedback{padding:8px 10px;border-radius:8px;background:var(--accent-soft);color:var(--accent);font-weight:600;margin:0 0 10px}.replacement{display:flex;width:100%;text-align:left;justify-content:flex-start;margin:5px 0 8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}.list{max-height:235px;overflow:auto;overscroll-behavior:contain;padding-right:2px}.filters{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}.filters button{font-size:10.5px;padding:4px 9px;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:999px;font-weight:600}.filters button[aria-pressed=true]{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.rewrite-intro{font-size:11.5px;color:var(--muted);margin:0 0 10px}.rewrite-actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.selection{padding:11px;background:var(--soft);border:1px solid var(--line);border-radius:9px;margin:9px 0;max-height:96px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.empty{padding:18px 8px;color:var(--muted);font-size:12px;text-align:center}.mark{position:absolute;pointer-events:auto;border:0;border-bottom:3px solid var(--color);padding:0;background:transparent;border-radius:1px;height:5px}.mark:hover,.mark:focus-visible{background:var(--color);opacity:.65}select{padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--fg);width:100%}.local-button{width:100%;font-size:11.5px;margin-top:8px}.rewrite-pane:empty:after{content:'Selecione um trecho no texto ou use o campo inteiro para explorar outras formas de escrever.';display:block;color:var(--muted);padding:14px 0;font-size:12px}@keyframes pulse{to{opacity:.35}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `,
    });
    const ui = node("div", { class: "ui" }),
      marks = node("div"),
      badge = node(
        "button",
        {
          class: "badge",
          "aria-label": "Abrir revisão Escrita IA. Arraste para mover o botão",
          "aria-expanded": "false",
        },
        [icon("spark")],
      ),
      badgeText = node("span", { text: "Escrita IA" }),
      count = node("span", { class: "count", text: "0" }),
      badgeMetrics = node("span", { class: "badge-metrics" });
    badge.append(badgeText, count, badgeMetrics, node("span", {
      class: "drag-hint", text: "⋮⋮", title: "Arraste para mover",
      "aria-hidden": "true",
    }));
    const panel = node("section", {
        class: "panel",
        role: "dialog",
        "aria-label": "Revisão de escrita",
      }),
      head = node("div", { class: "head" }),
      close = node("button", { "aria-label": "Fechar revisão", title: "Fechar (Esc)" }, [
        icon("close"),
      ]),
      pin = node(
        "button",
        { "aria-label": "Fixar painel", "aria-pressed": "false", title: "Fixar no canto da tela" },
        [icon("pin")],
      );
    const brandMark = node("div", { class: "brand-mark", "aria-hidden": "true", text: "e" }, [
      node("span", { text: "✦" }),
    ]);
    head.append(
      brandMark,
      node("span", { class: "brand", text: "Escrita IA" }, [
        node("small", { text: "SEU ESTÚDIO DE ESCRITA" }),
      ]),
      pin,
      close,
    );
    const tabs = node("div", {
        class: "tabs",
        role: "tablist",
        "aria-label": "Ferramentas de escrita",
      }),
      reviewTab = node("button", {
        class: "tab",
        role: "tab",
        id: "review-tab",
        "aria-controls": "review-pane",
        "aria-selected": "true",
      }, [icon("check"), node("span", { text: "Revisão" })]),
      rewriteTab = node("button", {
        class: "tab",
        role: "tab",
        id: "rewrite-tab",
        "aria-controls": "rewrite-pane",
        "aria-selected": "false",
        tabindex: "-1",
      }, [icon("wand"), node("span", { text: "Reescrita ✦" })]);
    tabs.append(reviewTab, rewriteTab);
    const body = node("div", { class: "body" }),
      status = node("div", {
        class: "status",
        role: "status",
        "aria-live": "polite",
      }),
      appliedFeedback = node("div", {
        class: "explain applied-feedback", role: "status", "aria-live": "polite",
      }),
      tools = node("div", { class: "toolbar" }),
      settings = node(
        "button",
        { class: "button", "aria-label": "Configurações", title: "Abrir configurações" },
        [icon("settings")],
      ),
      retry = node("button", { class: "button" }, [
        icon("refresh"),
        node("span", { text: "Buscar sugestões" }),
      ]),
      undo = node("button", { class: "button" }, [
        icon("undo"),
        node("span", { text: "Desfazer" }),
      ]),
      copy = node("button", { class: "button", title: "Copiar texto do campo" }, [
        icon("copy"),
        node("span", { text: "Copiar" }),
      ]),
      list = node("div", { class: "list" }),
      detail = node("div", { class: "detail" }),
      rewrite = node("div", { class: "rewrite-pane" }),
      metrics = node("div", { class: "metrics" }),
      filters = node("div", {
        class: "filters",
        "aria-label": "Filtrar sugestões",
        role: "group",
      }),
      localApply = node("button", {
        class: "button local-button",
      }, [icon("bolt"), node("span", { text: "Aplicar correções locais" })]),
      reviewPane = node("div", {
        id: "review-pane",
        role: "tabpanel",
        "aria-labelledby": "review-tab",
      }),
      rewritePane = node("div", {
        id: "rewrite-pane",
        role: "tabpanel",
        "aria-labelledby": "rewrite-tab",
      }),
      whole = node("button", { class: "button" }, [
        icon("selectAll"),
        node("span", { text: "Usar campo inteiro" }),
      ]),
      cleanBtn = node("button", { class: "button", title: "Remover espaços duplicados e normalizar pontuação" }, [
        icon("clean"),
        node("span", { text: "Limpar espaços" }),
      ]);
    rewritePane.append(
      node("p", {
        class: "rewrite-intro",
        text: "Selecione um trecho ou use o campo inteiro. Compare as alternativas antes de aplicar.",
      }),
      node("div", { class: "rewrite-actions" }, [whole, cleanBtn]),
      rewrite,
    );
    reviewPane.append(
      node("p", {
        class: "rewrite-intro",
        text: "Clique em Aplicar correção para substituir o trecho na página. Você pode desfazer depois.",
      }), filters, list, detail, localApply,
    );
    tools.append(retry, undo, copy, settings);
    body.append(appliedFeedback, status, reviewPane, rewritePane, tools, metrics);
    panel.append(head, tabs, body);
    ui.append(marks, badge, panel);
    root.append(css, ui);
    document.documentElement.append(host);
    panel.hidden = true;
    badge.hidden = true;
    undo.hidden = true;
    detail.hidden = true;
    rewritePane.hidden = true;
    const colors = {
      spelling: "#cf4864",
      grammar: "#b17422",
      punctuation: "#b17422",
      typography: "#3576c6",
      style: "#8261cf",
      tone: "#8261cf",
    };
    return {
      host,
      root,
      ui,
      marks,
      badge,
      badgeText,
      count,
      badgeMetrics,
      panel,
      body,
      status,
      appliedFeedback,
      settings,
      retry,
      undo,
      copy,
      cleanBtn,
      list,
      detail,
      rewrite,
      metrics,
      close,
      pin,
      tabs,
      reviewTab,
      rewriteTab,
      reviewPane,
      rewritePane,
      whole,
      filters,
      localApply,
      node,
      icon,
      colors,
    };
  }
  globalThis.EscritaPanel = { create };
})();
