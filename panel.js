(() => {
  const ns = "http://www.w3.org/2000/svg";
  const paths = {
    spark: "m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M18 6 6 18",
    settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
    undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 7v3",
    pin: "M9 3h6l-1 6 4 4H6l4-4ZM12 13v8",
  };
  function icon(name) {
    const svg = document.createElementNS(ns, "svg");
    for (const [k, v] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
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
      :host{all:initial;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}button,select{font:inherit}button{cursor:pointer}button:disabled{cursor:default;opacity:.45}svg{width:18px;height:18px;flex-shrink:0}button:focus-visible,select:focus-visible{outline:3px solid #80aaff;outline-offset:2px}
      .ui{--bg:#fff;--fg:#1b2941;--muted:#62738a;--line:#e0e7f0;--soft:#f4f7fc;--accent:#275cda;font:13px/1.5 system-ui,sans-serif;color:var(--fg)}.ui.dark{--bg:#182438;--fg:#edf3ff;--muted:#aabbd4;--line:#34435a;--soft:#21314a;--accent:#9dbfff;color-scheme:dark}
      .badge{position:absolute;pointer-events:auto;display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:12px;padding:7px 11px;color:var(--fg);background:var(--bg);box-shadow:0 4px 16px #11254824;font-size:11px;white-space:nowrap;max-width:calc(100vw - 16px)}.badge svg{color:var(--accent);width:17px}.badge .count{background:var(--soft);border-radius:6px;padding:1px 6px;font-weight:700}.badge-metrics{display:none}.badge[data-state=loading] svg{animation:pulse 1s ease-in-out infinite alternate}.badge[data-state=error]{border-color:#db8668}
      .panel{position:absolute;pointer-events:auto;width:390px;max-width:calc(100vw - 16px);max-height:calc(100vh - 24px);overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--bg);box-shadow:0 20px 70px #11233d35;overscroll-behavior:contain}.head{padding:18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line)}.head>svg{color:var(--accent);width:25px;height:25px}.brand{font-weight:750;font-size:17px;flex:1;letter-spacing:-.5px}.brand small{display:block;font-size:10px;letter-spacing:.8px;color:var(--muted);font-weight:500}.head button{background:var(--soft);color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:7px;display:flex}.head button[aria-pressed=true]{color:var(--accent);background:var(--soft)}
      .tabs{display:flex;gap:0;border-bottom:1px solid var(--line);padding:0 16px}.tab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--muted);padding:13px 12px;flex:1;font-size:12px;font-weight:600}.tab[aria-selected=true]{color:var(--accent);border-color:var(--accent)}.body{padding:16px}.status{font-size:11px;color:var(--muted);padding:10px 12px;margin-bottom:12px;background:var(--soft);border-radius:8px;overflow-wrap:anywhere}.metrics{font-size:10px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:12px 0 0}.button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:var(--soft);color:var(--fg);border-radius:8px;padding:9px 11px;font-weight:600;font-size:12px}.primary{background:#275cda;color:white;border-color:#275cda}.issue{width:100%;text-align:left;display:block;border:1px solid var(--line);border-left:3px solid var(--color);border-radius:9px;background:var(--bg);color:var(--fg);padding:12px;margin:8px 0}.issue:hover{background:var(--soft)}.category{font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--color,var(--accent));font-weight:700}.quote{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:600;margin:5px 0}.detail{border:1px solid var(--line);border-left:3px solid var(--color);border-radius:10px;padding:13px;margin-top:12px;background:var(--soft)}.explain{color:var(--muted);margin:7px 0 12px;font-size:12px}.replacement{display:block;width:100%;text-align:left;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}.list{max-height:230px;overflow:auto;overscroll-behavior:contain}.filters{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}.filters button{font-size:10px;padding:5px 8px;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:6px}.filters button[aria-pressed=true]{background:var(--soft);color:var(--accent);border-color:var(--accent)}.rewrite-intro{font-size:12px;color:var(--muted);margin:0 0 12px}.selection{padding:12px;background:var(--soft);border-radius:8px;margin:10px 0;max-height:100px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.empty{padding:18px 8px;color:var(--muted);font-size:12px;text-align:center}.mark{position:absolute;pointer-events:auto;border:0;border-bottom:3px solid var(--color);padding:0;background:transparent;border-radius:1px;height:5px}.mark:hover,.mark:focus-visible{background:var(--color);opacity:.65}select{padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);width:100%}.local-button{width:100%;font-size:11px;margin-top:8px}.rewrite-pane:empty:after{content:'Selecione um trecho no texto ou use o campo inteiro para explorar outras formas de escrever.';display:block;color:var(--muted);padding:15px 0;font-size:12px}@keyframes pulse{to{opacity:.35}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
    `,
    });
    const ui = node("div", { class: "ui" }),
      marks = node("div"),
      badge = node(
        "button",
        {
          class: "badge",
          "aria-label": "Abrir revisão Escrita IA",
          "aria-expanded": "false",
        },
        [icon("spark")],
      ),
      badgeText = node("span", { text: "Escrita IA" }),
      count = node("span", { class: "count", text: "0" }),
      badgeMetrics = node("span", { class: "badge-metrics" });
    badge.append(badgeText, count, badgeMetrics);
    const panel = node("section", {
        class: "panel",
        role: "dialog",
        "aria-label": "Revisão de escrita",
      }),
      head = node("div", { class: "head" }),
      close = node("button", { "aria-label": "Fechar revisão" }, [
        icon("close"),
      ]),
      pin = node(
        "button",
        { "aria-label": "Fixar painel", "aria-pressed": "false" },
        [icon("pin")],
      );
    head.append(
      icon("spark"),
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
        text: "Revisão",
      }),
      rewriteTab = node("button", {
        class: "tab",
        role: "tab",
        id: "rewrite-tab",
        "aria-controls": "rewrite-pane",
        "aria-selected": "false",
        tabindex: "-1",
        text: "Reescrita ✦",
      });
    tabs.append(reviewTab, rewriteTab);
    const body = node("div", { class: "body" }),
      status = node("div", {
        class: "status",
        role: "status",
        "aria-live": "polite",
      }),
      tools = node("div", { class: "toolbar" }),
      settings = node(
        "button",
        { class: "button", "aria-label": "Configurações" },
        [icon("settings")],
      ),
      retry = node("button", { class: "button", text: "Revisar" }),
      undo = node("button", { class: "button", text: "Desfazer" }),
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
        text: "Aplicar correções locais",
      }),
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
      whole = node("button", { class: "button", text: "Usar campo inteiro" });
    rewritePane.append(
      node("p", {
        class: "rewrite-intro",
        text: "Selecione um trecho ou use o campo inteiro. Compare as alternativas antes de aplicar.",
      }),
      whole,
      rewrite,
    );
    reviewPane.append(filters, list, detail, localApply);
    tools.append(retry, undo, settings);
    body.append(status, reviewPane, rewritePane, tools, metrics);
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
      settings,
      retry,
      undo,
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
