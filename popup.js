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
    if ($("picky-toggle")) $("picky-toggle").checked = !!p.prefs.picky;
    if ($("reset-badge")) $("reset-badge").disabled = !p.prefs.badgePosition;
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
    const activeCredential = p.credentials?.find(
      (credential) => credential.id === p.activeCredentialId,
    );
    line(
      "Credencial",
      activeCredential?.hasKey ?? p.provider.hasCredential
        ? "Configurada"
        : "Sem chave",
    );
    line(
      "Configuração de IA",
      p.blockedReason
        ? p.blockedReason
        : p.hasKey
          ? "Preenchida · conexão não testada"
          : "Configuração incompleta",
    );
    line("Assistente geral", p.prefs.assistantEnabled ? "Ativo" : "Pausado");
    if (p.credentialMode)
      line(
        "Escolha da chave",
        p.credentialMode === "auto"
          ? "Automática · melhor chave menos usada"
          : "Manual",
      );
    if (activeCredential) {
      line("Chave ativa", activeCredential.label);
      line(
        "Limite diário",
        activeCredential.dailyLimit
          ? `${activeCredential.usage.dayRequests}/${activeCredential.dailyLimit} requisições · ${activeCredential.remaining} restantes`
          : "Sem limite diário",
      );
      line(
        "Uso hoje",
        `${activeCredential.usage.dayRequests} requisições · ${activeCredential.usage.dayCharacters} caracteres`,
      );
      line(
        "Uso total",
        `${activeCredential.usage.requests} requisições · ${activeCredential.usage.characters} caracteres · ${activeCredential.usage.errors} erros`,
      );
    }
    const savedCredentials = p.credentials?.filter(
      (credential) => credential.id !== "current",
    );
    if (savedCredentials?.length)
      line(
        "Chaves salvas",
        `${savedCredentials.length} · ${savedCredentials.filter((credential) => credential.autoInclude).length} na rotação automática`,
      );
    $("enabled").checked = p.prefs.assistantEnabled;
    $("analyses").textContent = p.stats?.analyses ?? 0;
    $("findings").textContent = p.stats?.issues ?? 0;
    $("applied").textContent = p.stats?.applied ?? 0;
    $("headline").textContent = !p.prefs.assistantEnabled
      ? "Uma pausa para as ideias."
      : p.hasKey
        ? "Seu assistente está ativo."
        : "Comece com a revisão local.";
    $("summary").textContent = p.blockedReason
      ? p.blockedReason
      : p.hasKey
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
if ($("picky-toggle")) {
  $("picky-toggle").onchange = async () => {
    try {
      await chrome.storage.local.set({ picky: $("picky-toggle").checked });
      await check();
    } catch (e) {
      $("status").textContent = e.message;
    }
  };
}
if ($("open-panel")) {
  $("open-panel").onclick = async () => {
    try {
      if (tab?.id != null) {
        const result = await chrome.tabs.sendMessage(tab.id, { type: "togglePanel" });
        if (result?.opened) {
          $("status").textContent = "Painel aberto no campo ativo da página.";
        } else if (result && !result.enabled) {
          $("status").textContent = "Ative o assistente antes de abrir o painel.";
        } else {
          $("status").textContent = "Foque um campo de texto na página primeiro.";
        }
      }
    } catch {
      $("status").textContent = "Foque um campo de texto na página primeiro.";
    }
  };
}
if ($("reset-badge")) {
  $("reset-badge").onclick = async () => {
    try {
      await chrome.storage.local.set({ badgePosition: null });
      $("status").textContent = "Posição do botão flutuante restaurada.";
      await check();
    } catch (e) {
      $("status").textContent = e.message;
    }
  };
}
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
