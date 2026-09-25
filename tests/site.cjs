const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist-site");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (!pathname.startsWith("/escrita-ia/")) {
        res.writeHead(404).end();
        return;
      }
      const file = path.resolve(
        root,
        "." +
          pathname.slice("/escrita-ia".length) +
          (pathname.endsWith("/") ? "index.html" : ""),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await fs.readFile(file);
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
        })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const errors = [],
      external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1")
        external.push(request.url());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/escrita-ia/`);
    const writing = page.locator("#writing");
    const original = await writing.inputValue();
    assert.equal(await page.locator("#highlight-text mark").count(), 2);
    await page.getByRole("button", { name: /^Repetições/ }).click();
    assert.equal(await page.locator(".suggestion").count(), 1);
    assert.equal(
      await page.locator(".suggestion").getAttribute("data-category"),
      "grammar",
    );
    await page
      .getByRole("button", { name: /Localizar: Palavra duplicada/ })
      .click();
    assert.equal(
      await writing.evaluate((el) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
      "Quero quero",
    );
    await page.getByRole("button", { name: /^Espaços/ }).click();
    assert.equal(
      await page.locator(".suggestion").getAttribute("data-category"),
      "typography",
    );
    await page
      .getByRole("button", { name: /Aplicar: Espaçamento duplicado/ })
      .click();
    assert.equal(await page.locator("#empty-state").isVisible(), true);
    assert.equal(await page.locator("#highlight-text mark").count(), 1);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await page.getByRole("button", { name: /^Todas/ }).click();
    await page.getByRole("button", { name: "Limpar texto" }).click();
    assert.equal(await writing.inputValue(), "");
    assert.equal(await page.locator("#highlight-text mark").count(), 0);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(await writing.inputValue(), original);
    await writing.fill("linha de contexto\n".repeat(60) + "teste teste");
    await page
      .getByRole("button", { name: /Localizar: Palavra duplicada/ })
      .click();
    assert(await writing.evaluate((el) => el.scrollTop > 0));
    assert.equal(
      await writing.evaluate((el) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
      "teste teste",
    );
    await page.getByRole("button", { name: "Restaurar exemplo" }).click();
    await page.reload();
    console.log(
      "PASS inline highlights, category filters, locate including long text, clear and undo",
    );
    assert.equal(await page.locator(".suggestion").count(), 2);
    assert.equal(await page.locator("#undo").isDisabled(), true);
    await page
      .getByRole("button", { name: /Aplicar: Palavra duplicada/ })
      .click();
    assert.equal(
      await writing.inputValue(),
      original.replace("Quero quero", "Quero"),
    );
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(await writing.inputValue(), original);
    await page
      .getByRole("button", { name: /Aplicar: Espaçamento duplicado/ })
      .click();
    assert.equal(await writing.inputValue(), original.replace("  ", " "));
    console.log(
      "PASS demo uses real rules, applies only on click and supports undo",
    );
    await writing.fill("Novo texto sem problemas.");
    assert.equal(await page.locator("#undo").isDisabled(), true);
    assert.equal(await page.locator(".suggestion").count(), 0);
    await writing.fill("");
    assert.match(
      await page.locator("#metrics").innerText(),
      /0 palavras · 0 caracteres/,
    );
    await writing.fill("<img src=x onerror=alert(1)> teste teste 🙂");
    assert.equal(await page.locator(".editor-shell img").count(), 0);
    await page
      .getByRole("button", { name: /Aplicar: Palavra duplicada/ })
      .click();
    assert.equal(
      await writing.inputValue(),
      "<img src=x onerror=alert(1)> teste 🙂",
    );
    await page.getByRole("button", { name: "Restaurar exemplo" }).click();
    assert.equal(await writing.inputValue(), original);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(
      await writing.inputValue(),
      "<img src=x onerror=alert(1)> teste 🙂",
    );
    console.log(
      "PASS manual edits invalidate undo; empty text, Unicode and HTML remain safe",
    );
    for (const name of ["E-mail", "Trabalho", "Redes sociais"]) {
      await writing.fill("Meu rascunho pessoal.");
      const exampleButton = page.getByRole("button", { name, exact: true });
      await exampleButton.click();
      assert.equal(await exampleButton.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator(".suggestion").count(), 2);
      assert.notEqual(await writing.inputValue(), "Meu rascunho pessoal.");
      await page.getByRole("button", { name: "Desfazer", exact: true }).click();
      assert.equal(await writing.inputValue(), "Meu rascunho pessoal.");
      assert.equal(
        await page.locator("[data-example][aria-pressed=true]").count(),
        0,
      );
    }
    await writing.fill("Texto para copiar.");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: /Copiar texto/ }).click();
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.startsWith("Texto copiado."),
    );
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "Texto para copiar.",
    );
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("denied");
      };
    });
    await page.getByRole("button", { name: /Copiar texto/ }).click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("Ctrl+C"),
    );
    assert.equal(
      await writing.evaluate((el) => el.selectionEnd - el.selectionStart),
      "Texto para copiar.".length,
    );
    await writing.fill("");
    assert.equal(await page.locator("#copy").isDisabled(), true);
    await writing.fill("Sem repetições.");
    assert.equal(await page.locator("#empty-state").isVisible(), true);
    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert.equal(
      await writing.inputValue(),
      original,
      "draft text must not persist",
    );
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({
        path: process.env.SCREENSHOT_PATH.replace(".png", "-dark.png"),
        fullPage: true,
      });
    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    await page.getByRole("button", { name: "Ativar modo foco" }).click();
    assert.equal(await page.getByRole("dialog").count(), 1);
    assert.equal(await page.locator("header").evaluate((el) => el.inert), true);
    await page.locator("#extension-link").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#focus")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .locator("#extension-link")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.locator("header").evaluate((el) => el.inert),
      false,
    );
    await page
      .getByText("A demonstração usa inteligência artificial?", { exact: true })
      .click();
    assert.equal(await page.locator("details[open]").count(), 1);
    await page
      .getByText("A demonstração usa inteligência artificial?", { exact: true })
      .click();
    console.log(
      "PASS examples preserve drafts through undo, clipboard success/fallback, theme persistence, focus trap and FAQ",
    );
    await page.getByRole("button", { name: "Restaurar exemplo" }).click();
    await writing.blur();
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await fs.mkdir(path.resolve(__dirname, "../docs/screenshots"), {
      recursive: true,
    });
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({
        path: process.env.SCREENSHOT_PATH,
        fullPage: true,
      });
    if (process.env.SCREENSHOT_PATH)
      await page.screenshot({
        path: process.env.SCREENSHOT_PATH.replace(".png", "-editor.png"),
      });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}px`,
      );
      assert(await writing.isVisible());
      if (width === 390 && process.env.SCREENSHOT_PATH)
        await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(".png", "-mobile.png"),
          fullPage: true,
        });
    }
    await page.getByRole("link", { name: /Experimente agora/ }).click();
    assert.match(page.url(), /#demo$/);
    await writing.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#undo")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Ativar modo foco" }).click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "Sair do modo foco" }).click();
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => el.classList.contains("focus-mode")),
      false,
    );
    assert.equal(
      await page
        .locator(".suggestion")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      "PASS responsive 320–1440px, keyboard navigation, project subpath, no external requests or browser errors",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
