(() => {
  const engine = globalThis.EscritaEngine;
  const writing = document.querySelector("#writing");
  const suggestions = document.querySelector("#suggestions");
  const status = document.querySelector("#status");
  const undo = document.querySelector("#undo");
  const shell = document.querySelector(".editor-shell");
  const focus = document.querySelector("#focus");
  const theme = document.querySelector("#theme");
  const copy = document.querySelector("#copy");
  const examples = {
    idea: writing.value,
    email:
      "Olá, equipe!\n\nGostaria gostaria de compartilhar  uma proposta para nossa próxima conversa. Podemos marcar um horário nesta semana?\n\nObrigado pela atenção.",
    work: "Um projeto bem pensado começa com uma pergunta clara.\n\nNossa nossa prioridade é transformar  ideias em soluções que façam sentido para as pessoas.",
    social:
      "Pequenas ideias também também merecem espaço.\n\nHoje decidi compartilhar  um pouco do que estou criando. Qual foi a última ideia que fez você parar para pensar?",
  };
  let previous = null;
  let focused = false;
  let selection = "idea";
  let savedInert = [];

  function syncExamples() {
    document.querySelectorAll("[data-example]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.example === selection),
      );
    });
  }

  function render(message = "") {
    const text = writing.value;
    const metrics = engine.metrics(text);
    document.querySelector("#metrics").textContent =
      `${metrics.words} palavras · ${metrics.characters} caracteres`;
    document.querySelector("#reading").textContent = metrics.words
      ? `${Math.max(1, Math.ceil(metrics.words / 200))} min de leitura`
      : "Sua página em branco";
    const issues = engine.merge(engine.localIssues(text), text);
    document.querySelector("#issue-count").textContent = String(issues.length);
    document.querySelector("#empty-state").hidden =
      issues.length > 0 || !text.trim();
    status.textContent =
      message ||
      (issues.length
        ? `${issues.length} sugestões locais. Ajuste o que fizer sentido para você.`
        : text.trim()
          ? "Nenhum espaço ou palavra duplicada encontrado. A revisão com IA está disponível na extensão."
          : "Comece a escrever para ver as sugestões.");
    suggestions.replaceChildren();
    for (const issue of issues.slice(0, 20)) {
      const card = document.createElement("div");
      card.className = "suggestion";
      const detail = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = issue.rule;
      const description = document.createElement("p");
      description.textContent = `“${issue.quote.replaceAll(" ", "·")}” → “${issue.replacements[0].replaceAll(" ", "·")}”`;
      const apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = "Aplicar ↗";
      apply.setAttribute(
        "aria-label",
        `Aplicar: ${issue.rule}, ${issue.quote}`,
      );
      apply.addEventListener("click", () => {
        if (writing.value !== text) {
          render();
          return;
        }
        previous = { text, selection };
        writing.value =
          text.slice(0, issue.start) +
          issue.replacements[0] +
          text.slice(issue.end);
        render("Sugestão aplicada. Você pode desfazer a última alteração.");
        writing.focus({ preventScroll: true });
        writing.setSelectionRange(
          issue.start,
          issue.start + issue.replacements[0].length,
        );
      });
      detail.append(title, description);
      card.append(detail, apply);
      suggestions.append(card);
    }
    if (issues.length > 20)
      status.textContent += " Exibindo as primeiras 20 sugestões.";
    undo.disabled = previous === null;
    copy.disabled = !text.trim();
    syncExamples();
  }

  writing.addEventListener("input", () => {
    previous = null;
    selection = null;
    render();
  });
  undo.addEventListener("click", () => {
    if (previous === null) return;
    writing.value = previous.text;
    selection = previous.selection;
    previous = null;
    render("Última alteração desfeita.");
    writing.focus({ preventScroll: true });
  });

  function loadExample(key) {
    previous = { text: writing.value, selection };
    selection = key;
    writing.value = examples[key];
    render(
      "Exemplo carregado. Use Desfazer para recuperar seu texto anterior.",
    );
  }
  document
    .querySelectorAll("[data-example]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        loadExample(button.dataset.example),
      ),
    );
  document.querySelector("#reset").addEventListener("click", () => {
    loadExample("idea");
    writing.focus({ preventScroll: true });
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(writing.value);
      status.textContent =
        "Texto copiado. Sua próxima conversa espera por ele.";
    } catch {
      writing.focus();
      writing.select();
      status.textContent =
        "Não foi possível copiar automaticamente. O texto está selecionado: use Ctrl+C ou ⌘C.";
    }
  });

  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    theme.setAttribute("aria-pressed", String(dark));
    theme.setAttribute(
      "aria-label",
      dark ? "Ativar tema claro" : "Ativar tema escuro",
    );
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#14231e"
      : "#f5f6f0";
  }
  let storedTheme;
  try {
    storedTheme = localStorage.getItem("escrita-theme");
  } catch {}
  const preferred = matchMedia("(prefers-color-scheme: dark)");
  setTheme(storedTheme ? storedTheme === "dark" : preferred.matches);
  preferred.addEventListener("change", (event) => {
    if (!storedTheme) setTheme(event.matches);
  });
  theme.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    storedTheme = dark ? "dark" : "light";
    setTheme(dark);
    try {
      localStorage.setItem("escrita-theme", storedTheme);
    } catch {}
  });

  function setFocus(enabled) {
    focused = enabled;
    document.body.classList.toggle("focus-mode", enabled);
    focus.setAttribute("aria-pressed", String(enabled));
    focus.setAttribute(
      "aria-label",
      enabled ? "Sair do modo foco" : "Ativar modo foco",
    );
    if (enabled) {
      shell.setAttribute("role", "dialog");
      shell.setAttribute("aria-modal", "true");
      shell.setAttribute("aria-label", "Estúdio de escrita em modo foco");
      savedInert = [
        ...document.querySelectorAll(
          "body > header, body > footer, body > .skip, main > section:not(.hero), .hero-copy, .stage-label, .stage-caption",
        ),
      ].map((element) => [element, element.inert]);
      savedInert.forEach(([element]) => {
        element.inert = true;
      });
      writing.focus({ preventScroll: true });
    } else {
      shell.removeAttribute("role");
      shell.removeAttribute("aria-modal");
      shell.removeAttribute("aria-label");
      savedInert.forEach(([element, wasInert]) => {
        element.inert = wasInert;
      });
      savedInert = [];
      focus.focus({ preventScroll: true });
    }
  }
  focus.addEventListener("click", () => setFocus(!focused));
  document.addEventListener("keydown", (event) => {
    if (!focused) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setFocus(false);
    }
    if (event.key === "Tab") {
      const controls = [
        ...shell.querySelectorAll("button:not(:disabled), textarea"),
      ].filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  if (
    "IntersectionObserver" in window &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    document
      .querySelectorAll(".feature-card")
      .forEach((card) => reveal.observe(card));
  }
  render();
})();
