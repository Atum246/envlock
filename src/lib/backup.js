'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const BACKUP_DIR = path.join(os.homedir(), '.envlock', 'backups');

class Backup {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    }
  }

  // ─── Create Encrypted Backup ────────────────────────────────
  create(password, vaultDir) {
    this._ensureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}`;

    // Collect all vault files
    const files = {};
    const vaultFiles = ['vault.enc', 'slots.enc', 'meta.json', 'config.json', 'audit.json', 'agents.json'];

    for (const file of vaultFiles) {
      const filepath = path.join(vaultDir || path.join(os.homedir(), '.envlock'), file);
      if (fs.existsSync(filepath)) {
        files[file] = fs.readFileSync(filepath, 'utf8');
      }
    }

    // Encrypt the bundle
    const key = crypto.pbkdf2Sync(password, 'envlock-backup-salt', 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const payload = JSON.stringify({
      id: backupId,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      files
    });

    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const bundle = JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      id: backupId
    });

    const backupPath = path.join(BACKUP_DIR, `${backupId}.enc`);
    fs.writeFileSync(backupPath, bundle, { mode: 0o600 });

    return { id: backupId, path: backupPath, files: Object.keys(files) };
  }

  // ─── List Backups ───────────────────────────────────────────
  list() {
    this._ensureDir();
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.enc'));
    return files.map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        id: f.replace('.enc', ''),
        size: stat.size,
        createdAt: stat.mtime.toISOString()
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ─── Restore Backup ─────────────────────────────────────────
  restore(backupId, password, targetDir) {
    const backupPath = path.join(BACKUP_DIR, `${backupId}.enc`);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup "${backupId}" not found`);
    }

    const bundle = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const key = crypto.pbkdf2Sync(password, 'envlock-backup-salt', 100000, 32, 'sha256');
    const iv = Buffer.from(bundle.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(bundle.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);
    const dest = targetDir || path.join(os.homedir(), '.envlock');

    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true, mode: 0o700 });

    for (const [filename, content] of Object.entries(payload.files)) {
      fs.writeFileSync(path.join(dest, filename), content, { mode: 0o600 });
    }

    return {
      id: payload.id,
      restoredAt: new Date().toISOString(),
      files: Object.keys(payload.files)
    };
  }

  // ─── Delete Backup ──────────────────────────────────────────
  delete(backupId) {
    const backupPath = path.join(BACKUP_DIR, `${backupId}.enc`);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
}

module.exports = { Backup };
