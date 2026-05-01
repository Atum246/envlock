'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HISTORY_DIR = path.join(os.homedir(), '.envlock', 'history');

class History {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true, mode: 0o700 });
    }
  }

  // ─── Record a Change ────────────────────────────────────────
  record(name, oldValue, newValue) {
    this._ensureDir();
    const filepath = path.join(HISTORY_DIR, `${name}.json`);
    let entries = [];

    try {
      if (fs.existsSync(filepath)) {
        entries = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      }
    } catch {
      entries = [];
    }

    entries.push({
      timestamp: new Date().toISOString(),
      oldValue: oldValue ? this._mask(oldValue) : null,
      newValue: newValue ? this._mask(newValue) : null,
      action: oldValue ? 'updated' : 'created'
    });

    // Keep last 100 entries per secret
    if (entries.length > 100) entries = entries.slice(-100);

    fs.writeFileSync(filepath, JSON.stringify(entries, null, 2), { mode: 0o600 });
  }

  // ─── Get History ────────────────────────────────────────────
  get(name, limit = 20) {
    const filepath = path.join(HISTORY_DIR, `${name}.json`);
    if (!fs.existsSync(filepath)) return [];

    const entries = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return entries.slice(-limit);
  }

  // ─── Get All History ────────────────────────────────────────
  getAll(limit = 50) {
    this._ensureDir();
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
    const all = [];

    for (const file of files) {
      const name = file.replace('.json', '');
      const entries = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
      if (entries.length > 0) {
        all.push({
          name,
          lastChange: entries[entries.length - 1],
          changeCount: entries.length
        });
      }
    }

    return all.sort((a, b) =>
      new Date(b.lastChange.timestamp) - new Date(a.lastChange.timestamp)
    ).slice(0, limit);
  }

  // ─── Clear History ──────────────────────────────────────────
  clear(name) {
    if (name) {
      const filepath = path.join(HISTORY_DIR, `${name}.json`);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } else {
      const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
      files.forEach(f => fs.unlinkSync(path.join(HISTORY_DIR, f)));
    }
  }

  // ─── Mask Value ─────────────────────────────────────────────
  _mask(value) {
    if (!value || value.length <= 8) return '***';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }
}

module.exports = { History };
