'use strict';

const { Vault } = require('../src/lib/vault');
const { AuditLog } = require('../src/lib/audit');
const { Config } = require('../src/lib/config');
const { AgentBridge } = require('../src/lib/agent-bridge');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Test cleanup
const testDir = path.join(os.homedir(), '.envlock-test');
const realEnvlockDir = path.join(os.homedir(), '.envlock');

function cleanup() {
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    // Clean up test artifacts from real envlock dir
    const profilesDir = path.join(realEnvlockDir, 'profiles');
    const historyDir = path.join(realEnvlockDir, 'history');
    const backupsDir = path.join(realEnvlockDir, 'backups');

    // Remove test profiles
    if (fs.existsSync(profilesDir)) {
      ['dev', 'prod', 'p1', 'p2', 'test-prof'].forEach(id => {
        const f = path.join(profilesDir, `${id}.json`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    }
    // Remove test history
    if (fs.existsSync(historyDir)) {
      ['TEST_KEY', 'KEY_A', 'KEY_B', 'CLEAR_TEST'].forEach(name => {
        const f = path.join(historyDir, `${name}.json`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    }
  } catch (e) {
    // ignore cleanup errors
  }
}

function setup() {
  cleanup();
  process.env.ENVLOCK_HOME = testDir;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n🔐 Envlock Test Suite\n');

// ─── Vault Tests ────────────────────────────────────────────────
console.log('📦 Vault:');

test('initialize vault', () => {
  const vault = new Vault();
  vault.initialize('test-password-123');
  assert(vault.exists(), 'Vault should exist after init');
});

test('create and list slots', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'TEST_KEY', type: 'api_key', description: 'Test key' });
  vault.createSlot({ name: 'DB_PASS', type: 'password', description: 'DB password' });
  const slots = vault.listSlots();
  assert.strictEqual(slots.length, 2);
});

test('set and get secret', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'API_KEY', type: 'api_key' });
  vault.set('API_KEY', 'sk-1234567890');
  const value = vault.get('API_KEY');
  assert.strictEqual(value, 'sk-1234567890');
});

test('encryption works - different key can\'t decrypt', () => {
  const vault1 = new Vault();
  vault1.initialize('password-one');
  vault1.createSlot({ name: 'SECRET', type: 'api_key' });
  vault1.set('SECRET', 'my-secret-value');
  vault1.lock();

  const vault2 = new Vault();
  assert.throws(() => vault2.unlock('wrong-password'), /Invalid/);
});

test('lock and unlock', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'KEY', type: 'api_key' });
  vault.set('KEY', 'value123');

  vault.lock();
  assert(vault.isLocked(), 'Should be locked');

  vault.unlock('test');
  assert(!vault.isLocked(), 'Should be unlocked');
  assert.strictEqual(vault.get('KEY'), 'value123');
});

test('delete slot', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'OLD_KEY', type: 'api_key' });
  assert(vault.has('OLD_KEY'));
  vault.delete('OLD_KEY');
  assert(!vault.has('OLD_KEY'));
});

test('hasValue checks expiry', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'TEMP', type: 'token' });
  vault.set('TEMP', 'expired-value', { expireAt: Date.now() - 1000 });
  assert(!vault.hasValue('TEMP'), 'Should detect expired value');
});

test('export returns only set values', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'SET_KEY', type: 'api_key' });
  vault.createSlot({ name: 'EMPTY_KEY', type: 'api_key' });
  vault.set('SET_KEY', 'value');

  const exported = vault.export(null, true);
  assert.strictEqual(Object.keys(exported).length, 1);
  assert.strictEqual(exported['SET_KEY'], 'value');
});

test('create and import bundle', () => {
  const vault1 = new Vault();
  vault1.initialize('test');
  vault1.createSlot({ name: 'SHARED_KEY', type: 'api_key' });
  vault1.set('SHARED_KEY', 'shared-secret');

  const bundle = vault1.createBundle('SHARED_KEY', 'bundle-pwd');
  assert(bundle.startsWith('envlock-bundle:'));

  const vault2 = new Vault();
  vault2.initialize('test2');
  const name = vault2.importBundle(bundle, 'bundle-pwd');
  assert.strictEqual(name, 'SHARED_KEY');
  assert.strictEqual(vault2.get('SHARED_KEY'), 'shared-secret');
});

test('rotate password', () => {
  const vault = new Vault();
  vault.initialize('old-pwd');
  vault.createSlot({ name: 'KEY', type: 'api_key' });
  vault.set('KEY', 'my-value');

  vault.rotatePassword('old-pwd', 'new-pwd');
  vault.lock();
  vault.unlock('new-pwd');
  assert.strictEqual(vault.get('KEY'), 'my-value');
});

// ─── Agent Bridge Tests ─────────────────────────────────────────
console.log('\n🤖 Agent Bridge:');

test('register agent', async () => {
  const vault = new Vault();
  vault.initialize('test');
  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);

  const agent = bridge.registerAgent('openclaw', {
    name: 'OpenClaw Agent',
    permissions: ['read', 'list', 'write', 'create']
  });
  assert.strictEqual(agent.id, 'openclaw');
});

test('agent list slots', async () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'TEST', type: 'api_key' });
  vault.set('TEST', 'value');

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('agent1', { permissions: ['read', 'list'] });

  const result = await bridge.handle('list', [], { agentId: 'agent1' });
  assert(result.success);
  assert(result.slots.length > 0);
});

test('agent get secret', async () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'KEY', type: 'api_key' });
  vault.set('KEY', 'secret-value');

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('agent1', { permissions: ['read'] });

  const result = await bridge.handle('get', ['KEY'], { agentId: 'agent1' });
  assert(result.success);
  assert.strictEqual(result.value, 'secret-value');
});

test('agent creates slot', async () => {
  const vault = new Vault();
  vault.initialize('test');

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('agent1', { permissions: ['read', 'write', 'create'] });

  const result = await bridge.handle('create', ['NEW_API'], {
    agentId: 'agent1',
    description: 'New API key',
    type: 'api_key',
    value: 'initial-value'
  });
  assert(result.success);
  assert.strictEqual(result.slot, 'NEW_API');
});

test('permission denied for unauthorized agent', async () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'SECRET', type: 'api_key' });

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('limited', { permissions: ['read'] });

  const result = await bridge.handle('create', ['HACKED'], {
    agentId: 'limited'
  });
  assert(result.error);
  assert.strictEqual(result.code, 'PERMISSION_DENIED');
});

test('scoped access - agent only sees allowed slots', async () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'ALLOWED', type: 'api_key' });
  vault.createSlot({ name: 'BLOCKED', type: 'api_key' });

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('scoped', {
    permissions: ['read', 'list'],
    allowedSlots: ['ALLOWED']
  });

  const result = await bridge.handle('list', [], { agentId: 'scoped' });
  assert(result.success);
  assert.strictEqual(result.slots.length, 1);
  assert.strictEqual(result.slots[0].name, 'ALLOWED');
});

test('export secrets for agent', async () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'K1', type: 'api_key' });
  vault.createSlot({ name: 'K2', type: 'token' });
  vault.set('K1', 'v1');
  vault.set('K2', 'v2');

  const audit = new AuditLog();
  const config = new Config();
  const bridge = new AgentBridge(vault, audit, config);
  bridge.registerAgent('exporter', { permissions: ['read'] });

  const result = await bridge.handle('export', [], { agentId: 'exporter' });
  assert(result.success);
  assert.strictEqual(Object.keys(result.secrets).length, 2);
});

// ─── Config Tests ───────────────────────────────────────────────
console.log('\n⚙️  Config:');

test('config defaults', () => {
  const config = new Config();
  assert.strictEqual(config.get('autoLock'), true);
  assert.strictEqual(config.get('showBanner'), true);
});

test('config set and get', () => {
  const config = new Config();
  config.set('customKey', 'customValue');
  assert.strictEqual(config.get('customKey'), 'customValue');
});

test('config reset', () => {
  const config = new Config();
  config.set('test', 'value');
  config.reset();
  assert.strictEqual(config.get('test'), undefined);
});

// ─── Password Generator Tests ───────────────────────────────────
console.log('\n🔐 Password Generator:');

const { PasswordGenerator } = require('../src/lib/password-gen');

test('generate password with default options', () => {
  const pwd = PasswordGenerator.generate();
  assert.strictEqual(pwd.length, 32);
});

test('generate password with custom length', () => {
  const pwd = PasswordGenerator.generate({ length: 64 });
  assert.strictEqual(pwd.length, 64);
});

test('generate API key with prefix', () => {
  const key = PasswordGenerator.generateApiKey('sk');
  assert(key.startsWith('sk_'));
  assert(key.length > 20);
});

test('generate token', () => {
  const token = PasswordGenerator.generateToken(32);
  assert(typeof token === 'string');
  assert(token.length > 0);
});

test('generate UUID', () => {
  const uuid = PasswordGenerator.generateUUID();
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid));
});

test('analyze strong password', () => {
  const result = PasswordGenerator.analyzeStrength('MyS3cure!P@ssw0rd#2026');
  assert(result.score >= 3);
  assert(result.entropy > 50);
});

test('analyze weak password', () => {
  const result = PasswordGenerator.analyzeStrength('123');
  assert(result.score <= 2);
  assert(result.feedback.length > 0);
});

// ─── Tags & Favorites Tests ─────────────────────────────────────
console.log('\n🏷️  Tags & Favorites:');

test('add tags to secret', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'TAGGED', type: 'api_key' });
  vault.addTags('TAGGED', ['production', 'critical']);
  const slots = vault.listSlots();
  const tagged = slots.find(s => s.name === 'TAGGED');
  assert.deepStrictEqual(tagged.tags, ['production', 'critical']);
});

test('toggle favorite', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'FAVED', type: 'api_key' });
  const isFav = vault.toggleFavorite('FAVED');
  assert.strictEqual(isFav, true);
  const isFav2 = vault.toggleFavorite('FAVED');
  assert.strictEqual(isFav2, false);
});

test('search by name', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'OPENAI_KEY', type: 'api_key', description: 'OpenAI API' });
  vault.createSlot({ name: 'STRIPE_KEY', type: 'api_key', description: 'Stripe' });
  vault.createSlot({ name: 'OPENAI_ORG', type: 'api_key', description: 'OpenAI Org' });
  const results = vault.search('openai');
  assert.strictEqual(results.length, 2);
});

test('search by tag', () => {
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'PROD_KEY', type: 'api_key' });
  vault.addTags('PROD_KEY', ['production']);
  const results = vault.search('production');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'PROD_KEY');
});

// ─── History Tests ──────────────────────────────────────────────
console.log('\n📜 History:');

const { History } = require('../src/lib/history');

test('record and get history', () => {
  const h = new History();
  h.record('TEST_KEY', null, 'new-value');
  h.record('TEST_KEY', 'old-value', 'new-value');
  const entries = h.get('TEST_KEY');
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].action, 'created');
  assert.strictEqual(entries[1].action, 'updated');
});

test('get all history', () => {
  const h = new History();
  h.record('KEY_A', null, 'val-a');
  h.record('KEY_B', null, 'val-b');
  const all = h.getAll();
  assert(all.length >= 2);
});

test('clear history', () => {
  const h = new History();
  h.record('CLEAR_TEST', null, 'val');
  h.clear('CLEAR_TEST');
  const entries = h.get('CLEAR_TEST');
  assert.strictEqual(entries.length, 0);
});

// ─── Profiles Tests ─────────────────────────────────────────────
console.log('\n📁 Profiles:');

const { Profiles } = require('../src/lib/profiles');

test('create and list profiles', () => {
  const p = new Profiles();
  p.create('dev', { name: 'Development' });
  p.create('prod', { name: 'Production' });
  const list = p.list();
  assert(list.length >= 2);
});

test('set and get secret in profile', () => {
  const p = new Profiles();
  p.create('test-prof', { name: 'Test' });
  p.setSecret('test-prof', 'API_KEY', 'sk-123');
  const val = p.getSecret('test-prof', 'API_KEY');
  assert.strictEqual(val, 'sk-123');
});

test('diff profiles', () => {
  const p = new Profiles();
  p.create('p1', { name: 'P1' });
  p.create('p2', { name: 'P2' });
  p.setSecret('p1', 'ONLY_P1', 'val1');
  p.setSecret('p2', 'ONLY_P2', 'val2');
  p.setSecret('p1', 'SHARED', 'same');
  p.setSecret('p2', 'SHARED', 'same');
  const diff = p.diff('p1', 'p2');
  assert.strictEqual(diff.onlyIn1.length, 1);
  assert.strictEqual(diff.onlyIn2.length, 1);
  assert.strictEqual(diff.shared.length, 1);
});

// ─── Health Check Tests ─────────────────────────────────────────
console.log('\n🏥 Health Check:');

const { HealthChecker } = require('../src/lib/health-check');

test('validate OpenAI key format', () => {
  const result = HealthChecker.validateFormat('OPENAI_API_KEY', 'sk-1234567890abcdef1234567890');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.service, 'OpenAI');
});

test('reject short OpenAI key', () => {
  const result = HealthChecker.validateFormat('OPENAI_API_KEY', 'sk-short');
  assert.strictEqual(result.valid, false);
});

test('validate GitHub token format', () => {
  const result = HealthChecker.validateFormat('GITHUB_TOKEN', 'ghp_1234567890abcdef1234567890abcdef12');
  assert.strictEqual(result.valid, true);
});

test('batch health check', async () => {
  const results = await HealthChecker.batchCheck({
    'OPENAI_API_KEY': 'sk-1234567890abcdef1234567890',
    'SHORT_KEY': 'abc'
  });
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].format.valid, true);
});

// ─── Backup Tests ───────────────────────────────────────────────
console.log('\n💾 Backup:');

const { Backup } = require('../src/lib/backup');

test('create and list backups', () => {
  const b = new Backup();
  const vault = new Vault();
  vault.initialize('test');
  vault.createSlot({ name: 'BACKUP_KEY', type: 'api_key' });
  vault.set('BACKUP_KEY', 'backup-value');

  const result = b.create('test-pwd');
  assert(result.id.startsWith('backup-'));
  assert(result.files.length > 0);

  const list = b.list();
  assert(list.length >= 1);
});

// ─── Results ────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('🎉 All tests passed!\n');
