const $ = (id) => document.getElementById(id);
let tab, origin;
function line(key, value) {
  const dt = document.createElement("dt"),
    dd = document.createElement("dd");
  dt.textContent = key;
  dd.textContent = value;
  $("diagnostic").append(dt, dd);
}
async function check(reconnect = false) {
  $("diagnostic").replaceChildren();
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    origin = null;
    let permissionPattern = "";
    try {
      const u = new URL(tab?.url);
      if (["http:", "https:"].includes(u.protocol)) {
        origin = u.origin;
        permissionPattern = u.protocol + "//" + u.hostname + "/*";
      } else if (u.protocol === "file:") {
        origin = "file://";
        permissionPattern = "file:///*";
      }
    } catch {}
    $("origin").textContent = origin || "Página protegida pelo navegador";
    $("site").disabled = !origin;
    const p = await chrome.runtime.sendMessage({ type: "prefs" });
    if (!p?.ok) throw Error("Não foi possível acessar o serviço.");
    $("site").checked = p.prefs.autoSites[origin] !== false;
    document.documentElement.classList.toggle(
      "dark",
      p.prefs.theme === "dark" ||
        (p.prefs.theme === "system" &&
          matchMedia("(prefers-color-scheme: dark)").matches),
    );
    line("Versão", p.version);
    line("Serviço de fundo", "Conectado");
    line("Provedor", p.provider.url);
    line("Formato", p.provider.format);
    line("Modelo", p.provider.model || "Não configurado");
    line("Credencial", p.provider.hasCredential ? "Configurada" : "Sem chave");
    line(
      "Configuração de IA",
      p.hasKey ? "Preenchida · conexão não testada" : "Configuração incompleta",
    );
    line("Assistente geral", p.prefs.assistantEnabled ? "Ativo" : "Pausado");
    $("enabled").checked = p.prefs.assistantEnabled;
    $("analyses").textContent = p.stats?.analyses ?? 0;
    $("findings").textContent = p.stats?.issues ?? 0;
    $("applied").textContent = p.stats?.applied ?? 0;
    $("headline").textContent = !p.prefs.assistantEnabled
      ? "Uma pausa para as ideias."
      : p.hasKey
        ? "Seu assistente está ativo."
        : "Comece com a revisão local.";
    $("summary").textContent = p.hasKey
      ? "Configuração preenchida. Teste a conexão nas configurações."
      : "Conecte um provedor para revisar gramática e explorar reescritas.";
    line("Análises nesta sessão", String(p.stats?.analyses ?? 0));
    line("Ocorrências encontradas", String(p.stats?.issues ?? 0));
    line("Sugestões aplicadas", String(p.stats?.applied ?? 0));
    if (!origin) {
      line("Acesso", "Indisponível nesta página");
      return;
    }
    const permission = await chrome.permissions.contains({
      origins: [permissionPattern],
    });
    line("Permissão do site", permission ? "Concedida" : "Não concedida");
    if (reconnect)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["engine.js", "fields.js", "panel.js", "content.js"],
      });
    let result;
    try {
      result = await chrome.tabs.sendMessage(
        tab.id,
        { type: "diagnose" },
        { frameId: 0 },
      );
    } catch {}
    line("Script na página", result ? "Conectado" : "Não detectado");
    line(
      "Campo ativo",
      result?.fieldDetected ? result.adapter : "Clique em um campo de texto",
    );
    line("Estado", result?.phase || "Recarregue a página ou use Reconectar");
    $("status").textContent = result
      ? "O indicador aparece ao focar um campo compatível."
      : "Clique em Verificar e reconectar. Se persistir, recarregue a página e confira os erros em chrome://extensions.";
  } catch (e) {
    $("status").textContent = e.message;
  }
}
$("site").onchange = async () => {
  if (!origin) return;
  const { autoSites = {} } = await chrome.storage.local.get("autoSites");
  await chrome.storage.local.set({
    autoSites: { ...autoSites, [origin]: $("site").checked },
  });
  check();
};
$("retry").onclick = () => check(true);
$("settings").onclick = () => chrome.runtime.openOptionsPage();
check();

$("enabled").onchange = async () => {
  try {
    await chrome.storage.local.set({ assistantEnabled: $("enabled").checked });
    await check();
  } catch (e) {
    $("status").textContent = e.message;
  }
};
