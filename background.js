import { E } from "./core.js";
import {
  DEFAULT_PROVIDER_URL,
  normalizeProviderUrl,
  transportOrder,
  requestFor,
  parseProviderResponse,
  isGoogleProvider,
  googleApiError,
} from "./provider.js";
const secured = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});
const jobs = new Map(),
  cache = new Map(),
  epochs = new Map(),
  stats = { analyses: 0, issues: 0, applied: 0 };
async function settings() {
  await secured;
  const p = await chrome.storage.local.get({
    assistantEnabled: true,
    autoSites: {},
    language: "auto",
    picky: false,
    dictionary: {},
    theme: "system",
    badgePosition: null,
  });
  return {
    assistantEnabled: p.assistantEnabled,
    autoSites: p.autoSites,
    language: p.language,
    picky: p.picky,
    dictionary: p.dictionary,
    theme: p.theme,
    badgePosition: p.badgePosition,
  };
}
async function credentials() {
  await secured;
  const a = await chrome.storage.local.get({
      model: "gpt-4.1-mini",
      apiKey: "",
      apiKeyProviderUrl: "",
      providerUrl: DEFAULT_PROVIDER_URL,
      providerFormat: "auto",
    }),
    b = await chrome.storage.session.get(["apiKey", "apiKeyProviderUrl"]);
  const url = normalizeProviderUrl(a.providerUrl),
    official =
      new URL(url).hostname === "api.openai.com" || isGoogleProvider(url),
    rawKey = b.apiKey || a.apiKey || "",
    boundUrl = (b.apiKey ? b.apiKeyProviderUrl : a.apiKeyProviderUrl) || "";
  let key = "";
  try {
    if (
      rawKey &&
      normalizeProviderUrl(boundUrl || DEFAULT_PROVIDER_URL) === url
    )
      key = rawKey;
  } catch {}
  return {
    model: String(a.model || "").trim(),
    key,
    url,
    format: a.providerFormat,
    ready: !!String(a.model || "").trim() && (!official || !!key),
  };
}
const siteKey = (u) => (u.protocol === "file:" ? "file://" : u.origin);
const active = (p, url) => {
  try {
    const u = new URL(url);
    return (
      ["http:", "https:", "file:"].includes(u.protocol) &&
      p.assistantEnabled &&
      p.autoSites[siteKey(u)] !== false
    );
  } catch {
    return false;
  }
};
const senderAllowed = (p, sender) => {
  if (!sender.tab) return true;
  if (String(sender.url || "").startsWith(chrome.runtime.getURL("")))
    return true;
  if (!active(p, sender.tab.url || sender.url)) return false;
  try {
    const protocol = new URL(sender.url).protocol;
    return ["http:", "https:", "file:"].includes(protocol)
      ? active(p, sender.url)
      : ["about:", "blob:", "data:"].includes(protocol);
  } catch {
    return false;
  }
};
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ schemaVersion: 3, autoApply: false });
  chrome.scripting
    .getRegisteredContentScripts()
    .then(
      (s) =>
        s.length &&
        chrome.scripting.unregisterContentScripts({ ids: s.map((x) => x.id) }),
    )
    .catch(() => {});
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (!["local", "session"].includes(area)) return;
  cache.clear();
  for (const job of jobs.values()) job.abort();
  chrome.tabs
    .query({ url: ["https://*/*", "http://*/*"] })
    .then((tabs) =>
      Promise.allSettled(
        tabs.map((t) =>
          chrome.tabs.sendMessage(t.id, { type: "prefsChanged" }),
        ),
      ),
    )
    .catch(() => {});
});
async function api(operation, input, prefs, credential, signal) {
  if (signal.aborted)
    throw new DOMException("Análise cancelada.", "AbortError");
  const cacheKey = JSON.stringify({
    operation,
    input,
    prefs,
    model: credential.model,
    url: credential.url,
    format: credential.format,
  });
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const unsupported = new Set([400, 404, 405, 415, 422, 501]),
    endpointMissing = new Set([404, 405, 501]),
    attempts = [],
    unavailable = new Set();
  for (const transport of transportOrder(credential.url, credential.format))
    for (const structure of ["strict", "json", "plain"])
      attempts.push({ transport, structure });
  let lastError;
  for (const attempt of attempts) {
    if (unavailable.has(attempt.transport)) continue;
    if (signal.aborted)
      throw new DOMException("Análise cancelada.", "AbortError");
    const request = requestFor(
      operation,
      input,
      prefs,
      credential,
      attempt.transport,
      attempt.structure,
    );
    let res;
    try {
      const headers = { "Content-Type": "application/json" };
      if (credential.key) headers.Authorization = `Bearer ${credential.key}`;
      res = await fetch(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(request.body),
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw e;
      throw Error(
        "Sem conexão com o provedor de IA. Confira a URL e tente novamente.",
      );
    }
    if (!res.ok) {
      if (isGoogleProvider(credential.url)) {
        let data = {};
        try {
          data = await res.json();
        } catch {}
        const reason = googleApiError(res.status, data);
        if (
          [400, 415, 422].includes(res.status) &&
          !reason.startsWith("Chave")
        ) {
          lastError = Error(reason);
          continue;
        }
        throw Error(reason);
      }
      if (unsupported.has(res.status)) {
        if (endpointMissing.has(res.status)) unavailable.add(attempt.transport);
        lastError = Error(
          `Formato ${attempt.transport}/${attempt.structure} não aceito.`,
        );
        continue;
      }
      throw Error(
        {
          401: "Chave recusada pelo provedor. Abra Configurações.",
          403: "Modelo ou recurso indisponível no provedor.",
          429: "Limite da API ou saldo atingido.",
        }[res.status] || `O provedor retornou erro ${res.status}.`,
      );
    }
    try {
      const result = parseProviderResponse(
        await res.json(),
        operation,
        attempt.transport,
      );
      if (signal.aborted)
        throw new DOMException("Análise cancelada.", "AbortError");
      cache.set(cacheKey, result);
      if (cache.size > 50) cache.delete(cache.keys().next().value);
      return result;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || Error("O provedor não oferece um formato compatível.");
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  const id = `${sender.tab?.id ?? "extension"}:${sender.frameId || 0}`;
  const isJob = ["analyze", "rewrite", "cancel"].includes(msg.type);
  const epoch = isJob ? (epochs.get(id) || 0) + 1 : 0;
  if (isJob) {
    epochs.set(id, epoch);
    jobs.get(id)?.abort();
  }
  (async () => {
    if (msg.type === "prefs") {
      const prefs = await settings(),
        c = await credentials();
      return {
        prefs,
        hasKey: c.ready,
        provider: {
          url: c.url,
          format: c.format,
          model: c.model,
          hasCredential: !!c.key,
        },
        version: chrome.runtime.getManifest().version,
        siteEnabled: senderAllowed(prefs, sender),
        stats: { ...stats },
      };
    }
    if (msg.type === "openSettings") {
      await chrome.runtime.openOptionsPage();
      return {};
    }
    if (msg.type === "applied") {
      stats.applied++;
      return {};
    }
    if (msg.type === "cancel") {
      jobs.get(id)?.abort();
      return {};
    }
    if (msg.type === "dictionaryAdd") {
      if (
        !Object.hasOwn(E.languages, msg.language) ||
        msg.language === "auto" ||
        typeof msg.word !== "string" ||
        !msg.word.trim() ||
        msg.word.length > 100
      )
        throw Error("Termo inválido.");
      const p = await settings(),
        terms = p.dictionary[msg.language] || [];
      if (!terms.some((w) => E.norm(w) === E.norm(msg.word)))
        terms.push(msg.word.trim());
      if (terms.length > 1000)
        throw Error("Limite de 1.000 termos por idioma.");
      await chrome.storage.local.set({
        dictionary: { ...p.dictionary, [msg.language]: terms },
      });
      return {};
    }
    if (!["analyze", "rewrite"].includes(msg.type))
      throw Error("Operação desconhecida.");
    const p = await settings();
    if (!senderAllowed(p, sender))
      throw Error("Assistente pausado neste site.");
    if (typeof msg.text !== "string" || msg.text.length > 100000)
      throw Error("Limite de 100.000 caracteres por campo.");
    const c = await credentials();
    if (!c.ready)
      throw Error(
        "Configure URL, modelo e chave (quando necessária) para o seu provedor de IA.",
      );
    if (epochs.get(id) !== epoch)
      throw Error("Análise substituída por uma solicitação mais recente.");
    jobs.get(id)?.abort();
    const controller = new AbortController();
    jobs.set(id, controller);
    const blocks =
      msg.type === "analyze"
        ? E.chunks(msg.text).filter((block) => block.text.trim())
        : [];
    const timeoutMs =
      msg.type === "rewrite"
        ? 120000
        : Math.min(300000, 120000 + Math.max(0, blocks.length - 1) * 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      if (msg.type === "rewrite")
        return await api(
          "rewrite",
          {
            text: msg.text,
            style: msg.style,
            before: msg.before,
            after: msg.after,
          },
          p,
          c,
          controller.signal,
        );
      const all = [];
      let language = p.language === "auto" ? "pt-BR" : p.language;
      if (blocks.length) {
        const output = new Array(blocks.length);
        let index = 0;
        const workers = Array.from(
          { length: Math.min(3, blocks.length) },
          async () => {
            while (index < blocks.length) {
              if (controller.signal.aborted) throw Error("Análise cancelada.");
              const current = index++,
                block = blocks[current],
                result = await api("analyze", block, p, c, controller.signal);
              output[current] = { block, result };
            }
          },
        );
        await Promise.all(workers);
        for (const entry of output) {
          if (!entry) continue;
          const { block, result } = entry;
          language = result.language || language;
          for (const issue of result.issues) {
            const pos = E.locate(block.text, issue);
            if (pos)
              all.push({
                ...issue,
                start: block.start + pos.start,
                end: block.start + pos.end,
                language: result.language,
                source: "ai",
              });
          }
        }
      }
      const merged = E.merge(
        [...E.localIssues(msg.text), ...all],
        msg.text,
        p.dictionary,
        language,
      );
      stats.analyses++;
      stats.issues += merged.length;
      return { language, issues: merged };
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason === "timeout")
        throw Error(
          "A análise demorou demais. Tente um texto menor ou revise novamente.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      if (jobs.get(id) === controller) jobs.delete(id);
    }
  })().then(
    (result) => reply({ ok: true, ...result }),
    (error) =>
      reply({
        ok: false,
        error:
          error.name === "AbortError"
            ? "Análise interrompida. Tente novamente."
            : error.message,
      }),
  );
  return true;
});
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id != null)
      await chrome.tabs.sendMessage(tab.id, { type: "togglePanel" });
  } catch {}
});
