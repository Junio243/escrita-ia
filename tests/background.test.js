import { test } from "node:test";
import assert from "node:assert/strict";
let listener,
  installed,
  commandListener,
  httpStatus = 200,
  latency = 0,
  inFlight = 0,
  maxInFlight = 0,
  malformed = false,
  responsesUnsupported = false,
  chatUnsupported = false,
  lastRequest,
  calls = 0;
const sentMessages = [];
const local = {
    apiKey: "sk-test",
    model: "test",
    providerUrl: "https://api.openai.com/v1",
    providerFormat: "auto",
    language: "pt-BR",
    dictionary: {},
  },
  session = {};
function get(store, arg) {
  if (typeof arg === "string") return { [arg]: store[arg] };
  if (Array.isArray(arg))
    return Object.fromEntries(arg.map((k) => [k, store[k]]));
  return { ...arg, ...store };
}
globalThis.chrome = {
  runtime: {
    id: "test",
    getURL: (path) => "chrome-extension://test/" + path,
    getManifest: () => ({ version: "2.2.0" }),
    onInstalled: {
      addListener(fn) {
        installed = fn;
      },
    },
    onMessage: {
      addListener(fn) {
        listener = fn;
      },
    },
    async openOptionsPage() {},
  },
  commands: {
    onCommand: {
      addListener(fn) {
        commandListener = fn;
      },
    },
  },
  storage: {
    local: {
      async setAccessLevel() {},
      async get(a) {
        return get(local, a);
      },
      async set(p) {
        Object.assign(local, p);
      },
    },
    session: {
      async get(a) {
        return get(session, a);
      },
    },
    onChanged: { addListener() {} },
  },
  scripting: {
    async getRegisteredContentScripts() {
      return [];
    },
  },
  tabs: {
    async query() {
      return [];
    },
    async sendMessage(id, msg) {
      sentMessages.push({ id, msg });
    },
  },
};
globalThis.fetch = async (url, options) => {
  calls++;
  lastRequest = { url, options };
  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, latency);
      options.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        },
        { once: true },
      );
    });
    if (responsesUnsupported && url.endsWith("/responses"))
      return new Response("{}", { status: 404 });
    if (chatUnsupported && url.endsWith("/chat/completions"))
      return new Response("{}", { status: 404 });
    if (httpStatus !== 200) return new Response("{}", { status: httpStatus });
    const text = malformed
      ? "invalid"
      : JSON.stringify({ language: "pt-BR", issues: [] });
    return new Response(
      JSON.stringify(
        url.endsWith("/chat/completions")
          ? { choices: [{ message: { content: text } }] }
          : {
              status: "completed",
              output: [
                { type: "message", content: [{ type: "output_text", text }] },
              ],
            },
      ),
    );
  } finally {
    inFlight--;
  }
};
await import("../background.js");
const sender = {
  id: "test",
  tab: { id: 7, url: "https://example.test/" },
  url: "https://example.test/",
  frameId: 0,
};
const send = (msg, s = sender) =>
  new Promise((resolve) => listener(msg, s, resolve));
test("migration preserves credentials and disables automatic replacement", async () => {
  local.autoApply = true;
  local.schemaVersion = 1;
  installed();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(local.autoApply, false);
  assert.equal(local.schemaVersion, 3);
  assert.equal(local.apiKey, "sk-test");
});
test("preferences expose no credential and missing key causes no request", async () => {
  const p = await send({ type: "prefs" });
  assert.equal(p.hasKey, true);
  assert.equal(p.prefs.badgePosition, null);
  assert(!JSON.stringify(p).includes("sk-test"));
  delete local.apiKey;
  const n = calls;
  assert.equal((await send({ type: "analyze", text: "Teste" })).ok, false);
  assert.equal(calls, n);
  local.apiKey = "sk-test";
});
test("preferences include saved badge position", async () => {
  local.badgePosition = { x: 120, y: 180 };
  const p = await send({ type: "prefs" });
  assert.deepEqual(p.prefs.badgePosition, { x: 120, y: 180 });
  delete local.badgePosition;
});
test("site pause enforced for both top document and frame", async () => {
  local.autoSites = { "https://example.test": false };
  const n = calls;
  assert.equal((await send({ type: "analyze", text: "Teste" })).ok, false);
  assert.equal(
    (
      await send(
        { type: "analyze", text: "Teste" },
        { ...sender, url: "https://frame.test/" },
      )
    ).ok,
    false,
  );
  assert.equal(calls, n);
  local.autoSites = {};
});
test("options page and inherited frames may test and analyze", async () => {
  const extension = {
    id: "test",
    tab: { id: 9, url: "chrome-extension://test/options.html" },
    url: "chrome-extension://test/options.html",
    frameId: 0,
  };
  assert.equal(
    (await send({ type: "analyze", text: "Teste pelas opções." }, extension))
      .ok,
    true,
  );
  const inherited = { ...sender, url: "about:blank", frameId: 2 };
  assert.equal(
    (
      await send(
        { type: "analyze", text: "Teste no frame herdado." },
        inherited,
      )
    ).ok,
    true,
  );
});
test("AI analysis combines Portuguese-only deterministic checks", async () => {
  local.language = "pt-BR";
  const result = await send({ type: "analyze", text: "Nós vai amanhã." });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].rule, "Concordância verbal");
  assert.deepEqual(result.issues[0].replacements, ["Nós vamos"]);
});
test("cache reuses identical blocks and reparses changes", async () => {
  const n = calls;
  assert.equal(
    (await send({ type: "analyze", text: "Texto para cache." })).ok,
    true,
  );
  assert.equal(
    (await send({ type: "analyze", text: "Texto para cache." })).ok,
    true,
  );
  assert.equal(calls, n + 1);
  await send({ type: "analyze", text: "Texto para cache novo." });
  assert.equal(calls, n + 2);
});
test("latest request wins and failures remain failures", async () => {
  latency = 30;
  const first = send({ type: "analyze", text: "Primeira revisão." });
  await new Promise((r) => setTimeout(r, 5));
  const second = send({ type: "analyze", text: "Segunda revisão." });
  assert.equal((await first).ok, false);
  assert.equal((await second).ok, true);
  latency = 0;
  httpStatus = 429;
  assert.match(
    (await send({ type: "analyze", text: "Texto com limite." })).error,
    /Limite/,
  );
  httpStatus = 401;
  assert.match(
    (await send({ type: "analyze", text: "Texto sem autenticação." })).error,
    /Chave/,
  );
  httpStatus = 200;
  malformed = true;
  assert.equal(
    (await send({ type: "analyze", text: "Resposta malformada." })).ok,
    false,
  );
  malformed = false;
});
test("long analyses process chunks concurrently", async () => {
  latency = 40;
  maxInFlight = 0;
  const text = ("Texto longo para revisão paralela. ".repeat(280) + "\n").repeat(
    3,
  );
  assert.equal((await send({ type: "analyze", text })).ok, true);
  assert(maxInFlight > 1);
  latency = 0;
});
test("keyboard shortcut toggles the panel in the active tab", async () => {
  globalThis.chrome.tabs.query = async () => [{ id: 7 }];
  await commandListener("toggle-panel");
  assert.deepEqual(sentMessages.at(-1), {
    id: 7,
    msg: { type: "togglePanel" },
  });
  const n = sentMessages.length;
  await commandListener("other-command");
  assert.equal(sentMessages.length, n);
  globalThis.chrome.tabs.query = async () => [];
});
test("session stats track analyses, findings and applied suggestions", async () => {
  const before = (await send({ type: "prefs" })).stats;
  assert.equal(
    (await send({ type: "analyze", text: "Texto com  erro." })).ok,
    true,
  );
  assert.equal((await send({ type: "applied" })).ok, true);
  const after = (await send({ type: "prefs" })).stats;
  assert.equal(after.analyses, before.analyses + 1);
  assert(after.issues >= before.issues + 1);
  assert.equal(after.applied, before.applied + 1);
});
test("custom Chat Completions provider accepts arbitrary key formats and keyless local-style configuration", async () => {
  local.providerUrl = "https://provider.example/v1";
  local.providerFormat = "chat";
  local.apiKey = "token-not-sk";
  local.apiKeyProviderUrl = local.providerUrl;
  assert.equal(
    (await send({ type: "analyze", text: "Texto no provedor customizado." }))
      .ok,
    true,
  );
  assert.equal(lastRequest.url, "https://provider.example/v1/chat/completions");
  assert.equal(
    lastRequest.options.headers.Authorization,
    "Bearer token-not-sk",
  );
  assert(JSON.parse(lastRequest.options.body).messages);
  delete local.apiKey;
  delete local.apiKeyProviderUrl;
  assert.equal(
    (await send({ type: "analyze", text: "Servidor sem chave." })).ok,
    true,
  );
  assert.equal(lastRequest.options.headers.Authorization, undefined);
  local.providerUrl = "https://api.openai.com/v1";
  local.providerFormat = "auto";
  local.apiKey = "sk-test";
});
test("credential is only sent to the provider URL it belongs to", async () => {
  local.providerUrl = "https://other.example/v1";
  local.providerFormat = "chat";
  local.apiKey = "sk-openai-legacy";
  delete local.apiKeyProviderUrl;
  assert.equal(
    (await send({ type: "analyze", text: "Não vaze a chave antiga." })).ok,
    true,
  );
  assert.equal(lastRequest.options.headers.Authorization, undefined);
  local.providerUrl = "https://api.openai.com/v1";
  local.providerFormat = "auto";
  local.apiKey = "sk-test";
});
test("automatic mode prefers Chat Completions externally and falls back to Responses", async () => {
  local.providerUrl = "https://fallback.example/v1";
  local.providerFormat = "auto";
  delete local.apiKey;
  chatUnsupported = true;
  const n = calls;
  assert.equal(
    (await send({ type: "analyze", text: "Fallback automático." })).ok,
    true,
  );
  assert.equal(calls, n + 2);
  assert(lastRequest.url.endsWith("/responses"));
  const learned = calls;
  assert.equal(
    (await send({ type: "analyze", text: "Outro trecho para revisar." })).ok,
    true,
  );
  assert.equal(calls, learned + 1);
  assert(lastRequest.url.endsWith("/responses"));
  chatUnsupported = false;
  local.providerUrl = "https://api.openai.com/v1";
  local.apiKey = "sk-test";
});

test("Google routes legacy Responses settings to chat and preserves model errors", async () => {
  const backup = { ...local };
  try {
    Object.assign(local, {
      providerUrl: "https://generativelanguage.googleapis.com/v1beta",
      providerFormat: "responses",
      apiKey: "google-test-key",
      apiKeyProviderUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-test",
    });
    const n = calls;
    assert.equal(
      (await send({ type: "analyze", text: "Teste Gemini compatível." })).ok,
      true,
    );
    assert.equal(calls, n + 1);
    assert.equal(
      lastRequest.url,
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    assert.equal(
      lastRequest.options.headers.Authorization,
      "Bearer google-test-key",
    );
    assert.equal(JSON.parse(lastRequest.options.body).model, "gemini-test");
    httpStatus = 404;
    const before = calls;
    assert.match(
      (await send({ type: "analyze", text: "Modelo Gemini inexistente." }))
        .error,
      /Modelo do Gemini/,
    );
    assert.equal(calls, before + 1);
    httpStatus = 400;
    const start = calls;
    assert.match(
      (await send({ type: "analyze", text: "Esquema não aceito." })).error,
      /HTTP 400/,
    );
    assert.equal(calls, start + 3);
    assert(!lastRequest.url.includes("/responses"));
    httpStatus = 200;
    delete local.apiKey;
    const missing = calls;
    assert.equal((await send({ type: "prefs" })).hasKey, false);
    assert.equal(
      (await send({ type: "analyze", text: "Sem chave Gemini." })).ok,
      false,
    );
    assert.equal(calls, missing);
    local.apiKey = "private-openai-key";
    local.apiKeyProviderUrl = "https://api.openai.com/v1";
    assert.equal((await send({ type: "prefs" })).hasKey, false);
  } finally {
    httpStatus = 200;
    for (const key of Object.keys(local)) delete local[key];
    Object.assign(local, backup);
  }
});
