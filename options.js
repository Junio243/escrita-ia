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
let busy = false,
  editingId = null,
  credentialsData = [],
  credentialMode = "manual",
  activeCredentialId = "current";
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
  const editing =
    editingId && credentialsData.find((item) => item.id === editingId);
  let usable = false;
  try {
    usable =
      !!key &&
      normalizeProviderUrl(bound) ===
        normalizeProviderUrl($("providerUrl").value);
  } catch {}
  $("credential-state").textContent = editing
    ? editing.keyStorage === "local"
      ? "Uma chave está guardada para esta credencial. Digite uma nova chave apenas para substituí-la."
      : editing.keyStorage === "session"
        ? "A chave desta credencial existe somente nesta sessão."
        : "Esta credencial não tem chave. Digite uma chave para vinculá-la."
    : usable
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
function credentialStateText(credential) {
  return `${credential.enabled ? "Ativa" : "Pausada"} · ${
    credential.keyStorage === "none"
      ? "sem chave"
      : credential.keyStorage === "local"
        ? "chave salva"
        : "somente sessão"
  }`;
}
function credentialUsageText(credential) {
  const today = credential.dailyLimit
    ? `${credential.usage.dayRequests}/${credential.dailyLimit} hoje`
    : `${credential.usage.dayRequests} hoje`;
  return `Uso: ${credential.usage.requests} requisições no total · ${today} · ${credential.usage.dayCharacters} caracteres hoje · ${credential.usage.characters} caracteres no total · ${credential.usage.errors} erros`;
}
function renderCredentials() {
  const container = $("credential-list");
  if (!container) return;
  const list = credentialsData;
  container.replaceChildren();
  for (const credential of list) {
    const card = document.createElement("div");
    card.className = "credential-card";
    if (
      credentialMode === "manual" &&
      credential.id === activeCredentialId
    )
      card.classList.add("active");
    const head = document.createElement("div");
    head.className = "credential-head";
    const title = document.createElement("strong");
    title.textContent = credential.label;
    const state = document.createElement("span");
    state.textContent = credentialStateText(credential);
    head.append(title, state);
    const meta = document.createElement("small");
    meta.textContent = `${credential.url} · ${credential.model} · ${credential.format}`;
    const usage = document.createElement("small");
    usage.textContent = credentialUsageText(credential);
    const actions = document.createElement("div");
    actions.className = "credential-actions";
    const select = document.createElement("input");
    select.type = "radio";
    select.name = "credential-selected";
    select.checked =
      credentialMode === "manual" && credential.id === activeCredentialId;
    select.onchange = () => setActiveCredential(credential.id);
    const selectLabel = document.createElement("label");
    selectLabel.className = "check";
    selectLabel.append(select, document.createTextNode(" Usar agora"));
    const auto = document.createElement("input");
    auto.type = "checkbox";
    auto.checked = credential.autoInclude;
    auto.disabled = credential.id === "current";
    auto.onchange = () =>
      updateCredential(credential.id, { autoInclude: auto.checked });
    const autoLabel = document.createElement("label");
    autoLabel.className = "check";
    autoLabel.append(auto, document.createTextNode(" Rotação automática"));
    const limit = document.createElement("input");
    limit.type = "number";
    limit.min = "0";
    limit.step = "1";
    limit.value = String(credential.dailyLimit);
    limit.disabled = credential.id === "current";
    limit.onchange = () =>
      updateCredential(credential.id, {
        dailyLimit: Math.max(0, Number(limit.value) || 0),
      });
    const limitLabel = document.createElement("label");
    limitLabel.className = "check";
    limitLabel.append(limit, document.createTextNode(" Limite diário"));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.onclick = () => editCredential(credential.id);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remover";
    remove.disabled = credential.id === "current";
    remove.onclick = () => removeCredential(credential.id);
    actions.append(selectLabel, autoLabel, limitLabel, edit, remove);
    card.append(head, meta, usage, actions);
    container.append(card);
  }
}
async function refreshCredentials(message = "") {
  const p = await chrome.runtime.sendMessage({ type: "prefs" });
  if (!p?.ok) throw Error(p?.error || "Não foi possível ler as credenciais.");
  credentialsData = p.credentials || [];
  credentialMode = p.credentialMode || "manual";
  activeCredentialId = p.activeCredentialId || "current";
  if ($("credential-mode-manual"))
    $("credential-mode-manual").checked = credentialMode === "manual";
  if ($("credential-mode-auto"))
    $("credential-mode-auto").checked = credentialMode === "auto";
  const saved = credentialsData.filter((c) => c.id !== "current").length;
  if ($("credential-count"))
    $(
      "credential-count",
    ).textContent = `${saved} ${saved === 1 ? "chave salva" : "chaves salvas"}`;
  renderCredentials();
  if (message) status(message, "success");
}
async function persistCredentials(message = "Credenciais atualizadas.") {
  const stored = credentialsData.filter((credential) => credential.id !== "current");
  await chrome.storage.local.set({
    credentials: stored,
    credentialMode,
    activeCredentialId,
  });
  await refreshCredentials(message);
}
async function updateCredential(id, changes) {
  if (id === "current") {
    status(
      "Salve o provedor como credencial para usar limite diário e rotação automática.",
      "error",
    );
    return;
  }
  const index = credentialsData.findIndex((item) => item.id === id);
  if (index < 0) return;
  credentialsData[index] = {
    ...credentialsData[index],
    ...changes,
    updatedAt: Date.now(),
  };
  await persistCredentials();
}
async function setActiveCredential(id) {
  credentialMode = "manual";
  activeCredentialId = id;
  const credential = credentialsData.find((item) => item.id === id);
  if (credential && credential.id !== "current") {
    await chrome.storage.local.set({
      providerUrl: credential.url,
      providerFormat: credential.format,
      model: credential.model,
    });
    $("providerUrl").value = credential.url;
    $("providerFormat").value = credential.format;
    $("model").value = credential.model;
  }
  await persistCredentials(`Usando ${credential?.label || "provedor atual"}.`);
  await credentialState();
}
async function removeCredential(id) {
  if (id === "current") {
    status("O provedor atual não pode ser removido. Salve-o como credencial primeiro.", "error");
    return;
  }
  credentialsData = credentialsData.filter((item) => item.id !== id);
  const a = await chrome.storage.local.get({ credentialKeys: {} }),
    b = await chrome.storage.session.get({ credentialSessionKeys: {} });
  const localKeys = { ...a.credentialKeys },
    sessionKeys = { ...b.credentialSessionKeys };
  delete localKeys[id];
  delete sessionKeys[id];
  await chrome.storage.local.set({ credentialKeys: localKeys });
  await chrome.storage.session.set({ credentialSessionKeys: sessionKeys });
  if (activeCredentialId === id) activeCredentialId = "current";
  if (editingId === id) editingId = null;
  await persistCredentials("Credencial removida.");
}
async function editCredential(id) {
  const credential = credentialsData.find((item) => item.id === id);
  if (!credential) return;
  editingId = credential.id === "current" ? null : credential.id;
  if (editingId) {
    $("providerUrl").value = credential.url;
    $("providerFormat").value = credential.format;
    $("model").value = credential.model;
    $("credential-label").value = credential.label;
    $("credential-limit").value = String(credential.dailyLimit);
    $("credential-auto").checked = credential.autoInclude;
    status(`Editando ${credential.label}. Digite uma chave apenas para substituir.`);
  } else {
    status("Configure o provedor acima e salve como credencial para gerenciar chaves.");
  }
  await credentialState();
}
async function saveCredential() {
  await secure;
  const providerUrl = normalizeProviderUrl($("providerUrl").value),
    model = $("model").value.trim();
  if (!model) throw Error("Informe o nome do modelo antes de salvar a credencial.");
  const label =
    $("credential-label").value.trim() ||
    `Provedor ${credentialsData.filter((c) => c.id !== "current").length + 1}`,
    dailyLimit = Math.max(0, Number($("credential-limit").value) || 0),
    autoInclude = $("credential-auto").checked,
    remember = $("remember").checked,
    supplied = $("key").value.trim(),
    id =
      editingId ||
      `credential-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    existing =
      editingId && credentialsData.find((item) => item.id === editingId),
    format = isGoogleProvider(providerUrl)
      ? "chat"
      : $("providerFormat").value,
    keyStorage = supplied
      ? remember
        ? "local"
        : "session"
      : existing?.keyStorage || "none";
  const item = {
    id,
    label,
    url: providerUrl,
    model,
    format,
    enabled: existing?.enabled !== false,
    autoInclude,
    keyStorage,
    dailyLimit,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const stored = credentialsData.filter(
    (credential) => credential.id !== "current" && credential.id !== id,
  );
  stored.push(item);
  await chrome.storage.local.set({
    credentials: stored,
    credentialMode: "manual",
    activeCredentialId: id,
    providerUrl,
    providerFormat: format,
    model,
  });
  const a = await chrome.storage.local.get({ credentialKeys: {} }),
    b = await chrome.storage.session.get({ credentialSessionKeys: {} });
  const localKeys = { ...a.credentialKeys },
    sessionKeys = { ...b.credentialSessionKeys };
  if (supplied) {
    if (remember) {
      localKeys[id] = supplied;
      delete sessionKeys[id];
    } else {
      sessionKeys[id] = supplied;
      delete localKeys[id];
    }
  } else if (keyStorage === "none") {
    delete localKeys[id];
    delete sessionKeys[id];
  }
  await chrome.storage.local.set({ credentialKeys: localKeys });
  await chrome.storage.session.set({ credentialSessionKeys: sessionKeys });
  $("key").value = "";
  $("key").type = "password";
  $("show-key").textContent = "Mostrar";
  $("show-key").setAttribute("aria-pressed", "false");
  editingId = id;
  activeCredentialId = id;
  credentialMode = "manual";
  await credentialState();
  await refreshCredentials(
    `${existing ? "Credencial atualizada" : "Nova credencial salva"}: ${label}.`,
  );
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
  await refreshCredentials().catch(() => {});
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
$("save-credential").onclick = async () => {
  lock(true);
  try {
    await saveCredential();
  } catch (e) {
    status(e.message, "error");
  } finally {
    lock(false);
  }
};
$("use-credential").onclick = async () => {
  lock(true);
  try {
    await setActiveCredential(editingId || activeCredentialId);
    status("Credencial selecionada.", "success");
  } catch (e) {
    status(e.message, "error");
  } finally {
    lock(false);
  }
};
$("remove-credential").onclick = async () => {
  lock(true);
  try {
    await removeCredential(editingId || activeCredentialId);
  } catch (e) {
    status(e.message, "error");
  } finally {
    lock(false);
  }
};
document
  .querySelectorAll('input[name="credential-mode"]')
  .forEach((element) => {
    element.onchange = async () => {
      credentialMode = element.value;
      lock(true);
      try {
        await persistCredentials(
          element.value === "auto"
            ? "Rotação automática ativada. A melhor chave menos usada será escolhida."
            : "Seleção manual ativada.",
        );
      } catch (e) {
        status(e.message, "error");
      } finally {
        lock(false);
      }
    };
  });
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
  if (
    area === "local" &&
    (changes.credentials ||
      changes.credentialUsage ||
      changes.credentialMode ||
      changes.activeCredentialId)
  )
    refreshCredentials().catch(() => {});
});
