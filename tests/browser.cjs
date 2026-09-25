const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const path = require("node:path"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const extension = path.resolve(
  process.env.EXTENSION_PATH || path.join(__dirname, ".."),
);
const profile = process.env.TEST_PROFILE || path.resolve("work/chrome-v2-test");
(async () => {
  const context = await chromium.launchPersistentContext(profile, {
    executablePath:
      process.env.CHROME_PATH ||
      (process.platform === "win32"
        ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
        : chromium.executablePath()),
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging"],
    viewport: { width: 1280, height: 900 },
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", {
      path: extension,
    });
    const worker =
      context
        .serviceWorkers()
        .find((w) => w.url().startsWith("chrome-extension://" + id)) ||
      (await context.waitForEvent("serviceworker"));
    console.log("PASS actual Chrome extension loaded", id);
    await worker.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.session.clear();
    });
    const fixture = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="require-trusted-types-for 'script'"><title>Escrita IA · Teste de integração</title><style>body{font:16px system-ui;background:#f4f3fb;color:#25213e;padding:50px}main{width:630px}h1{font-size:32px}textarea,input,[contenteditable]{display:block;width:570px;min-height:95px;margin:22px 0;padding:18px;font:18px/1.6 system-ui;border:1px solid #bcb5d5;border-radius:12px;background:#fff}input{min-height:40px}.label{color:#776b93}</style></head><body><main><p class="label">UM ASSISTENTE QUE RESPEITA SUA VOZ</p><h1>Escreva. Revise. Faça sentido.</h1><textarea id="plain" autofocus placeholder="Digite sua mensagem"></textarea><div id="prompt-textarea" class="ProseMirror" contenteditable="true"><p><b>Olá</b> voce</p></div><input id="password" type="password"><div id="dynamic"></div></main></body></html>`;
    await context.route("http://fixture.test/**", (r) =>
      r.fulfill({ contentType: "text/html", body: fixture }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://fixture.test/");
    const badge = page.locator("[data-escrita-root] .badge");
    const open = async () => {
      if (!(await page.locator(".panel").isVisible())) await badge.click();
    };
    await badge.waitFor({ state: "visible" });
    console.log("PASS autofocus indicator without key under Trusted Types CSP");
    await page.locator("#plain").fill("Olá  voce");
    await delay(1200);
    await open();
    await page
      .locator(".panel .status")
      .filter({ hasText: "Configure" })
      .waitFor();
    assert.equal(await page.locator("#plain").inputValue(), "Olá  voce");
    assert((await page.locator(".mark").count()) > 0);
    console.log("PASS no-key state and local grifos without replacing text");
    await page.getByRole("button", { name: "Fechar revisão" }).click();
    await page.locator(".mark").first().hover();
    assert(await page.locator(".panel").isHidden());
    await badge.click();
    await page.getByRole("button", { name: "Fixar painel" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Soltar painel" })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert(await page.locator(".panel").isHidden());
    await badge.click();
    await page.getByRole("button", { name: "Soltar painel" }).click();
    await page.locator("#plain").fill("quero quero  falar");
    await delay(800);
    await open();
    await page
      .getByRole("button", { name: "Aplicar correções locais", exact: true })
      .click();
    assert.equal(await page.locator("#plain").inputValue(), "quero falar");
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(
      await page.locator("#plain").inputValue(),
      "quero quero  falar",
    );
    await page.locator("#plain").fill("outro texto");
    assert(
      await page
        .getByRole("button", { name: "Desfazer", exact: true })
        .isHidden(),
    );
    console.log(
      "PASS no hover intrusion, pin, Escape, local batch and safe undo after manual edits",
    );
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        apiKey: "sk-fake-test",
        language: "pt-BR",
        picky: false,
        theme: "light",
      });
      globalThis.testState = { calls: 0, delay: 10, error: 0 };
      globalThis.fetch = async (url, options) => {
        testState.calls++;
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, testState.delay);
          options.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (testState.error)
          return new Response("{}", { status: testState.error });
        const b = JSON.parse(options.body),
          input = JSON.parse(b.input),
          text = input.text;
        let payload;
        if (b.text.format.name === "writing_rewrite")
          payload = {
            alternatives: [
              "Gostaria de conversar com você.",
              "Podemos conversar?",
              "Vamos conversar quando puder.",
            ],
          };
        else {
          const issues = [];
          for (const m of text.matchAll(/voce/g)) {
            const i = m.index;
            issues.push({
              category: "spelling",
              rule: "Acentuação",
              quote: "voce",
              left: text.slice(Math.max(0, i - 30), i),
              right: text.slice(i + 4, i + 34),
              explanation:
                "O pronome você recebe acento circunflexo na última sílaba.",
              replacements: ["você"],
            });
          }
          for (const m of text.matchAll(/Nós vai/g)) {
            const i = m.index;
            issues.push({
              category: "grammar",
              rule: "Concordância verbal",
              quote: "Nós vai",
              left: text.slice(Math.max(0, i - 30), i),
              right: text.slice(i + 7, i + 37),
              explanation: "O verbo concorda com nós: vamos.",
              replacements: ["Nós vamos"],
            });
          }
          payload = { language: "pt-BR", issues };
        }
        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  { type: "output_text", text: JSON.stringify(payload) },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      };
    });
    const ready = () =>
      page.waitForFunction(
        () =>
          document
            .querySelector("[data-escrita-root]")
            ?.shadowRoot.querySelector(".badge")?.dataset.state === "complete",
      );
    await page.locator("#plain").fill("Nós vai conversar com voce.");
    await ready();
    assert.equal(
      await page.locator("#plain").inputValue(),
      "Nós vai conversar com voce.",
    );
    await open();
    await page.locator(".issue").filter({ hasText: "voce" }).click();
    await page.locator("[data-apply]").click();
    assert.equal(
      await page.locator("#plain").inputValue(),
      "Nós vai conversar com você.",
    );
    console.log(
      "PASS structured analysis, anchored spelling correction by click",
    );
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(
      await page.locator("#plain").inputValue(),
      "Nós vai conversar com voce.",
    );
    console.log("PASS undo");
    await ready();
    await page.locator(".issue").filter({ hasText: "voce" }).click();
    await page.getByRole("button", { name: "Adicionar ao dicionário" }).click();
    await page
      .locator(".issue")
      .filter({ hasText: "voce" })
      .waitFor({ state: "detached" });
    assert.equal(
      await page.locator(".issue").filter({ hasText: "voce" }).count(),
      0,
    );
    console.log("PASS dictionary filters spelling");
    await worker.evaluate(() => chrome.storage.local.set({ dictionary: {} }));
    await page.locator("#prompt-textarea").click();
    await ready();
    await open();
    await page.locator(".issue").filter({ hasText: "voce" }).click();
    await page.locator("[data-apply]").click();
    assert.equal(
      await page.locator("#prompt-textarea").innerText(),
      "Olá você",
    );
    assert.equal(await page.locator("#prompt-textarea b").innerText(), "Olá");
    console.log("PASS contenteditable patch preserves untouched bold text");
    await page.locator("#plain").fill("Vamos conversar hoje.");
    await page.locator("#plain").evaluate((el) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await delay(100);
    await open();
    await page.getByRole("tab", { name: "Reescrita" }).click();
    await page.getByRole("button", { name: "Gerar alternativas" }).click();
    await page
      .getByRole("button", { name: "Podemos conversar?", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Gerar alternativas" }).click();
    await page
      .getByRole("button", { name: "Podemos conversar?", exact: true })
      .waitFor();
    assert.equal(await page.locator("[data-alternative]").count(), 3);
    await page
      .getByRole("button", { name: "Podemos conversar?", exact: true })
      .click();
    assert.equal(
      await page.locator("#plain").inputValue(),
      "Podemos conversar?",
    );
    console.log("PASS selected text rewrite");
    await worker.evaluate(() => {
      testState.delay = 1600;
    });
    await page.locator("#plain").fill("voce antigo");
    await delay(1200);
    await page.locator("#plain").fill("voce novo");
    await ready();
    assert.equal(await page.locator("#plain").inputValue(), "voce novo");
    console.log("PASS stale requests canceled, no implicit replacement");
    await worker.evaluate(() => {
      testState.delay = 10;
    });
    await page.locator("#password").fill("voce");
    assert(await badge.isHidden());
    console.log("PASS password exclusion");
    await page.evaluate(() => {
      const field = document.createElement("textarea");
      field.id = "new";
      document.querySelector("#dynamic").append(field);
      field.focus();
    });
    await page.locator("#new").fill("voce dinamico");
    await ready();
    console.log("PASS dynamic focused field");
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.id = "inherited";
      frame.src = "about:blank";
      frame.onload = () => {
        const field = frame.contentDocument.createElement("textarea");
        field.id = "nested";
        frame.contentDocument.body.append(field);
        field.focus();
      };
      document.body.append(frame);
    });
    const nested = page.frameLocator("#inherited");
    await nested.locator("#nested").fill("voce no frame");
    await nested
      .locator("[data-escrita-root] .badge")
      .waitFor({ state: "visible" });
    console.log("PASS inherited about:blank frame");
    await worker.evaluate(() => {
      testState.error = 429;
    });
    await page.locator("#new").fill("voce limite");
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-escrita-root]")
          .shadowRoot.querySelector(".badge").dataset.state === "error",
    );
    await open();
    assert.match(await page.locator(".panel .status").innerText(), /Limite/);
    console.log("PASS API failure not shown as success");
    await worker.evaluate(() => {
      testState.error = 0;
      return chrome.storage.local.set({ assistantEnabled: false });
    });
    await badge.waitFor({ state: "hidden" });
    console.log("PASS global pause");
    await worker.evaluate(() =>
      chrome.storage.local.set({ assistantEnabled: true }),
    );
    await page.locator("#plain").fill("Nós vai revisar este texto com voce.");
    await ready();
    await open();
    await page.locator(".issue").filter({ hasText: "voce" }).click();
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({ path: process.env.SCREENSHOT_PATH });
    const options = await context.newPage();
    await options.goto("chrome-extension://" + id + "/options.html");
    assert.equal(await options.locator("#language option").count(), 37);
    assert.equal(await options.locator("#providerFormat option").count(), 3);
    assert.equal(
      await options.locator("#providerUrl").inputValue(),
      "https://api.openai.com/v1",
    );
    await options.locator("#test").click();
    await options
      .locator("#status")
      .filter({ hasText: "Conexão confirmada" })
      .waitFor();
    console.log(
      "PASS settings page, provider fields, connection test and all locale options",
    );
    await options.locator("#key").fill("test-visible-key");
    await options.locator("#show-key").click();
    assert.equal(await options.locator("#key").getAttribute("type"), "text");
    await options.locator("#show-key").click();
    await options.locator("#key").fill("");
    await options.locator("#preset-local").click();
    assert.equal(
      await options.locator("#providerUrl").inputValue(),
      "http://localhost:11434/v1",
    );
    assert.equal(await options.locator("#model").inputValue(), "");
    await options.locator("#preset-openai").click();
    assert.equal(
      await options.locator("#providerUrl").inputValue(),
      "https://api.openai.com/v1",
    );
    if (process.env.SCREENSHOT_PATH)
      await options.screenshot({
        path: path.join(
          path.dirname(process.env.SCREENSHOT_PATH),
          "extension-settings.png",
        ),
        fullPage: true,
      });
    console.log("PASS provider presets and explicit key visibility");
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.locator("summary").click();
    await popup.locator("#diagnostic").waitFor();
    assert(await popup.locator("body").innerText());
    assert.match(
      await popup.locator("#diagnostic").innerText(),
      /conexão não testada/,
    );
    await popup.locator("#enabled").uncheck();
    await badge.waitFor({ state: "hidden" });
    await popup.locator("#enabled").check();
    await badge.waitFor({ state: "visible" });
    await popup.locator("summary").click();
    await popup.setViewportSize({ width: 380, height: 830 });
    if (process.env.SCREENSHOT_PATH)
      await popup.screenshot({
        path: path.join(
          path.dirname(process.env.SCREENSHOT_PATH),
          "extension-popup.png",
        ),
        fullPage: true,
      });
    await popup.close();
    console.log("PASS diagnostic popup renders");
    await worker.evaluate(() => chrome.storage.local.set({ theme: "dark" }));
    await page
      .locator("[data-escrita-root] .ui.dark")
      .waitFor({ state: "attached" });
    await worker.evaluate(() => chrome.storage.local.set({ theme: "light" }));
    console.log("PASS theme preference broadcasts");
    await page.locator("#plain").fill("🙂 voce e voce com a\u0301cento.");
    await ready();
    assert.equal(
      await page.locator(".issue").filter({ hasText: "Acentuação" }).count(),
      2,
    );
    console.log("PASS repeated snippets with emoji are separately anchored");
    await page.evaluate(() => (document.body.style.zoom = "1.25"));
    await page.locator("#plain").focus();
    await delay(150);
    assert((await page.locator(".mark").count()) > 0);
    await page.evaluate(() => (document.body.style.zoom = "1"));
    console.log("PASS overlay after zoom");
    await page.locator("#plain").evaluate((el) => (el.style.width = "180px"));
    await page
      .locator("#plain")
      .fill("Palavras em várias linhas para conversar com voce");
    await ready();
    const expected = await page.locator("#plain").evaluate((el) => {
      const cs = getComputedStyle(el),
        ref = document.createElement("div");
      for (const key of [
        "font",
        "lineHeight",
        "letterSpacing",
        "padding",
        "border",
        "boxSizing",
        "width",
      ])
        ref.style[key] = cs[key];
      Object.assign(ref.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      });
      const text = document.createTextNode(el.value);
      ref.append(text);
      document.body.append(ref);
      const range = document.createRange();
      range.setStart(text, el.value.indexOf("voce"));
      range.setEnd(text, el.value.indexOf("voce") + 4);
      const a = range.getBoundingClientRect(),
        b = ref.getBoundingClientRect(),
        c = el.getBoundingClientRect();
      const result = {
        left: c.left + a.left - b.left - el.scrollLeft,
        top: c.top + a.bottom - b.top - el.scrollTop - 2,
      };
      ref.remove();
      return result;
    });
    const actual = await page.locator(".mark").last().boundingBox();
    assert(Math.abs(actual.x - expected.left) < 2);
    assert(Math.abs(actual.y - expected.top) < 2);
    await page.locator("#plain").evaluate((el) => (el.style.width = ""));
    console.log("PASS wrapped textarea grifos match text positions");
    for (const [host, selector, markup] of [
      [
        "chatgpt.com",
        "#prompt-textarea",
        '<div id="prompt-textarea" class="ProseMirror" contenteditable="true"></div>',
      ],
      [
        "www.instagram.com",
        "[role=textbox]",
        '<div role="textbox" contenteditable="true"></div>',
      ],
      [
        "www.facebook.com",
        "[data-lexical-editor]",
        '<div data-lexical-editor="true" role="textbox" contenteditable="true"></div>',
      ],
      [
        "www.linkedin.com",
        ".ql-editor",
        '<div class="ql-editor" contenteditable="true"></div>',
      ],
      [
        "x.com",
        "[data-testid=tweetTextarea_0]",
        '<div data-testid="tweetTextarea_0" class="public-DraftEditor-content" contenteditable="true"></div>',
      ],
    ]) {
      await context.route("https://" + host + "/**", (r) =>
        r.fulfill({
          contentType: "text/html",
          body:
            '<!doctype html><meta charset="utf-8"><style>[contenteditable]{margin:50px;padding:15px;border:1px solid #aaa;width:500px;min-height:80px}</style>' +
            markup,
        }),
      );
      const fp = await context.newPage();
      await fp.goto("https://" + host + "/");
      await fp.locator(selector).fill("voce");
      await fp.waitForFunction(
        () =>
          document
            .querySelector("[data-escrita-root]")
            ?.shadowRoot.querySelector(".badge")?.dataset.state === "complete",
      );
      assert.equal(await fp.locator(selector).innerText(), "voce");
      assert((await fp.locator(".mark").count()) > 0);
      await fp.close();
      console.log("PASS synthetic adapter fixture", host);
      await context.unroute("https://" + host + "/**");
    }
    await page.bringToFront();
    await page.locator("#plain").fill("Nós vai revisar este texto com voce.");
    await ready();
    await open();
    await page.locator(".issue").filter({ hasText: "voce" }).click();
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({ path: process.env.SCREENSHOT_PATH });
    await page.getByRole("tab", { name: "Reescrita" }).click();
    await page.getByRole("button", { name: "Usar campo inteiro" }).click();
    await page.getByRole("button", { name: "Gerar alternativas" }).click();
    await page
      .getByRole("button", { name: "Podemos conversar?", exact: true })
      .waitFor();
    assert.equal(await page.locator("[data-alternative]").count(), 3);
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({
        path: path.join(
          path.dirname(process.env.SCREENSHOT_PATH),
          "extension-rewrite.png",
        ),
      });
    await page.getByRole("tab", { name: "Revisão", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.locator(".panel").boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 391);
    console.log("PASS full-field rewrite and mobile panel bounds");
    await options.close();
    assert.deepEqual(errors, []);
    console.log("PASS no page JavaScript errors");
    if (process.env.LIVE_SITES === "1")
      for (const url of [
        "https://chatgpt.com/",
        "https://www.instagram.com/",
        "https://www.facebook.com/",
        "https://www.linkedin.com/",
        "https://x.com/",
      ]) {
        const p = await context.newPage();
        try {
          await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          const fields = await p
            .locator("textarea,input[type=text],[contenteditable=true]")
            .count();
          console.log(
            "LIVE",
            url,
            "title:",
            await p.title(),
            "candidate fields:",
            fields,
          );
          if (url.includes("chatgpt") && fields) {
            const f = p.locator("textarea,[contenteditable=true]").first();
            if (await f.isVisible()) {
              await f.fill("Mensagem de teste com voce.");
              await delay(1800);
              console.log(
                "LIVE ChatGPT badge:",
                await p.locator("[data-escrita-root] .badge").isVisible(),
              );
              await f.fill("");
            }
          }
        } catch (e) {
          console.log("LIVE BLOCKED", url, e.message.split("\n")[0]);
        } finally {
          await p.close();
        }
      }
  } finally {
    await context.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
