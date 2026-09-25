const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist-site');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith('/escrita-ia/')) { res.writeHead(404).end(); return; }
      const file = path.resolve(root, '.' + pathname.slice('/escrita-ia'.length) + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('request', request => { if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/escrita-ia/`);
    const writing = page.locator('#writing');
    const original = await writing.inputValue();
    assert.equal(await page.locator('.suggestion').count(), 2);
    assert.equal(await page.locator('#undo').isDisabled(), true);
    await page.getByRole('button', { name: /Aplicar: Palavra duplicada/ }).click();
    assert.equal(await writing.inputValue(), original.replace('Quero quero', 'Quero'));
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    assert.equal(await writing.inputValue(), original);
    await page.getByRole('button', { name: /Aplicar: Espaçamento duplicado/ }).click();
    assert.equal(await writing.inputValue(), original.replace('  ', ' '));
    console.log('PASS demo uses real rules, applies only on click and supports undo');
    await writing.fill('Novo texto sem problemas.');
    assert.equal(await page.locator('#undo').isDisabled(), true);
    assert.equal(await page.locator('.suggestion').count(), 0);
    await writing.fill('');
    assert.match(await page.locator('#metrics').innerText(), /0 palavras · 0 caracteres/);
    await writing.fill('<img src=x onerror=alert(1)> teste teste 🙂');
    assert.equal(await page.locator('.editor-shell img').count(), 0);
    await page.getByRole('button', { name: /Aplicar: Palavra duplicada/ }).click();
    assert.equal(await writing.inputValue(), '<img src=x onerror=alert(1)> teste 🙂');
    await page.getByRole('button', { name: 'Restaurar exemplo' }).click();
    assert.equal(await writing.inputValue(), original);
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    assert.equal(await writing.inputValue(), '<img src=x onerror=alert(1)> teste 🙂');
    console.log('PASS manual edits invalidate undo; empty text, Unicode and HTML remain safe');
    await page.getByRole('button', { name: 'Restaurar exemplo' }).click();
    await fs.mkdir(path.resolve(__dirname, '../docs/screenshots'), { recursive: true });
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`);
      assert(await writing.isVisible());
    }
    await page.getByRole('link', { name: /Experimente agora/ }).click();
    assert.match(page.url(), /#demo$/);
    await writing.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#undo').evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS responsive 320–1440px, keyboard navigation, project subpath, no external requests or browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
