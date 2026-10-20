import {
  normalizeProviderUrl,
  DEFAULT_PROVIDER_URL,
  GOOGLE_PROVIDER_URL,
  isGoogleProvider,
} from "./provider.js";
const $ = (id) => document.getElementById(id),
  E = globalThis.EscritaEngine;
const secure = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});
const status = (text, state = "ready") => {
  $("status").textContent = text;
  $("status").dataset.state = state;
  $("status").setAttribute("aria-busy", String(state === "loading"));
};
const connectionStep = (text, state = "ready") => {
  $("connection-steps").textContent = text;
  $("connection-steps").dataset.state = state;
};
let busy = false;
function lock(value) {
  busy = value;
  document
    .querySelectorAll("#form input,#form select,#form button")
    .forEach((control) => {
      control.disabled = value;
    });
}
async function credentialState() {
  const a = await chrome.storage.local.get(["apiKey", "apiKeyProviderUrl"]),
    b = await chrome.storage.session.get(["apiKey", "apiKeyProviderUrl"]);
  const key = b.apiKey || a.apiKey,
    bound =
      (b.apiKey ? b.apiKeyProviderUrl : a.apiKeyProviderUrl) ||
      DEFAULT_PROVIDER_URL;
  let usable = false;
  try {
    usable =
      !!key &&
      normalizeProviderUrl(bound) ===
        normalizeProviderUrl($("providerUrl").value);
  } catch {}
  $("credential-state").textContent = usable
    ? "Uma chave está guardada para este provedor. Ela não é exibida neste formulário."
    : "Nenhuma chave guardada para esta URL. Servidores locais podem dispensar a chave.";
}
for (const [value, label] of Object.entries(E.languages)) {
  for (const id of ["language", "dictLanguage"]) {
    if (id === "dictLanguage" && value === "auto") continue;
    const option = new Option(label, value);
    $(id).append(option);
  }
}
$("dictLanguage").value = "pt-BR";
function theme(value) {
  document.documentElement.classList.toggle(
    "dark",
    value === "dark" ||
      (value === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
}
async function terms() {
  const { dictionary = {} } = await chrome.storage.local.get("dictionary");
  const lang = $("dictLanguage").value;
  const allWords = dictionary[lang] || [];
  const query = E.norm($("dict-search")?.value || "").trim();
  const filtered = query
    ? allWords.filter((w) => E.norm(w).includes(query))
    : allWords;
  if ($("dict-count")) {
    $("dict-count").textContent = `${allWords.length} ${allWords.length === 1 ? "termo" : "termos"}`;
  }
  if ($("clear-dict")) $("clear-dict").disabled = allWords.length === 0;
  $("terms").replaceChildren();
  for (const word of filtered) {
    const row = document.createElement("div");
    row.className = "term";
    const text = document.createElement("span");
    text.textContent = word;
    const button = document.createElement("button");
    button.textContent = "Remover";
    button.type = "button";
    button.onclick = async () => {
      const { dictionary: latest = {} } =
          await chrome.storage.local.get("dictionary"),
        currentLang = $("dictLanguage").value;
      latest[currentLang] = (latest[currentLang] || []).filter((w) => w !== word);
      await chrome.storage.local.set({ dictionary: latest });
      terms();
    };
    row.append(text, button);
    $("terms").append(row);
  }
}
async function renderPausedSites() {
  if (!$("paused-sites")) return;
  const { autoSites = {} } = await chrome.storage.local.get("autoSites");
  const paused = Object.entries(autoSites).filter(([, enabled]) => enabled === false);
  $("paused-sites").replaceChildren();
  if ($("clear-sites")) $("clear-sites").disabled = paused.length === 0;
  for (const [siteOrigin] of paused) {
    const row = document.createElement("div");
    row.className = "term";
    const text = document.createElement("span");
    text.textContent = siteOrigin;
    const button = document.createElement("button");
    button.textContent = "Reativar";
    button.type = "button";
    button.onclick = async () => {
      const { autoSites: latest = {} } = await chrome.storage.local.get("autoSites");
      delete latest[siteOrigin];
      await chrome.storage.local.set({ autoSites: latest });
      await renderPausedSites();
      status(`Assistente reativado em ${siteOrigin}.`, "success");
    };
    row.append(text, button);
    $("paused-sites").append(row);
  }
}
status("Carregando configurações…", "loading");
lock(true);
(async () => {
  await secure;
  const p = await chrome.storage.local.get({
      model: "gpt-4.1-mini",
      apiKey: "",
      apiKeyProviderUrl: "",
      providerUrl: DEFAULT_PROVIDER_URL,
      providerFormat: "auto",
      assistantEnabled: true,
      language: "auto",
      picky: false,
      theme: "system",
    }),
    s = await chrome.storage.session.get(["apiKey", "apiKeyProviderUrl"]);
  $("providerUrl").value = p.providerUrl;
  $("providerFormat").value = p.providerFormat;
  $("model").value = p.model;
  $("enabled").checked = p.assistantEnabled;
  $("language").value = p.language;
  $("picky").checked = p.picky;
  $("theme").value = p.theme;
  theme(p.theme);
  const selected = normalizeProviderUrl(p.providerUrl),
    raw = s.apiKey || p.apiKey || "",
    bound =
      (s.apiKey ? s.apiKeyProviderUrl : p.apiKeyProviderUrl) ||
      DEFAULT_PROVIDER_URL,
    usable = raw && normalizeProviderUrl(bound) === selected;
  if (usable) {
    $("remember").checked = !!p.apiKey;
    status(
      p.apiKey
        ? "Provedor configurado; chave salva neste navegador."
        : "Provedor configurado; chave disponível nesta sessão.",
    );
  } else {
    status("Pronto para personalizar seu assistente.");
  }
  await terms();
  await renderPausedSites();
  await credentialState();
})()
  .catch((e) => status(e.message, "error"))
  .finally(() => lock(false));
$("theme").onchange = () => theme($("theme").value);
async function savePreferences(announce = true) {
  await secure;
  const providerUrl = normalizeProviderUrl($("providerUrl").value),
    model = $("model").value.trim();
  if (!model) throw Error("Informe o nome do modelo.");
  const supplied = $("key").value.trim(),
    a = await chrome.storage.local.get(["apiKey", "apiKeyProviderUrl"]),
    b = await chrome.storage.session.get(["apiKey", "apiKeyProviderUrl"]),
    raw = b.apiKey || a.apiKey || "",
    bound =
      (b.apiKey ? b.apiKeyProviderUrl : a.apiKeyProviderUrl) ||
      DEFAULT_PROVIDER_URL,
    apiKey =
      supplied ||
      (raw && normalizeProviderUrl(bound) === providerUrl ? raw : "");
  if (apiKey) {
    if ($("remember").checked) {
      await chrome.storage.local.set({
        apiKey,
        apiKeyProviderUrl: providerUrl,
      });
      await chrome.storage.session.remove(["apiKey", "apiKeyProviderUrl"]);
    } else {
      await chrome.storage.session.set({
        apiKey,
        apiKeyProviderUrl: providerUrl,
      });
      await chrome.storage.local.remove(["apiKey", "apiKeyProviderUrl"]);
    }
  }
  await chrome.storage.local.set({
    schemaVersion: 3,
    autoApply: false,
    providerUrl,
    providerFormat: isGoogleProvider(providerUrl)
      ? "chat"
      : $("providerFormat").value,
    model,
    assistantEnabled: $("enabled").checked,
    language: $("language").value,
    picky: $("picky").checked,
    theme: $("theme").value,
  });
  $("providerUrl").value = providerUrl;
  if (isGoogleProvider(providerUrl)) $("providerFormat").value = "chat";
  $("key").value = "";
  $("key").type = "password";
  $("show-key").textContent = "Mostrar";
  $("show-key").setAttribute("aria-pressed", "false");
  await credentialState();
  if (announce) status("Provedor e preferências salvos.", "success");
}
$("form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  lock(true);
  try {
    await savePreferences();
  } catch (error) {
    status(error.message, "error");
  } finally {
    lock(false);
  }
};
$("forget").onclick = async () => {
  if (busy) return;
  lock(true);
  try {
    await chrome.storage.local.remove(["apiKey", "apiKeyProviderUrl"]);
    await chrome.storage.session.remove(["apiKey", "apiKeyProviderUrl"]);
    $("key").value = "";
    status("Chave removida.", "success");
    await credentialState();
  } catch (e) {
    status(e.message, "error");
  } finally {
    lock(false);
  }
};
$("test").onclick = async () => {
  if (busy) return;
  lock(true);
  status("Conectando ao provedor e testando com uma frase de exemplo…", "loading");
  connectionStep("Salvando as configurações…", "loading");
  try {
    await savePreferences(false);
    connectionStep("Enviando uma frase de teste ao modelo. Isso pode levar alguns segundos…", "loading");
    const r = await chrome.runtime.sendMessage({
      type: "analyze",
      text: "Esta é uma frase de teste.",
    });
    if (!r.ok) throw Error(r.error);
    status("Conexão confirmada. A API retornou uma análise válida.", "success");
    connectionStep("Conexão testada: o modelo respondeu. Você já pode revisar textos.", "success");
  } catch (e) {
    status(e.message, "error");
    connectionStep("Não foi possível confirmar a conexão. Confira a mensagem acima e tente novamente.", "error");
  } finally {
    lock(false);
  }
};
$("show-key").onclick = () => {
  const show = $("key").type === "password";
  $("key").type = show ? "text" : "password";
  $("show-key").textContent = show ? "Ocultar" : "Mostrar";
  $("show-key").setAttribute("aria-pressed", String(show));
  $("show-key").setAttribute(
    "aria-label",
    show ? "Ocultar chave digitada" : "Mostrar chave digitada",
  );
};
$("providerUrl").addEventListener("change", () =>
  credentialState().catch((e) => status(e.message)),
);
for (const [id, url, defaultModel, format] of [
  ["preset-openai", DEFAULT_PROVIDER_URL, "gpt-4.1-mini", "auto"],
  ["preset-openrouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini", "auto"],
  ["preset-groq", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "chat"],
  ["preset-local", "http://localhost:11434/v1", "", "auto"],
  ["preset-lmstudio", "http://localhost:1234/v1", "", "chat"],
  ["preset-google", GOOGLE_PROVIDER_URL, "", "chat"],
]) {
  const el = $(id);
  if (!el) continue;
  el.onclick = () => {
    $("providerUrl").value = url;
    $("key").value = "";
    $("model").value = defaultModel;
    $("providerFormat").value = format;
    $("model").placeholder =
      id === "preset-google"
        ? "Identificador exato do modelo Gemini no AI Studio"
        : id === "preset-openrouter"
          ? "Ex.: openai/gpt-4o-mini ou anthropic/claude-3.5-sonnet"
          : id === "preset-groq"
            ? "Ex.: llama-3.3-70b-versatile"
            : "Identificador fornecido pelo seu provedor";
    status("Predefinição preenchida. Confira o modelo e salve para usar.");
    credentialState().catch((e) => status(e.message));
  };
}
$("dictLanguage").onchange = terms;
if ($("dict-search")) $("dict-search").oninput = terms;
async function addTerm() {
  try {
    const r = await chrome.runtime.sendMessage({
      type: "dictionaryAdd",
      word: $("word").value.trim(),
      language: $("dictLanguage").value,
    });
    if (!r.ok) throw Error(r.error);
    $("word").value = "";
    await terms();
    status("Termo adicionado.", "success");
  } catch (e) {
    status(e.message, "error");
  }
}
$("add").onclick = addTerm;
$("word").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTerm();
  }
});
if ($("clear-dict")) {
  $("clear-dict").onclick = async () => {
    const lang = $("dictLanguage").value;
    const { dictionary = {} } = await chrome.storage.local.get("dictionary");
    delete dictionary[lang];
    await chrome.storage.local.set({ dictionary });
    await terms();
    status("Termos do idioma selecionado foram removidos.", "success");
  };
}
if ($("export-dict")) {
  $("export-dict").onclick = async () => {
    const { dictionary = {} } = await chrome.storage.local.get("dictionary");
    const blob = new Blob([JSON.stringify(dictionary, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "escrita-ia-dicionario.json";
    a.click();
    URL.revokeObjectURL(url);
    status("Dicionário exportado em JSON.", "success");
  };
}
if ($("import-dict") && $("import-file")) {
  $("import-dict").onclick = () => $("import-file").click();
  $("import-file").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw Error("Formato de dicionário inválido.");
      const { dictionary = {} } = await chrome.storage.local.get("dictionary");
      const merged = { ...dictionary };
      for (const [lang, list] of Object.entries(parsed)) {
        if (!Object.hasOwn(E.languages, lang) || lang === "auto" || !Array.isArray(list))
          continue;
        const current = [...(merged[lang] || [])];
        for (const item of list) {
          if (typeof item === "string" && item.trim() && item.length <= 100) {
            const w = item.trim();
            if (!current.some((x) => E.norm(x) === E.norm(w)) && current.length < 1000)
              current.push(w);
          }
        }
        merged[lang] = current;
      }
      await chrome.storage.local.set({ dictionary: merged });
      await terms();
      status("Dicionário importado com sucesso.", "success");
    } catch (err) {
      status(err.message || "Falha ao importar JSON.", "error");
    } finally {
      $("import-file").value = "";
    }
  };
}
if ($("clear-sites")) {
  $("clear-sites").onclick = async () => {
    await chrome.storage.local.set({ autoSites: {} });
    await renderPausedSites();
    status("Todos os sites foram reativados.", "success");
  };
}
if ($("reset-badge-pos")) {
  $("reset-badge-pos").onclick = async () => {
    await chrome.storage.local.set({ badgePosition: null });
    status("Posição do botão flutuante restaurada para o padrão.", "success");
  };
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.autoSites) renderPausedSites();
  if (area === "local" && changes.dictionary) terms();
});
