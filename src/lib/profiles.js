'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROFILES_DIR = path.join(os.homedir(), '.envlock', 'profiles');

class Profiles {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true, mode: 0o700 });
    }
  }

  // ─── List Profiles ──────────────────────────────────────────
  list() {
    this._ensureDir();
    const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf8'));
      return {
        id: f.replace('.json', ''),
        name: data.name,
        description: data.description,
        createdAt: data.createdAt,
        secretCount: data.secrets ? Object.keys(data.secrets).length : 0
      };
    });
  }

  // ─── Create Profile ─────────────────────────────────────────
  create(id, opts = {}) {
    this._ensureDir();
    const filepath = path.join(PROFILES_DIR, `${id}.json`);
    if (fs.existsSync(filepath)) {
      throw new Error(`Profile "${id}" already exists`);
    }

    const profile = {
      name: opts.name || id,
      description: opts.description || '',
      createdAt: new Date().toISOString(),
      secrets: {},
      tags: {}
    };

    fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), { mode: 0o600 });
    return profile;
  }

  // ─── Get Profile ────────────────────────────────────────────
  get(id) {
    const filepath = path.join(PROFILES_DIR, `${id}.json`);
    if (!fs.existsSync(filepath)) {
      throw new Error(`Profile "${id}" not found`);
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }

  // ─── Delete Profile ─────────────────────────────────────────
  delete(id) {
    const filepath = path.join(PROFILES_DIR, `${id}.json`);
    if (!fs.existsSync(filepath)) {
      throw new Error(`Profile "${id}" not found`);
    }
    fs.unlinkSync(filepath);
  }

  // ─── Set Secret in Profile ──────────────────────────────────
  setSecret(id, name, value, metadata = {}) {
    const profile = this.get(id);
    profile.secrets[name] = {
      value,
      setAt: new Date().toISOString(),
      ...metadata
    };
    const filepath = path.join(PROFILES_DIR, `${id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), { mode: 0o600 });
  }

  // ─── Get Secret from Profile ────────────────────────────────
  getSecret(id, name) {
    const profile = this.get(id);
    if (!profile.secrets[name]) {
      throw new Error(`Secret "${name}" not found in profile "${id}"`);
    }
    return profile.secrets[name].value;
  }

  // ─── Export Profile (encrypted) ─────────────────────────────
  exportBundle(id, password) {
    const profile = this.get(id);
    const key = crypto.pbkdf2Sync(password, 'envlock-profile-salt', 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(JSON.stringify(profile), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return 'envlock-profile:' + Buffer.from(JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      id
    })).toString('base64');
  }

  // ─── Import Profile (decrypt) ───────────────────────────────
  importBundle(bundle, password) {
    if (!bundle.startsWith('envlock-profile:')) {
      throw new Error('Invalid profile bundle format');
    }

    const payload = JSON.parse(
      Buffer.from(bundle.replace('envlock-profile:', ''), 'base64').toString()
    );

    const key = crypto.pbkdf2Sync(password, 'envlock-profile-salt', 100000, 32, 'sha256');
    const iv = Buffer.from(payload.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const profile = JSON.parse(decrypted);
    const id = payload.id || profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    this.create(id, {
      name: profile.name,
      description: profile.description
    });

    const filepath = path.join(PROFILES_DIR, `${id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), { mode: 0o600 });

    return id;
  }

  // ─── Diff Profiles ──────────────────────────────────────────
  diff(id1, id2) {
    const p1 = this.get(id1);
    const p2 = this.get(id2);

    const keys1 = new Set(Object.keys(p1.secrets));
    const keys2 = new Set(Object.keys(p2.secrets));

    const onlyIn1 = [...keys1].filter(k => !keys2.has(k));
    const onlyIn2 = [...keys2].filter(k => !keys1.has(k));
    const shared = [...keys1].filter(k => keys2.has(k));
    const different = shared.filter(k => p1.secrets[k].value !== p2.secrets[k].value);

    return {
      profile1: id1,
      profile2: id2,
      onlyIn1,
      onlyIn2,
      shared: shared.filter(k => p1.secrets[k].value === p2.secrets[k].value),
      different
    };
  }
}

module.exports = { Profiles };
