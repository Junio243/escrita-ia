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
  $("terms").replaceChildren();
  for (const word of dictionary[$("dictLanguage").value] || []) {
    const row = document.createElement("div");
    row.className = "term";
    const text = document.createElement("span");
    text.textContent = word;
    const button = document.createElement("button");
    button.textContent = "Remover";
    button.onclick = async () => {
      const { dictionary: latest = {} } =
          await chrome.storage.local.get("dictionary"),
        lang = $("dictLanguage").value;
      latest[lang] = (latest[lang] || []).filter((w) => w !== word);
      await chrome.storage.local.set({ dictionary: latest });
      terms();
    };
    row.append(text, button);
    $("terms").append(row);
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
  }
  await terms();
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
  try {
    await savePreferences(false);
    const r = await chrome.runtime.sendMessage({
      type: "analyze",
      text: "Esta é uma frase de teste.",
    });
    if (!r.ok) throw Error(r.error);
    status("Conexão confirmada. A API retornou uma análise válida.", "success");
  } catch (e) {
    status(e.message, "error");
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
for (const [id, url] of [
  ["preset-openai", DEFAULT_PROVIDER_URL],
  ["preset-openrouter", "https://openrouter.ai/api/v1"],
  ["preset-local", "http://localhost:11434/v1"],
  ["preset-google", GOOGLE_PROVIDER_URL],
])
  $(id).onclick = () => {
    $("providerUrl").value = url;
    $("key").value = "";
    $("model").value = id === "preset-openai" ? "gpt-4.1-mini" : "";
    $("providerFormat").value = id === "preset-google" ? "chat" : "auto";
    $("model").placeholder =
      id === "preset-google"
        ? "Identificador exato do modelo Gemini no AI Studio"
        : id === "preset-openrouter"
          ? "Ex.: openai/gpt-4o-mini ou anthropic/claude-3.5-sonnet"
        : "Identificador fornecido pelo seu provedor";
    if (id === "preset-openrouter") $("model").value = "openai/gpt-4o-mini";
    status("Predefinição preenchida. Confira o modelo e salve para usar.");
    credentialState().catch((e) => status(e.message));
  };
$("dictLanguage").onchange = terms;
$("add").onclick = async () => {
  try {
    const r = await chrome.runtime.sendMessage({
      type: "dictionaryAdd",
      word: $("word").value.trim(),
      language: $("dictLanguage").value,
    });
    if (!r.ok) throw Error(r.error);
    $("word").value = "";
    await terms();
    status("Termo adicionado.");
  } catch (e) {
    status(e.message, "error");
  }
};
