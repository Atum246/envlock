'use strict';

const https = require('https');
const http = require('http');

class HealthChecker {
  // ─── Check if a URL is reachable ────────────────────────────
  static async checkUrl(url, timeout = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const mod = url.startsWith('https') ? https : http;

      const req = mod.get(url, { timeout }, (res) => {
        resolve({
          reachable: true,
          status: res.statusCode,
          latency: Date.now() - start
        });
      });

      req.on('error', () => {
        resolve({ reachable: false, latency: Date.now() - start });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ reachable: false, latency: Date.now() - start, reason: 'timeout' });
      });
    });
  }

  // ─── Validate API Key Format ────────────────────────────────
  static validateFormat(name, value) {
    const validators = {
      'OPENAI_API_KEY': { pattern: /^sk-/, minLength: 20, service: 'OpenAI' },
      'ANTHROPIC_API_KEY': { pattern: /^sk-ant-/, minLength: 20, service: 'Anthropic' },
      'GITHUB_TOKEN': { pattern: /^gh[pousr]_/, minLength: 30, service: 'GitHub' },
      'STRIPE_SECRET_KEY': { pattern: /^sk_/, minLength: 20, service: 'Stripe' },
      'STRIPE_PUBLISHABLE_KEY': { pattern: /^pk_/, minLength: 20, service: 'Stripe' },
      'AWS_ACCESS_KEY_ID': { pattern: /^AKIA/, minLength: 16, service: 'AWS' },
      'DISCORD_TOKEN': { pattern: /^[A-Za-z0-9._-]{24,}/, minLength: 24, service: 'Discord' },
      'SLACK_BOT_TOKEN': { pattern: /^xoxb-/, minLength: 20, service: 'Slack' },
      'SLACK_APP_TOKEN': { pattern: /^xapp-/, minLength: 20, service: 'Slack' },
      'TELEGRAM_BOT_TOKEN': { pattern: /^\d+:[A-Za-z0-9_-]+/, minLength: 20, service: 'Telegram' },
      'NPM_TOKEN': { pattern: /^npm_/, minLength: 20, service: 'npm' },
      'SENDGRID_API_KEY': { pattern: /^SG\./, minLength: 20, service: 'SendGrid' },
      'HF_TOKEN': { pattern: /^hf_/, minLength: 10, service: 'Hugging Face' },
      'REPLICATE_API_TOKEN': { pattern: /^r8_/, minLength: 10, service: 'Replicate' },
      'VERCEL_TOKEN': { pattern: /^[A-Za-z0-9]{24,}/, minLength: 24, service: 'Vercel' },
      'NETLIFY_AUTH_TOKEN': { pattern: /^[A-Za-z0-9_-]{20,}/, minLength: 20, service: 'Netlify' },
      'FIREBASE_API_KEY': { pattern: /^AIza/, minLength: 20, service: 'Firebase' },
      'TWITTER_API_KEY': { pattern: /^[A-Za-z0-9]{20,}/, minLength: 20, service: 'Twitter' },
      'TWITTER_BEARER_TOKEN': { pattern: /^AAAA/, minLength: 40, service: 'Twitter' },
      'DOCKER_PASSWORD': { minLength: 4, service: 'Docker' },
      'GITHUB_TOKEN': { pattern: /^gh[pousr]_/, minLength: 30, service: 'GitHub' },
    };

    const validator = validators[name];
    if (!validator) return { valid: true, message: 'No format validation available' };

    const checks = [];

    if (value.length < validator.minLength) {
      checks.push(`Too short (expected ≥${validator.minLength} chars)`);
    }

    if (validator.pattern && !validator.pattern.test(value)) {
      checks.push(`Unexpected format for ${validator.service}`);
    }

    return {
      valid: checks.length === 0,
      service: validator.service,
      checks
    };
  }

  // ─── Batch Health Check ─────────────────────────────────────
  static async batchCheck(secrets) {
    const results = [];

    for (const [name, value] of Object.entries(secrets)) {
      const formatCheck = this.validateFormat(name, value);

      // Try to detect URLs in values for reachability checks
      let urlCheck = null;
      if (value.startsWith('http://') || value.startsWith('https://')) {
        urlCheck = await this.checkUrl(value);
      }

      results.push({
        name,
        format: formatCheck,
        reachability: urlCheck,
        masked: value.substring(0, 4) + '***'
      });
    }

    return results;
  }
}

module.exports = { HealthChecker };
