'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const AUDIT_FILE = path.join(os.homedir(), '.envlock', 'audit.json');

class AuditLog {
  constructor() {
    this._entries = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(AUDIT_FILE)) {
        this._entries = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
      }
    } catch {
      this._entries = [];
    }
  }

  _save() {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(this._entries, null, 2), { mode: 0o600 });
  }

  log(event, details = null) {
    this._entries.push({
      timestamp: new Date().toISOString(),
      event,
      details,
      pid: process.pid
    });
    this._save();
  }

  getLast(count = 20) {
    return this._entries.slice(-count);
  }

  getAll() {
    return [...this._entries];
  }

  clear() {
    this._entries = [];
    this._save();
  }
}

module.exports = { AuditLog };
