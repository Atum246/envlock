'use strict';

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { getTemplate, listTemplates, listCategories } = require('./templates');

class WebUI {
  constructor(vault, audit, config) {
    this._vault = vault;
    this._audit = audit;
    this._config = config;
    this._server = null;
    this._port = 0;
    this._token = null;
    this._sessions = new Map();
  }

  // ─── Start Server ───────────────────────────────────────────
  start(port = 0) {
    return new Promise((resolve, reject) => {
      // Generate a one-time access token
      this._token = crypto.randomBytes(32).toString('hex');

      this._server = http.createServer((req, res) => this._handleRequest(req, res));

      this._server.listen(port, '127.0.0.1', () => {
        this._port = this._server.address().port;
        resolve({
          url: `http://127.0.0.1:${this._port}`,
          token: this._token,
          fullUrl: `http://127.0.0.1:${this._port}/?token=${this._token}`
        });
      });

      this._server.on('error', reject);
    });
  }

  stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  // ─── Request Handler ────────────────────────────────────────
  _handleRequest(req, res) {
    const parsed = url.parse(req.url, true);
    const path = parsed.pathname;
    const query = parsed.query;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token auth for all requests
    const authToken = query.token || req.headers['x-envlock-token'];
    if (authToken !== this._token) {
      // API responses
      if (path.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      // Web UI - show token entry page
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this._renderTokenPage());
        return;
      }
    }

    // ── API Routes ──────────────────────────────────────────
    if (path === '/api/templates' && req.method === 'GET') {
      this._json(res, { categories: listCategories(), templates: listTemplates(query.category) });
      return;
    }

    if (path === '/api/template' && req.method === 'GET') {
      const template = getTemplate(query.id);
      if (!template) { this._json(res, { error: 'Not found' }, 404); return; }
      this._json(res, template);
      return;
    }

    if (path === '/api/secrets' && req.method === 'GET') {
      const slots = this._vault.listSlots();
      this._json(res, slots.map(s => ({
        ...s,
        hasValue: this._vault.hasValue(s.name)
      })));
      return;
    }

    if (path === '/api/secret' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          this._handleSetSecret(res, data);
        } catch {
          this._json(res, { error: 'Invalid JSON' }, 400);
        }
      });
      return;
    }

    if (path === '/api/secrets/bulk' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          this._handleBulkSet(res, data);
        } catch {
          this._json(res, { error: 'Invalid JSON' }, 400);
        }
      });
      return;
    }

    if (path === '/api/secret/delete' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { name } = JSON.parse(body);
          this._vault.delete(name);
          this._audit.log('webui_delete', { name });
          this._json(res, { success: true });
        } catch {
          this._json(res, { error: 'Invalid JSON' }, 400);
        }
      });
      return;
    }

    if (path === '/api/import-env' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { envContent } = JSON.parse(body);
          this._handleImportEnv(res, envContent);
        } catch {
          this._json(res, { error: 'Invalid JSON' }, 400);
        }
      });
      return;
    }

    // ── Web UI Routes ───────────────────────────────────────
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this._renderMainUI());
      return;
    }

    if (path === '/add' || path.startsWith('/add/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this._renderAddSecret(query.template));
      return;
    }

    if (path === '/bulk') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this._renderBulkAdd());
      return;
    }

    if (path === '/import') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this._renderImportEnv());
      return;
    }

    // Static fallback
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  // ─── Secret Handlers ────────────────────────────────────────
  _handleSetSecret(res, data) {
    const { name, value, description, type, template } = data;
    if (!name || !value) {
      this._json(res, { error: 'Name and value required' }, 400);
      return;
    }

    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (!this._vault.has(upperName)) {
      this._vault.createSlot({
        name: upperName,
        description: description || `${template ? template + ' - ' : ''}${upperName}`,
        type: type || 'api_key',
        scope: 'global',
        createdAt: new Date().toISOString()
      });
    }

    this._vault.set(upperName, value);
    this._audit.log('webui_set', { name: upperName, template });
    this._json(res, { success: true, name: upperName });
  }

  _handleBulkSet(res, data) {
    const { secrets, template } = data;
    if (!secrets || typeof secrets !== 'object') {
      this._json(res, { error: 'Secrets object required' }, 400);
      return;
    }

    const results = [];
    for (const [name, value] of Object.entries(secrets)) {
      if (!value) continue;
      const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

      if (!this._vault.has(upperName)) {
        this._vault.createSlot({
          name: upperName,
          description: `${template ? template + ' - ' : ''}${upperName}`,
          type: 'api_key',
          scope: 'global',
          createdAt: new Date().toISOString()
        });
      }

      this._vault.set(upperName, value);
      results.push(upperName);
    }

    this._audit.log('webui_bulk_set', { count: results.length, template });
    this._json(res, { success: true, saved: results });
  }

  _handleImportEnv(res, envContent) {
    const lines = envContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const imported = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, name, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, '').trim();
      if (!value) continue;

      const upperName = name.toUpperCase();
      if (!this._vault.has(upperName)) {
        this._vault.createSlot({
          name: upperName,
          description: `Imported from .env: ${upperName}`,
          type: 'api_key',
          scope: 'global',
          createdAt: new Date().toISOString()
        });
      }

      this._vault.set(upperName, value);
      imported.push(upperName);
    }

    this._audit.log('webui_import_env', { count: imported.length });
    this._json(res, { success: true, imported });
  }

  // ─── JSON Helper ────────────────────────────────────────────
  _json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ─── HTML Templates ─────────────────────────────────────────
  _renderTokenPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Envlock</title>
  <style>${this._baseCSS()}</style>
</head>
<body>
  <div class="container">
    <div class="logo-box">
      <pre class="logo">
       .-"""-.
      /        \\
     |  .--.  |
     | |    | |
     | | 🔒 | |
     | |    | |
     |  '--'  |
      \\      /
       '-..-'</pre>
      <h1 class="title">Envlock</h1>
      <p class="subtitle">Secure Credential Vault</p>
    </div>
    <form class="token-form" onsubmit="submitToken(event)">
      <label>Enter your access token</label>
      <input type="text" id="token" placeholder="Paste token from terminal..." autofocus>
      <button type="submit">Unlock →</button>
      <p class="hint">The token was shown in your terminal when the agent started Envlock</p>
    </form>
  </div>
  <script>
    function submitToken(e) {
      e.preventDefault();
      const token = document.getElementById('token').value.trim();
      if (token) window.location.href = '/?token=' + token;
    }
  </script>
</body>
</html>`;
  }

  _renderMainUI() {
    const categories = listCategories();
    const templates = listTemplates();
    const secrets = this._vault.listSlots();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Envlock — Dashboard</title>
  <style>${this._baseCSS()}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <h1>🔐 <span class="gradient-text">Envlock</span></h1>
        <span class="badge">${secrets.length} secret${secrets.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="header-actions">
        <a href="/bulk?token=${this._token}" class="btn btn-secondary">📋 Bulk Add</a>
        <a href="/import?token=${this._token}" class="btn btn-secondary">📥 Import .env</a>
        <a href="/add?token=${this._token}" class="btn btn-primary">+ Add Secret</a>
      </div>
    </header>

    ${secrets.length > 0 ? `
    <div class="section">
      <h2>Your Secrets</h2>
      <div class="secrets-grid">
        ${secrets.map(s => `
          <div class="secret-card">
            <div class="secret-header">
              <span class="secret-icon">${this._typeIcon(s.type)}</span>
              <span class="secret-name">${s.name}</span>
              <span class="status ${this._vault.hasValue(s.name) ? 'active' : 'empty'}">
                ${this._vault.hasValue(s.name) ? '✅' : '⬜'}
              </span>
            </div>
            <p class="secret-desc">${s.description || '-'}</p>
            <div class="secret-meta">
              <span class="tag">${s.type}</span>
              <span class="tag">${s.scope}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2>Add by Service</h2>
      ${categories.map(cat => {
        const catTemplates = templates.filter(t => t.category === cat.id);
        if (catTemplates.length === 0) return '';
        return `
          <div class="category">
            <h3>${cat.icon} ${cat.name}</h3>
            <div class="template-grid">
              ${catTemplates.map(t => `
                <a href="/add?template=${t.id}&token=${this._token}" class="template-card">
                  <span class="template-icon">${t.icon}</span>
                  <span class="template-name">${t.name}</span>
                  <span class="template-fields">${t.fieldCount} field${t.fieldCount !== 1 ? 's' : ''}</span>
                </a>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
</body>
</html>`;
  }

  _renderAddSecret(templateId) {
    const template = templateId ? getTemplate(templateId) : null;
    const allTemplates = listTemplates();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Add Secret${template ? ' — ' + template.name : ''}</title>
  <style>${this._baseCSS()}</style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/?token=${this._token}" class="back">← Back</a>
      <h1>${template ? `${template.icon} ${template.name}` : '➕ Add Secret'}</h1>
    </header>

    ${!template ? `
    <div class="section">
      <h3>Choose a service template</h3>
      <div class="template-select">
        <select id="templateSelect" onchange="switchTemplate(this.value)">
          <option value="">— Custom / Manual —</option>
          ${allTemplates.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
        </select>
      </div>
    </div>
    ` : ''}

    <form id="secretForm" onsubmit="saveSecret(event)">
      <div id="fieldsContainer">
        ${template ? template.fields.map(f => this._renderField(f, template.name)).join('') : `
        <div class="field-group">
          <label>Name</label>
          <input type="text" name="name" placeholder="MY_API_KEY" required>
        </div>
        <div class="field-group">
          <label>Value</label>
          <input type="password" name="value" placeholder="Enter the secret value" required>
          <button type="button" class="toggle-vis" onclick="toggleVis(this)">👁️</button>
        </div>
        <div class="field-group">
          <label>Description (optional)</label>
          <input type="text" name="description" placeholder="What is this key for?">
        </div>
        `}
      </div>
      <button type="submit" class="btn btn-primary btn-full">🔐 Save Securely</button>
    </form>

    <div id="result" class="result hidden"></div>
  </div>

  <script>
    function toggleVis(btn) {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁️' : '🙈';
    }

    function switchTemplate(id) {
      if (!id) {
        window.location.href = '/add?token=${this._token}';
        return;
      }
      window.location.href = '/add?template=' + id + '&token=${this._token}';
    }

    async function saveSecret(e) {
      e.preventDefault();
      const form = document.getElementById('secretForm');
      const formData = new FormData(form);
      const result = document.getElementById('result');

      ${template ? `
      // Template-based save (bulk)
      const secrets = {};
      ${template.fields.map(f => `secrets['${f.name}'] = formData.get('${f.name}');`).join('\n      ')}

      const resp = await fetch('/api/secrets/bulk?token=${this._token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets, template: '${template.name}' })
      });
      ` : `
      // Manual save (single)
      const resp = await fetch('/api/secret?token=${this._token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          value: formData.get('value'),
          description: formData.get('description')
        })
      });
      `}

      const data = await resp.json();
      if (data.success) {
        result.className = 'result success';
        result.textContent = '✅ Saved securely! Redirecting...';
        result.classList.remove('hidden');
        setTimeout(() => window.location.href = '/?token=${this._token}', 1200);
      } else {
        result.className = 'result error';
        result.textContent = '❌ ' + (data.error || 'Failed to save');
        result.classList.remove('hidden');
      }
    }
  </script>
</body>
</html>`;
  }

  _renderBulkAdd() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Bulk Add Secrets</title>
  <style>${this._baseCSS()}</style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/?token=${this._token}" class="back">← Back</a>
      <h1>📋 Bulk Add Secrets</h1>
    </header>

    <div class="section">
      <p>Add multiple secrets at once. One per line in <code>NAME=value</code> format:</p>
      <form onsubmit="saveBulk(event)">
        <div class="field-group">
          <textarea id="bulkInput" rows="12" placeholder="OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
GITHUB_TOKEN=ghp_...
DATABASE_URL=postgresql://..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">🔐 Save All</button>
      </form>
    </div>

    <div id="result" class="result hidden"></div>
  </div>

  <script>
    async function saveBulk(e) {
      e.preventDefault();
      const input = document.getElementById('bulkInput').value;
      const result = document.getElementById('result');

      const secrets = {};
      input.split('\\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const idx = line.indexOf('=');
        if (idx === -1) return;
        const name = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).replace(/^["']|["']$/g, '').trim();
        if (name && value) secrets[name] = value;
      });

      if (Object.keys(secrets).length === 0) {
        result.className = 'result error';
        result.textContent = '❌ No valid secrets found';
        result.classList.remove('hidden');
        return;
      }

      const resp = await fetch('/api/secrets/bulk?token=${this._token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets, template: 'Bulk Import' })
      });

      const data = await resp.json();
      if (data.success) {
        result.className = 'result success';
        result.textContent = '✅ Saved ' + data.saved.length + ' secrets! Redirecting...';
        result.classList.remove('hidden');
        setTimeout(() => window.location.href = '/?token=${this._token}', 1200);
      } else {
        result.className = 'result error';
        result.textContent = '❌ ' + (data.error || 'Failed');
        result.classList.remove('hidden');
      }
    }
  </script>
</body>
</html>`;
  }

  _renderImportEnv() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Import .env</title>
  <style>${this._baseCSS()}</style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/?token=${this._token}" class="back">← Back</a>
      <h1>📥 Import .env File</h1>
    </header>

    <div class="section">
      <p>Paste your <code>.env</code> file contents below:</p>
      <form onsubmit="importEnv(event)">
        <div class="field-group">
          <textarea id="envInput" rows="14" placeholder="# Paste your .env file here
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_live_..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">📥 Import</button>
      </form>
    </div>

    <div id="result" class="result hidden"></div>
  </div>

  <script>
    async function importEnv(e) {
      e.preventDefault();
      const input = document.getElementById('envInput').value;
      const result = document.getElementById('result');

      const resp = await fetch('/api/import-env?token=${this._token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envContent: input })
      });

      const data = await resp.json();
      if (data.success) {
        result.className = 'result success';
        result.textContent = '✅ Imported ' + data.imported.length + ' secrets!';
        result.classList.remove('hidden');
      } else {
        result.className = 'result error';
        result.textContent = '❌ ' + (data.error || 'Failed');
        result.classList.remove('hidden');
      }
    }
  </script>
</body>
</html>`;
  }

  // ─── Render Helpers ─────────────────────────────────────────
  _renderField(field, templateName) {
    const inputType = field.type === 'secret' ? 'password' : 'text';
    return `
    <div class="field-group">
      <label>${field.label}${field.required ? ' <span class="required">*</span>' : ''}</label>
      <div class="input-wrap">
        <input type="${inputType}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>
        ${field.type === 'secret' ? '<button type="button" class="toggle-vis" onclick="toggleVis(this)">👁️</button>' : ''}
      </div>
    </div>`;
  }

  _typeIcon(type) {
    const icons = {
      api_key: '🔑', token: '🎫', password: '🔒',
      ssh_key: '🔑', oauth: '🔓', custom: '🔧'
    };
    return icons[type] || '🔐';
  }

  // ─── CSS ────────────────────────────────────────────────────
  _baseCSS() {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      min-height: 100vh;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Logo */
    .logo-box { text-align: center; margin: 3rem 0 2rem; }
    .logo { color: #9b59b6; font-size: 0.8rem; line-height: 1.2; font-family: monospace; }
    .title {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #9b59b6, #bb86fc, #6c3483);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-top: 1rem;
    }
    .subtitle { color: #888; margin-top: 0.5rem; font-size: 1.1rem; }
    .gradient-text {
      background: linear-gradient(135deg, #9b59b6, #bb86fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Token form */
    .token-form {
      max-width: 420px;
      margin: 2rem auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .token-form label { color: #aaa; font-size: 0.9rem; }
    .token-form input {
      background: #16161e;
      border: 1px solid #2a2a3a;
      border-radius: 8px;
      padding: 0.85rem 1rem;
      color: #fff;
      font-size: 1rem;
      font-family: monospace;
    }
    .token-form input:focus { outline: none; border-color: #9b59b6; }
    .hint { color: #666; font-size: 0.8rem; text-align: center; }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #1a1a2e;
    }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .header-left h1 { font-size: 1.5rem; }
    .badge {
      background: #1a1a2e;
      color: #9b59b6;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    .header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .back { color: #9b59b6; text-decoration: none; font-size: 0.95rem; }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary { background: #9b59b6; color: #fff; }
    .btn-primary:hover { background: #8e44ad; }
    .btn-secondary { background: #1a1a2e; color: #ccc; border: 1px solid #2a2a3a; }
    .btn-secondary:hover { border-color: #9b59b6; color: #fff; }
    .btn-full { width: 100%; justify-content: center; padding: 0.85rem; font-size: 1rem; }

    /* Sections */
    .section { margin-bottom: 2rem; }
    .section h2 { font-size: 1.2rem; margin-bottom: 1rem; color: #fff; }
    .section h3 { font-size: 1rem; margin-bottom: 0.75rem; color: #bbb; }

    /* Secrets grid */
    .secrets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 0.75rem;
    }
    .secret-card {
      background: #12121a;
      border: 1px solid #1a1a2e;
      border-radius: 10px;
      padding: 1rem;
      transition: border-color 0.15s;
    }
    .secret-card:hover { border-color: #9b59b6; }
    .secret-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .secret-icon { font-size: 1.2rem; }
    .secret-name { font-weight: 700; font-size: 0.95rem; color: #fff; font-family: monospace; }
    .status { margin-left: auto; }
    .secret-desc { color: #888; font-size: 0.8rem; margin-bottom: 0.5rem; }
    .secret-meta { display: flex; gap: 0.4rem; }
    .tag {
      background: #1a1a2e;
      color: #9b59b6;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    /* Template grid */
    .category { margin-bottom: 1.5rem; }
    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.5rem;
    }
    .template-card {
      background: #12121a;
      border: 1px solid #1a1a2e;
      border-radius: 8px;
      padding: 0.75rem;
      text-decoration: none;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      transition: all 0.15s;
    }
    .template-card:hover { border-color: #9b59b6; background: #16161e; }
    .template-icon { font-size: 1.5rem; }
    .template-name { font-weight: 600; font-size: 0.9rem; }
    .template-fields { color: #666; font-size: 0.75rem; }

    /* Forms */
    .field-group { margin-bottom: 1rem; }
    .field-group label {
      display: block;
      color: #aaa;
      font-size: 0.85rem;
      margin-bottom: 0.4rem;
      font-weight: 500;
    }
    .required { color: #e74c3c; }
    .input-wrap { position: relative; }
    .input-wrap input, textarea, select {
      width: 100%;
      background: #16161e;
      border: 1px solid #2a2a3a;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #fff;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .input-wrap input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #9b59b6;
    }
    textarea { font-family: monospace; resize: vertical; }
    .toggle-vis {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      opacity: 0.5;
    }
    .toggle-vis:hover { opacity: 1; }
    .template-select select {
      background: #16161e;
      border: 1px solid #2a2a3a;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #fff;
      font-size: 0.95rem;
      width: 100%;
    }

    /* Result */
    .result {
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      font-weight: 600;
      margin-top: 1rem;
    }
    .result.success { background: #0f2f1f; color: #2ecc71; border: 1px solid #2ecc71; }
    .result.error { background: #2f0f0f; color: #e74c3c; border: 1px solid #e74c3c; }
    .hidden { display: none; }

    /* Responsive */
    @media (max-width: 600px) {
      header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; }
      .template-grid { grid-template-columns: 1fr 1fr; }
    }
    `;
  }
}

module.exports = { WebUI };
