'use strict';

const crypto = require('crypto');

class PasswordGenerator {
  // ─── Generate Strong Passwords ──────────────────────────────
  static generate(opts = {}) {
    const {
      length = 32,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      excludeAmbiguous = false,
      customChars = null
    } = opts;

    let chars = '';
    if (customChars) {
      chars = customChars;
    } else {
      if (uppercase) chars += excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (lowercase) chars += excludeAmbiguous ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
      if (numbers) chars += excludeAmbiguous ? '23456789' : '0123456789';
      if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  // ─── Generate API Key ───────────────────────────────────────
  static generateApiKey(prefix = '') {
    const key = crypto.randomBytes(32).toString('hex');
    return prefix ? `${prefix}_${key}` : key;
  }

  // ─── Generate Token ─────────────────────────────────────────
  static generateToken(length = 64) {
    return crypto.randomBytes(length).toString('base64url');
  }

  // ─── Generate UUID ──────────────────────────────────────────
  static generateUUID() {
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  // ─── Password Strength Analysis ─────────────────────────────
  static analyzeStrength(password) {
    let score = 0;
    const feedback = [];

    // Length
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (password.length >= 24) score += 1;
    if (password.length < 8) feedback.push('Too short (min 8 chars)');

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Patterns
    if (/(.)\1{2,}/.test(password)) { score -= 1; feedback.push('Contains repeated characters'); }
    if (/^[a-zA-Z]+$/.test(password)) { score -= 1; feedback.push('Add numbers or symbols'); }
    if (/^[0-9]+$/.test(password)) { score -= 2; feedback.push('Only numbers — very weak'); }

    // Common patterns
    const common = ['password', '123456', 'qwerty', 'abc123', 'letmein', 'admin', 'welcome'];
    if (common.some(c => password.toLowerCase().includes(c))) {
      score -= 2;
      feedback.push('Contains common password pattern');
    }

    // Entropy estimate
    const charsetSize =
      (/[a-z]/.test(password) ? 26 : 0) +
      (/[A-Z]/.test(password) ? 26 : 0) +
      (/[0-9]/.test(password) ? 10 : 0) +
      (/[^a-zA-Z0-9]/.test(password) ? 32 : 0);
    const entropy = Math.log2(Math.pow(charsetSize || 1, password.length));

    score = Math.max(0, Math.min(5, score));

    const labels = ['💀 Very Weak', '😟 Weak', '😐 Fair', '😊 Strong', '💪 Very Strong', '🔐 Excellent'];

    return {
      score,
      label: labels[score],
      entropy: Math.round(entropy),
      length: password.length,
      feedback
    };
  }
}

module.exports = { PasswordGenerator };
