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
  workingFormats = new Map(),
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
const dayStamp = () => new Date().toISOString().slice(0, 10);
function normalizeUsage(value) {
  const usage = {
    requests: Number(value?.requests) || 0,
    characters: Number(value?.characters) || 0,
    errors: Number(value?.errors) || 0,
    lastUsedAt: Number(value?.lastUsedAt) || 0,
    lastErrorAt: Number(value?.lastErrorAt) || 0,
    day: String(value?.day || ""),
    dayRequests: 0,
    dayCharacters: 0,
  };
  if (usage.day !== dayStamp()) {
    usage.day = dayStamp();
    usage.dayRequests = 0;
    usage.dayCharacters = 0;
  } else {
    usage.dayRequests = Number(value?.dayRequests) || 0;
    usage.dayCharacters = Number(value?.dayCharacters) || 0;
  }
  return usage;
}
function officialProvider(url) {
  try {
    return (
      new URL(url).hostname === "api.openai.com" || isGoogleProvider(url)
    );
  } catch {
    return false;
  }
}
function credentialRemaining(credential) {
  return credential.dailyLimit > 0
    ? Math.max(0, credential.dailyLimit - credential.usage.dayRequests)
    : Infinity;
}
function publicCredential(credential) {
  const {
    key,
    deltaRequests,
    deltaCharacters,
    deltaErrors,
    ...safe
  } = credential;
  return {
    ...safe,
    usage: { ...credential.usage },
    remaining:
      credential.dailyLimit > 0
        ? Math.max(0, credential.dailyLimit - credential.usage.dayRequests)
        : null,
  };
}
async function credentialKeys() {
  const a = await chrome.storage.local.get({ credentialKeys: {} }),
    b = await chrome.storage.session.get({ credentialSessionKeys: {} });
  return {
    local: a.credentialKeys || {},
    session: b.credentialSessionKeys || {},
  };
}
function buildCredentialList(stored) {
  const items = Array.isArray(stored) ? stored : [],
    list = [];
  for (const [index, item] of items.entries()) {
    let url;
    try {
      url = normalizeProviderUrl(item?.url || DEFAULT_PROVIDER_URL);
    } catch {
      continue;
    }
    const model = String(item?.model || "").trim();
    if (!model) continue;
    const id = String(item?.id || "").trim() || `credential-${index + 1}`;
    if (list.some((c) => c.id === id)) continue;
    list.push({
      id,
      label: String(item?.label || `Provedor ${index + 1}`).slice(0, 80),
      url,
      model,
      format: ["auto", "responses", "chat"].includes(item?.format)
        ? item.format
        : "auto",
      enabled: item?.enabled !== false,
      autoInclude: item?.autoInclude !== false,
      keyStorage: ["local", "session", "none"].includes(item?.keyStorage)
        ? item.keyStorage
        : "none",
      dailyLimit: Math.max(0, Number(item?.dailyLimit) || 0),
      createdAt: Number(item?.createdAt) || Date.now(),
      updatedAt: Number(item?.updatedAt) || 0,
    });
  }
  return list;
}
async function flushUsage(credential) {
  if (!credential) return;
  const requests = credential.deltaRequests || 0,
    characters = credential.deltaCharacters || 0,
    errors = credential.deltaErrors || 0;
  credential.deltaRequests = 0;
  credential.deltaCharacters = 0;
  credential.deltaErrors = 0;
  if (!requests && !characters && !errors) return;
  const p = await chrome.storage.local.get({ credentialUsage: {} }),
    map = p.credentialUsage || {},
    usage = normalizeUsage(map[credential.id]);
  usage.requests += requests;
  usage.characters += characters;
  usage.errors += errors;
  usage.dayRequests += requests;
  usage.dayCharacters += characters;
  if (requests) usage.lastUsedAt = Date.now();
  if (errors) usage.lastErrorAt = Date.now();
  await chrome.storage.local.set({
    credentialUsage: { ...map, [credential.id]: usage },
  });
}
async function credentials() {
  await secured;
  const a = await chrome.storage.local.get({
      model: "gpt-4.1-mini",
      apiKey: "",
      apiKeyProviderUrl: "",
      providerUrl: DEFAULT_PROVIDER_URL,
      providerFormat: "auto",
      credentials: [],
      credentialMode: "manual",
      activeCredentialId: "",
      credentialUsage: {},
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
  const keys = await credentialKeys(),
    usageMap = a.credentialUsage || {},
    list = buildCredentialList(a.credentials),
    current = {
      id: "current",
      label: "Provedor atual",
      url,
      model: String(a.model || "").trim(),
      format: a.providerFormat,
      enabled: true,
      autoInclude: true,
      keyStorage: b.apiKey ? "session" : a.apiKey ? "local" : "none",
      dailyLimit: 0,
      createdAt: Date.now(),
      updatedAt: 0,
      usage: normalizeUsage(usageMap.current),
    };
  list.unshift(current);
  for (const credential of list) {
    if (credential.id !== "current")
      credential.key =
        credential.keyStorage === "local"
          ? String(keys.local[credential.id] || "").trim()
          : credential.keyStorage === "session"
            ? String(keys.session[credential.id] || "").trim()
            : "";
    else credential.key = key;
    credential.usage = normalizeUsage(usageMap[credential.id]);
    credential.remaining = credentialRemaining(credential);
  }
  const mode = a.credentialMode === "auto" ? "auto" : "manual";
  let selected = null;
  const readyList = list.map((credential) => {
    const ready =
      !!credential.model &&
      credential.enabled &&
      (!officialProvider(credential.url) || !!credential.key) &&
      credential.remaining > 0;
    return { ...credential, ready };
  });
  if (mode === "auto") {
    let candidates = readyList.filter(
      (credential) =>
        credential.id !== "current" &&
        credential.ready &&
        credential.autoInclude &&
        credential.remaining > 0,
    );
    if (!candidates.length)
      candidates = readyList.filter(
        (credential) => credential.ready && credential.id === "current",
      );
    candidates.sort(
      (x, y) =>
        x.usage.dayRequests - y.usage.dayRequests ||
        x.usage.requests - y.usage.requests ||
        x.usage.lastUsedAt - y.usage.lastUsedAt,
    );
    selected =
      candidates[0] ||
      readyList.find((credential) => credential.ready) ||
      readyList[0];
  } else {
    selected =
      readyList.find((credential) => credential.id === a.activeCredentialId) ||
      readyList.find((credential) => credential.id === "current") ||
      readyList[0];
  }
  let blockedReason = "";
  if (!selected?.enabled)
    blockedReason = "Credencial pausada. Escolha outra em Configurações.";
  else if (selected.dailyLimit > 0 && selected.remaining <= 0)
    blockedReason = `Limite diário de ${selected.dailyLimit} requisições atingido para "${selected.label}".`;
  else if (!selected?.ready)
    blockedReason = officialProvider(selected.url)
      ? "Configure URL, modelo e chave para o provedor de IA."
      : "Configure URL e modelo do provedor de IA.";
  return {
    id: selected.id,
    model: selected.model,
    key: selected.key,
    url: selected.url,
    format: selected.format,
    ready: !blockedReason,
    blockedReason,
    mode,
    selectedId: selected.id,
    credentials: readyList.map(publicCredential),
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
  workingFormats.clear();
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
  const formatKey = `${credential.url}|${credential.model}|${credential.format}`;
  const unsupported = new Set([400, 404, 405, 415, 422, 501]),
    endpointMissing = new Set([404, 405, 501]),
    attempts = [],
    unavailable = new Set();
  for (const transport of transportOrder(credential.url, credential.format))
    // Preferred order: strict first, then the cheaper fallbacks. A parse
    // failure in one structure still allows trying the next ones below.
    for (const structure of ["strict", "json", "plain"])
      attempts.push({ transport, structure });
  const known = workingFormats.get(formatKey);
  if (known) {
    // Known-good format goes first; skip structures that already failed for
    // this exact provider/model/format combination to avoid wasted requests.
    attempts.sort((a, b) =>
      Number(b.transport === known.transport && b.structure === known.structure) -
      Number(a.transport === known.transport && a.structure === known.structure));
    if (known.failed?.length) {
      for (let i = attempts.length - 1; i >= 0; i--) {
        const a = attempts[i];
        if (
          a.transport === known.transport &&
          known.failed.includes(a.structure)
        )
          attempts.splice(i, 1);
      }
    }
  }
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
    if (res.ok) {
      credential.deltaRequests = (credential.deltaRequests || 0) + 1;
      credential.deltaCharacters =
        (credential.deltaCharacters || 0) + String(input?.text || "").length;
      if (credential.usage) credential.usage.lastUsedAt = Date.now();
    } else {
      credential.deltaErrors = (credential.deltaErrors || 0) + 1;
      if (credential.usage) credential.usage.lastErrorAt = Date.now();
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
        if (known?.transport === attempt.transport && known?.structure === attempt.structure)
          workingFormats.delete(formatKey);
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
      workingFormats.set(formatKey, attempt);
      if (cache.size > 50) cache.delete(cache.keys().next().value);
      return result;
    } catch (e) {
      lastError = e;
      // Remember structures that returned HTTP 200 but unparsable bodies so
      // future requests skip them and go straight to a working format.
      if (workingFormats.get(formatKey)?.transport === attempt.transport) {
        const failed = new Set(workingFormats.get(formatKey).failed || []);
        failed.add(attempt.structure);
        workingFormats.set(formatKey, { ...attempt, failed: [...failed] });
      }
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
          label: c.credentials.find((x) => x.id === c.selectedId)?.label,
          mode: c.mode,
        },
        credentials: c.credentials,
        credentialMode: c.mode,
        activeCredentialId: c.selectedId,
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
        terms = [...(p.dictionary[msg.language] || [])];
      if (!terms.some((w) => E.norm(w) === E.norm(msg.word)))
        terms.push(msg.word.trim());
      if (terms.length > 1000)
        throw Error("Limite de 1.000 termos por idioma.");
      // Invalidate cached analyses so the new term takes effect immediately.
      cache.clear();
      for (const job of jobs.values()) job.abort();
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
        c.blockedReason ||
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
      if (msg.type === "rewrite") {
        const result = await api(
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
        await flushUsage(c);
        return result;
      }
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
        [...E.allLocalIssues(msg.text, language), ...all],
        msg.text,
        p.dictionary,
        language,
      );
      stats.analyses++;
      stats.issues += merged.length;
      await flushUsage(c);
      return { language, issues: merged };
    } catch (error) {
      await flushUsage(c).catch(() => {});
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
