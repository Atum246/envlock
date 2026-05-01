'use strict';

const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BRIDGE_DIR = path.join(os.homedir(), '.envlock');
const AGENTS_FILE = path.join(BRIDGE_DIR, 'agents.json');
const REQUESTS_FILE = path.join(BRIDGE_DIR, 'agent-requests.json');

class AgentBridge {
  constructor(vault, audit, config) {
    this._vault = vault;
    this._audit = audit;
    this._config = config;
    this._agents = this._loadAgents();
    this._requests = this._loadRequests();
  }

  // ─── Agent Registration ─────────────────────────────────────
  registerAgent(agentId, opts = {}) {
    const agent = {
      id: agentId,
      name: opts.name || agentId,
      registeredAt: new Date().toISOString(),
      permissions: opts.permissions || ['read', 'list'],
      allowedSlots: opts.allowedSlots || ['*'], // * = all
      maxRequestsPerHour: opts.maxRequestsPerHour || 1000
    };
    this._agents[agentId] = agent;
    this._saveAgents();
    this._audit.log('agent_registered', { agentId });
    return agent;
  }

  getAgent(agentId) {
    return this._agents[agentId] || null;
  }

  listAgents() {
    return Object.values(this._agents);
  }

  removeAgent(agentId) {
    delete this._agents[agentId];
    this._saveAgents();
    this._audit.log('agent_removed', { agentId });
  }

  // ─── API Handler ────────────────────────────────────────────
  async handle(method, args, params) {
    const agentId = params.agentId || 'default';

    // Auto-register agent if not exists
    if (!this._agents[agentId]) {
      this.registerAgent(agentId, { name: params.agentName || agentId });
    }

    const agent = this._agents[agentId];

    // Rate limiting
    if (!this._checkRateLimit(agentId)) {
      return { error: 'Rate limit exceeded', code: 'RATE_LIMIT' };
    }

    switch (method) {
      case 'list':
        return this._apiList(agent);
      case 'get':
        return this._apiGet(agent, args[0], params);
      case 'set':
        return this._apiSet(agent, args[0], params);
      case 'create':
        return this._apiCreate(agent, args[0], params);
      case 'delete':
        return this._apiDelete(agent, args[0]);
      case 'export':
        return this._apiExport(agent, params);
      case 'inject':
        return this._apiInject(agent, args, params);
      case 'status':
        return this._apiStatus();
      case 'register':
        return this._apiRegister(params);
      case 'request':
        return this._apiRequest(agent, args[0], params);
      default:
        return { error: `Unknown method: ${method}`, code: 'UNKNOWN_METHOD' };
    }
  }

  // ─── API Methods ────────────────────────────────────────────
  _apiList(agent) {
    if (!agent.permissions.includes('read') && !agent.permissions.includes('list')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const slots = this._vault.listSlots();
    const filtered = this._filterByAccess(agent, slots);

    return {
      success: true,
      slots: filtered.map(s => ({
        name: s.name,
        type: s.type,
        scope: s.scope,
        hasValue: this._vault.hasValue(s.name),
        description: s.description
      }))
    };
  }

  _apiGet(agent, name, params) {
    if (!agent.permissions.includes('read')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const upperName = (name || '').toUpperCase();
    if (!this._hasAccess(agent, upperName)) {
      return { error: 'Access denied to this slot', code: 'ACCESS_DENIED' };
    }

    try {
      const value = this._vault.get(upperName);
      this._audit.log('api_get', { agentId: agent.id, name: upperName });

      // Mask value in response if requested
      if (params.mask) {
        return { success: true, slot: upperName, masked: value.substring(0, 4) + '***' };
      }
      return { success: true, slot: upperName, value };
    } catch (err) {
      return { error: err.message, code: 'NOT_FOUND' };
    }
  }

  _apiSet(agent, name, params) {
    if (!agent.permissions.includes('write') && !agent.permissions.includes('set')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const upperName = (name || '').toUpperCase();
    if (!this._hasAccess(agent, upperName)) {
      return { error: 'Access denied to this slot', code: 'ACCESS_DENIED' };
    }

    const value = params.value;
    if (!value) {
      return { error: 'Value is required', code: 'MISSING_VALUE' };
    }

    try {
      this._vault.set(upperName, value, { expireAt: params.expireAt });
      this._audit.log('api_set', { agentId: agent.id, name: upperName });
      return { success: true, slot: upperName };
    } catch (err) {
      return { error: err.message, code: 'SET_FAILED' };
    }
  }

  _apiCreate(agent, name, params) {
    if (!agent.permissions.includes('write') && !agent.permissions.includes('create')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const upperName = (name || params.name || '').toUpperCase();
    if (this._vault.has(upperName)) {
      return { error: 'Slot already exists', code: 'ALREADY_EXISTS' };
    }

    this._vault.createSlot({
      name: upperName,
      description: params.description || `API key: ${upperName}`,
      type: params.type || 'api_key',
      required: params.required || false,
      scope: params.scope || 'global',
      createdAt: new Date().toISOString()
    });

    this._audit.log('api_create', { agentId: agent.id, name: upperName });

    // If value provided, set it too
    if (params.value) {
      this._vault.set(upperName, params.value);
    }

    return { success: true, slot: upperName };
  }

  _apiDelete(agent, name) {
    if (!agent.permissions.includes('write') && !agent.permissions.includes('delete')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const upperName = (name || '').toUpperCase();
    if (!this._vault.has(upperName)) {
      return { error: 'Slot not found', code: 'NOT_FOUND' };
    }

    this._vault.delete(upperName);
    this._audit.log('api_delete', { agentId: agent.id, name: upperName });
    return { success: true, deleted: upperName };
  }

  _apiExport(agent, params) {
    if (!agent.permissions.includes('read')) {
      return { error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const secrets = this._vault.export(params.scope, true);

    // Filter by agent's allowed slots
    const filtered = {};
    for (const [name, value] of Object.entries(secrets)) {
      if (this._hasAccess(agent, name)) {
        filtered[name] = value;
      }
    }

    this._audit.log('api_export', { agentId: agent.id, count: Object.keys(filtered).length });
    return { success: true, secrets: filtered };
  }

  _apiInject(agent, command, params) {
    if (!agent.permissions.includes('execute')) {
      return { error: 'Execute permission required', code: 'PERMISSION_DENIED' };
    }

    const secrets = this._vault.export(params.scope, true);
    return { success: true, env: secrets, command: command.join(' ') };
  }

  _apiStatus() {
    return {
      success: true,
      initialized: this._vault.exists(),
      locked: this._vault.isLocked(),
      slots: this._vault.exists() ? this._vault.listSlots().length : 0,
      version: '1.0.0'
    };
  }

  _apiRegister(params) {
    const agent = this.registerAgent(params.agentId, {
      name: params.name,
      permissions: params.permissions || ['read', 'list'],
      allowedSlots: params.allowedSlots || ['*']
    });
    return { success: true, agent };
  }

  _apiRequest(agent, name, params) {
    // Request approval from user to access a secret
    const upperName = (name || '').toUpperCase();
    this._requests.push({
      agentId: agent.id,
      slot: upperName,
      reason: params.reason || 'Access requested',
      requestedAt: new Date().toISOString(),
      status: 'pending'
    });
    this._saveRequests();
    this._audit.log('api_request', { agentId: agent.id, name: upperName, reason: params.reason });

    return {
      success: true,
      message: `Access request submitted for ${upperName}. Awaiting user approval.`,
      requestId: this._requests.length - 1
    };
  }

  // ─── Access Control ─────────────────────────────────────────
  _hasAccess(agent, slotName) {
    if (agent.allowedSlots.includes('*')) return true;
    return agent.allowedSlots.includes(slotName);
  }

  _filterByAccess(agent, slots) {
    if (agent.allowedSlots.includes('*')) return slots;
    return slots.filter(s => agent.allowedSlots.includes(s.name));
  }

  // ─── Rate Limiting ──────────────────────────────────────────
  _checkRateLimit(agentId) {
    const now = Date.now();
    const hourAgo = now - 3600000;

    if (!this._rateLimits) this._rateLimits = {};
    if (!this._rateLimits[agentId]) this._rateLimits[agentId] = [];

    // Clean old entries
    this._rateLimits[agentId] = this._rateLimits[agentId].filter(t => t > hourAgo);

    const agent = this._agents[agentId];
    const max = agent ? agent.maxRequestsPerHour : 1000;

    if (this._rateLimits[agentId].length >= max) return false;

    this._rateLimits[agentId].push(now);
    return true;
  }

  // ─── Persistence ────────────────────────────────────────────
  _loadAgents() {
    try {
      if (fs.existsSync(AGENTS_FILE)) return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    } catch {}
    return {};
  }

  _saveAgents() {
    const dir = path.dirname(AGENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(this._agents, null, 2), { mode: 0o600 });
  }

  _loadRequests() {
    try {
      if (fs.existsSync(REQUESTS_FILE)) return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8'));
    } catch {}
    return [];
  }

  _saveRequests() {
    const dir = path.dirname(REQUESTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(this._requests, null, 2), { mode: 0o600 });
  }
}

module.exports = { AgentBridge };
