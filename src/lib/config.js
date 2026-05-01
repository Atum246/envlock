'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.envlock', 'config.json');

const DEFAULTS = {
  autoLock: true,
  autoLockMinutes: 30,
  showBanner: true,
  defaultScope: 'global',
  auditEnabled: true,
  maxAuditEntries: 10000,
  requireConfirmation: true
};

class Config {
  constructor() {
    this._data = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        this._data = { ...DEFAULTS, ...saved };
      }
    } catch {
      this._data = { ...DEFAULTS };
    }
  }

  _save() {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this._data, null, 2), { mode: 0o600 });
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    // Auto-detect types
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    if (/^\d+$/.test(value)) value = parseInt(value);

    this._data[key] = value;
    this._save();
  }

  getAll() {
    return { ...this._data };
  }

  reset() {
    this._data = { ...DEFAULTS };
    this._save();
  }
}

module.exports = { Config };
