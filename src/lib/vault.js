'use strict';

const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT_DIR = path.join(os.homedir(), '.envlock');
const VAULT_FILE = path.join(VAULT_DIR, 'vault.enc');
const SLOTS_FILE = path.join(VAULT_DIR, 'slots.enc');
const META_FILE = path.join(VAULT_DIR, 'meta.json');

class Vault {
  constructor() {
    this._cache = null; // decrypted data in memory
    this._masterKey = null;
    this._slots = {};
    this._secrets = {};
  }

  // ─── Paths ──────────────────────────────────────────────────
  _ensureDir() {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
    }
  }

  exists() {
    return fs.existsSync(VAULT_FILE) && fs.existsSync(SLOTS_FILE);
  }

  // ─── Initialization ─────────────────────────────────────────
  initialize(masterPassword) {
    this._ensureDir();
    this._masterKey = this._deriveKey(masterPassword);

    // Create empty vault
    this._secrets = {};
    this._slots = {};

    this._saveMeta({ createdAt: new Date().toISOString(), version: '1.0.0' });
    this._saveSlots();
    this._saveSecrets();
  }

  // ─── Key Derivation ─────────────────────────────────────────
  _deriveKey(password) {
    const salt = 'envlock-v1-salt-2026';
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000
    }).toString();
  }

  // ─── Lock / Unlock ──────────────────────────────────────────
  lock() {
    this._cache = null;
    this._masterKey = null;
    this._secrets = {};
    this._slots = {};
  }

  unlock(masterPassword) {
    const key = this._deriveKey(masterPassword);

    try {
      // Test decryption
      const raw = fs.readFileSync(SLOTS_FILE, 'utf8');
      const decrypted = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Invalid password');
      JSON.parse(decrypted); // verify it's valid JSON

      this._masterKey = key;
      this._loadSlots();
      this._loadSecrets();
    } catch {
      throw new Error('Invalid master password');
    }
  }

  isLocked() {
    return this._masterKey === null;
  }

  // ─── Slot Management ────────────────────────────────────────
  createSlot(opts) {
    this._loadIfNeeded();
    this._slots[opts.name] = {
      name: opts.name,
      description: opts.description,
      type: opts.type,
      required: opts.required || false,
      defaultValue: opts.defaultValue || null,
      scope: opts.scope || 'global',
      createdAt: opts.createdAt || new Date().toISOString(),
      updatedAt: null
    };
    this._saveSlots();
  }

  has(name) {
    this._loadIfNeeded();
    return name in this._slots;
  }

  hasValue(name) {
    this._loadIfNeeded();
    if (!(name in this._secrets)) return false;
    const entry = this._secrets[name];
    if (entry.expireAt && Date.now() > entry.expireAt) return false;
    return true;
  }

  listSlots(scope) {
    this._loadIfNeeded();
    let slots = Object.values(this._slots);
    if (scope) slots = slots.filter(s => s.scope === scope);
    return slots.sort((a, b) => a.name.localeCompare(b.name));
  }

  delete(name) {
    this._loadIfNeeded();
    delete this._slots[name];
    delete this._secrets[name];
    this._saveSlots();
    this._saveSecrets();
  }

  // ─── Secret Storage ─────────────────────────────────────────
  set(name, value, opts = {}) {
    this._loadIfNeeded();
    this._secrets[name] = {
      value: this._encryptValue(value),
      setAt: new Date().toISOString(),
      expireAt: opts.expireAt || null
    };
    if (this._slots[name]) {
      this._slots[name].updatedAt = new Date().toISOString();
    }
    this._saveSecrets();
    this._saveSlots();
  }

  get(name) {
    this._loadIfNeeded();
    if (!(name in this._slots)) {
      throw new Error(`Slot "${name}" not found. Create it with: envlock create ${name}`);
    }
    if (!(name in this._secrets)) {
      const slot = this._slots[name];
      if (slot.defaultValue) return slot.defaultValue;
      throw new Error(`No value set for "${name}". Set it with: envlock set ${name}`);
    }

    const entry = this._secrets[name];
    if (entry.expireAt && Date.now() > entry.expireAt) {
      throw new Error(`Value for "${name}" has expired. Set a new one with: envlock set ${name}`);
    }

    return this._decryptValue(entry.value);
  }

  export(scope, onlySet = true) {
    this._loadIfNeeded();
    const result = {};
    for (const slot of Object.values(this._slots)) {
      if (scope && slot.scope !== scope) continue;
      if (onlySet && !this.hasValue(slot.name)) continue;
      try {
        result[slot.name] = this.get(slot.name);
      } catch {
        // expired or missing
      }
    }
    return result;
  }

  // ─── Encryption Helpers ─────────────────────────────────────
  _encryptValue(value) {
    return CryptoJS.AES.encrypt(value, this._masterKey).toString();
  }

  _decryptValue(encrypted) {
    const bytes = CryptoJS.AES.decrypt(encrypted, this._masterKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // ─── Bundle (sharing) ───────────────────────────────────────
  createBundle(name, password) {
    this._loadIfNeeded();
    const value = this.get(name);
    const key = this._deriveKey(password);
    const payload = JSON.stringify({ name, value, exportedAt: new Date().toISOString() });
    const encrypted = CryptoJS.AES.encrypt(payload, key).toString();
    return 'envlock-bundle:' + Buffer.from(encrypted).toString('base64');
  }

  importBundle(bundleStr, password) {
    this._loadIfNeeded();
    if (!bundleStr.startsWith('envlock-bundle:')) {
      throw new Error('Invalid bundle format');
    }

    const encrypted = Buffer.from(bundleStr.replace('envlock-bundle:', ''), 'base64').toString();
    const key = this._deriveKey(password);
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const payload = bytes.toString(CryptoJS.enc.Utf8);

    if (!payload) throw new Error('Invalid password or corrupted bundle');

    const { name, value } = JSON.parse(payload);

    if (!this.has(name)) {
      this.createSlot({
        name,
        description: `Imported: ${name}`,
        type: 'api_key',
        scope: 'global',
        createdAt: new Date().toISOString()
      });
    }

    this.set(name, value);
    return name;
  }

  // ─── Password Rotation ──────────────────────────────────────
  rotatePassword(oldPassword, newPassword) {
    // Verify old password
    const oldKey = this._deriveKey(oldPassword);
    try {
      const raw = fs.readFileSync(SLOTS_FILE, 'utf8');
      const decrypted = CryptoJS.AES.decrypt(raw, oldKey).toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error();
      JSON.parse(decrypted);
    } catch {
      throw new Error('Invalid current password');
    }

    // Load with old key
    this._masterKey = oldKey;
    this._loadSlots();
    this._loadSecrets();

    // Decrypt all values
    const plainSecrets = {};
    for (const [name, entry] of Object.entries(this._secrets)) {
      plainSecrets[name] = {
        ...entry,
        value: this._decryptValue(entry.value)
      };
    }

    // Re-encrypt with new key
    this._masterKey = this._deriveKey(newPassword);
    for (const [name, entry] of Object.entries(plainSecrets)) {
      this._secrets[name] = {
        ...entry,
        value: this._encryptValue(entry.value)
      };
    }

    this._saveSlots();
    this._saveSecrets();
  }

  // ─── File I/O ───────────────────────────────────────────────
  _saveMeta(meta) {
    this._ensureDir();
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), { mode: 0o600 });
  }

  _saveSlots() {
    this._ensureDir();
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(this._slots), this._masterKey).toString();
    fs.writeFileSync(SLOTS_FILE, encrypted, { mode: 0o600 });
  }

  _saveSecrets() {
    this._ensureDir();
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(this._secrets), this._masterKey).toString();
    fs.writeFileSync(VAULT_FILE, encrypted, { mode: 0o600 });
  }

  _loadSlots() {
    const raw = fs.readFileSync(SLOTS_FILE, 'utf8');
    const decrypted = CryptoJS.AES.decrypt(raw, this._masterKey).toString(CryptoJS.enc.Utf8);
    this._slots = JSON.parse(decrypted);
  }

  _loadSecrets() {
    const raw = fs.readFileSync(VAULT_FILE, 'utf8');
    const decrypted = CryptoJS.AES.decrypt(raw, this._masterKey).toString(CryptoJS.enc.Utf8);
    this._secrets = JSON.parse(decrypted);
  }

  _loadIfNeeded() {
    if (this._masterKey && Object.keys(this._slots).length === 0 && this.exists()) {
      this._loadSlots();
      this._loadSecrets();
    }
  }

  // ─── Tags ───────────────────────────────────────────────────
  addTags(name, tags) {
    this._loadIfNeeded();
    if (!this._slots[name]) throw new Error(`Slot "${name}" not found`);
    if (!this._slots[name].tags) this._slots[name].tags = [];
    this._slots[name].tags = [...new Set([...this._slots[name].tags, ...tags])];
    this._saveSlots();
  }

  removeTags(name, tags) {
    this._loadIfNeeded();
    if (!this._slots[name]) throw new Error(`Slot "${name}" not found`);
    if (!this._slots[name].tags) return;
    this._slots[name].tags = this._slots[name].tags.filter(t => !tags.includes(t));
    this._saveSlots();
  }

  // ─── Favorites ──────────────────────────────────────────────
  toggleFavorite(name) {
    this._loadIfNeeded();
    if (!this._slots[name]) throw new Error(`Slot "${name}" not found`);
    this._slots[name].favorite = !this._slots[name].favorite;
    this._saveSlots();
    return this._slots[name].favorite;
  }

  // ─── Search ─────────────────────────────────────────────────
  search(query) {
    this._loadIfNeeded();
    const q = query.toLowerCase();
    return Object.values(this._slots).filter(slot => {
      const nameMatch = slot.name.toLowerCase().includes(q);
      const descMatch = (slot.description || '').toLowerCase().includes(q);
      const tagMatch = (slot.tags || []).some(t => t.toLowerCase().includes(q));
      return nameMatch || descMatch || tagMatch;
    }).map(slot => ({
      name: slot.name,
      description: slot.description,
      type: slot.type,
      scope: slot.scope,
      tags: slot.tags || [],
      favorite: slot.favorite || false,
      hasValue: this.hasValue(slot.name)
    }));
  }
}

module.exports = { Vault };
