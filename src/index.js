#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const { showLogo, showVersion } = require('./lib/logo');
const { Vault } = require('./lib/vault');
const { AgentBridge } = require('./lib/agent-bridge');
const { AuditLog } = require('./lib/audit');
const { Config } = require('./lib/config');
const { WebUI } = require('./lib/web-ui');
const { listTemplates, listCategories, getTemplate } = require('./lib/templates');
const { PasswordGenerator } = require('./lib/password-gen');
const { Profiles } = require('./lib/profiles');
const { History } = require('./lib/history');
const { HealthChecker } = require('./lib/health-check');
const { Backup } = require('./lib/backup');

const profiles = new Profiles();
const history = new History();
const backup = new Backup();

const program = new Command();

// ─── Core Vault Instance ────────────────────────────────────────
const vault = new Vault();
const audit = new AuditLog();
const config = new Config();
const bridge = new AgentBridge(vault, audit, config);
const webui = new WebUI(vault, audit, config);

// ─── CLI Setup ──────────────────────────────────────────────────
program
  .name('envlock')
  .description('🔐 Envlock — Secure credential vault for AI agents')
  .version('1.0.0', '-v, --version', 'Show version')
  .option('--no-banner', 'Skip the ASCII banner')
  .option('--json', 'Output in JSON format (agent-friendly)')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().banner !== false && !thisCommand.opts().json) {
      showLogo();
    }
  });

// ─── INIT ───────────────────────────────────────────────────────
program
  .command('init')
  .description('Initialize Envlock vault with a master password')
  .option('--force', 'Reinitialize even if vault exists')
  .action(async (opts) => {
    const inquirer = require('inquirer');
    const ora = require('ora');

    if (vault.exists() && !opts.force) {
      console.log(chalk.yellow('⚠️  Vault already exists. Use --force to reinitialize.'));
      return;
    }

    const { masterPassword } = await inquirer.prompt([{
      type: 'password',
      name: 'masterPassword',
      message: '🔑 Set your master password:',
      mask: '*'
    }]);

    const { confirmPassword } = await inquirer.prompt([{
      type: 'password',
      name: 'confirmPassword',
      message: '🔑 Confirm master password:',
      mask: '*'
    }]);

    if (masterPassword !== confirmPassword) {
      console.log(chalk.red('❌ Passwords do not match!'));
      process.exit(1);
    }

    const spinner = ora('🔐 Creating encrypted vault...').start();
    vault.initialize(masterPassword);
    audit.log('vault_initialized');
    spinner.succeed(chalk.green('✅ Vault initialized successfully!'));
    console.log(chalk.cyan('\n💡 Next step: Run `envlock create` to add your first secret'));
  });

// ─── CREATE (Agent creates an env slot) ─────────────────────────
program
  .command('create <name>')
  .description('Create a new secret slot (e.g., OPENAI_API_KEY)')
  .option('-d, --description <desc>', 'Description of this secret')
  .option('-t, --type <type>', 'Type: api_key | token | password | ssh_key | oauth | custom', 'api_key')
  .option('-r, --required', 'Mark as required (agent will warn if empty)', false)
  .option('--default <value>', 'Default value (stored encrypted)')
  .option('--scope <scope>', 'Scope: global | project | agent', 'global')
  .action(async (name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (vault.has(upperName)) {
      console.log(chalk.yellow(`⚠️  Slot "${upperName}" already exists. Use \`envlock set ${upperName}\` to update it.`));
      return;
    }

    vault.createSlot({
      name: upperName,
      description: opts.description || `Secret: ${upperName}`,
      type: opts.type,
      required: opts.required,
      defaultValue: opts.default || null,
      scope: opts.scope,
      createdAt: new Date().toISOString()
    });

    audit.log('slot_created', { name: upperName, type: opts.type });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, slot: upperName }));
    } else {
      console.log(chalk.green(`✅ Created slot: ${chalk.bold(upperName)}`));
      console.log(chalk.gray(`   Type: ${opts.type} | Scope: ${opts.scope}`));
      console.log(chalk.cyan(`\n💡 Set the value: envlock set ${upperName}`));
    }
  });

// ─── SET (User/Agent sets a secret value) ───────────────────────
program
  .command('set <name>')
  .description('Set the value for a secret slot')
  .option('-v, --value <val>', 'Value to store (will be prompted if not provided)')
  .option('--from-stdin', 'Read value from stdin (pipe-friendly)')
  .option('--from-env <varname>', 'Read value from environment variable')
  .option('--expire <seconds>', 'Auto-expire after N seconds')
  .action(async (name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (!vault.has(upperName)) {
      console.log(chalk.yellow(`⚠️  Slot "${upperName}" doesn't exist. Creating it now...`));
      vault.createSlot({
        name: upperName,
        description: `Secret: ${upperName}`,
        type: 'api_key',
        required: false,
        scope: 'global',
        createdAt: new Date().toISOString()
      });
    }

    let value;

    if (opts.value) {
      value = opts.value;
    } else if (opts.fromEnv) {
      value = process.env[opts.fromEnv];
      if (!value) {
        console.log(chalk.red(`❌ Environment variable "${opts.fromEnv}" is not set`));
        process.exit(1);
      }
    } else if (opts.fromStdin) {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      value = Buffer.concat(chunks).toString().trim();
    } else {
      const inquirer = require('inquirer');
      const { val } = await inquirer.prompt([{
        type: 'password',
        name: 'val',
        message: `🔑 Enter value for ${chalk.bold(upperName)}:`,
        mask: '*'
      }]);
      value = val;
    }

    if (!value || value.length === 0) {
      console.log(chalk.red('❌ Value cannot be empty'));
      process.exit(1);
    }

    const expireAt = opts.expire ? Date.now() + (parseInt(opts.expire) * 1000) : null;
    vault.set(upperName, value, { expireAt });
    audit.log('secret_set', { name: upperName, hasExpiry: !!expireAt });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, slot: upperName, encrypted: true }));
    } else {
      console.log(chalk.green(`✅ ${chalk.bold(upperName)} stored securely 🔐`));
      if (expireAt) console.log(chalk.gray(`   ⏰ Expires in ${opts.expire} seconds`));
    }
  });

// ─── GET (Retrieve a secret) ────────────────────────────────────
program
  .command('get <name>')
  .description('Retrieve a secret value')
  .option('--raw', 'Output only the value (no formatting)')
  .option('--clipboard', 'Copy to clipboard')
  .action(async (name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    try {
      const value = vault.get(upperName);
      audit.log('secret_accessed', { name: upperName });

      if (opts.raw || opts.json) {
        process.stdout.write(opts.json ? JSON.stringify({ value }) : value);
      } else {
        console.log(chalk.green(`🔑 ${chalk.bold(upperName)}:`));
        console.log(chalk.white(value));
      }

      if (opts.clipboard) {
        try {
          const clipboardy = require('clipboardy');
          clipboardy.writeSync(value);
          console.log(chalk.gray('\n📋 Copied to clipboard'));
        } catch {
          console.log(chalk.gray('\n⚠️  Clipboard not available'));
        }
      }
    } catch (err) {
      if (opts.json) {
        console.log(JSON.stringify({ error: err.message }));
      } else {
        console.log(chalk.red(`❌ ${err.message}`));
      }
      process.exit(1);
    }
  });

// ─── DELETE ─────────────────────────────────────────────────────
program
  .command('delete <name>')
  .description('Delete a secret slot')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (!vault.has(upperName)) {
      console.log(chalk.red(`❌ Slot "${upperName}" not found`));
      process.exit(1);
    }

    if (!opts.force) {
      const inquirer = require('inquirer');
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `⚠️  Delete "${upperName}"? This cannot be undone.`,
        default: false
      }]);
      if (!confirm) {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
    }

    vault.delete(upperName);
    audit.log('secret_deleted', { name: upperName });
    console.log(chalk.green(`✅ Deleted: ${upperName}`));
  });

// ─── LIST ───────────────────────────────────────────────────────
program
  .command('list')
  .alias('ls')
  .description('List all secret slots')
  .option('--scope <scope>', 'Filter by scope')
  .action((opts) => {
    ensureVault();
    const Table = require('cli-table3');
    const slots = vault.listSlots(opts.scope);

    if (slots.length === 0) {
      console.log(chalk.yellow('📭 No secrets stored yet. Run `envlock create <NAME>` to add one.'));
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(slots));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Type'),
        chalk.cyan('Scope'),
        chalk.cyan('Status'),
        chalk.cyan('Description')
      ],
      style: { head: [], border: [] }
    });

    slots.forEach(slot => {
      const hasValue = vault.hasValue(slot.name);
      const expired = slot.expireAt && Date.now() > slot.expireAt;
      let status = hasValue ? chalk.green('✅ Set') : chalk.gray('⬜ Empty');
      if (expired) status = chalk.red('⏰ Expired');
      if (slot.required && !hasValue) status = chalk.red('⚠️  Required!');

      table.push([
        chalk.bold(slot.name),
        slot.type,
        slot.scope,
        status,
        slot.description || '-'
      ]);
    });

    console.log(chalk.bold('\n🔐 Envlock Secrets:\n'));
    console.log(table.toString());
    console.log(chalk.gray(`\n   Total: ${slots.length} slots`));
  });

// ─── EXPORT (for shell/env injection) ───────────────────────────
program
  .command('export')
  .description('Export secrets as environment variables')
  .option('--format <fmt>', 'Format: shell | dotenv | docker | json', 'shell')
  .option('--scope <scope>', 'Filter by scope')
  .option('--only-set', 'Only export slots that have values', true)
  .action((opts) => {
    ensureVault();
    const secrets = vault.export(opts.scope, opts.onlySet);

    if (opts.json) {
      console.log(JSON.stringify(secrets));
      return;
    }

    switch (opts.format) {
      case 'shell':
        Object.entries(secrets).forEach(([k, v]) => {
          console.log(`export ${k}="${v}"`);
        });
        break;
      case 'dotenv':
        Object.entries(secrets).forEach(([k, v]) => {
          console.log(`${k}="${v}"`);
        });
        break;
      case 'docker':
        Object.entries(secrets).forEach(([k, v]) => {
          console.log(`-e ${k}="${v}"`);
        });
        break;
      case 'json':
        console.log(JSON.stringify(secrets, null, 2));
        break;
    }
  });

// ─── INJECT (Pipe into processes) ───────────────────────────────
program
  .command('inject <command...>')
  .description('Run a command with secrets injected as env vars')
  .option('--scope <scope>', 'Filter by scope')
  .action((command, opts) => {
    ensureVault();
    const { spawn } = require('child_process');
    const secrets = vault.export(opts.scope, true);
    const mergedEnv = { ...process.env, ...secrets };
    const cmd = command.join(' ');

    const child = spawn(cmd, {
      shell: true,
      stdio: 'inherit',
      env: mergedEnv
    });

    child.on('exit', (code) => process.exit(code || 0));
  });

// ─── AGENT API (for programmatic access by AI agents) ───────────
program
  .command('api <method> [args...]')
  .description('Agent API — programmatic access (JSON in/out)')
  .option('--stdin', 'Read params from stdin JSON')
  .action(async (method, args, opts) => {
    let params = {};

    if (opts.stdin) {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      params = JSON.parse(Buffer.concat(chunks).toString());
    }

    try {
      const result = await bridge.handle(method, args, params);
      console.log(JSON.stringify(result));
    } catch (err) {
      console.log(JSON.stringify({ error: err.message, code: err.code }));
      process.exit(1);
    }
  });

// ─── AUDIT LOG ──────────────────────────────────────────────────
program
  .command('audit')
  .description('View audit log')
  .option('-n, --last <count>', 'Show last N entries', '20')
  .option('--clear', 'Clear audit log')
  .action((opts) => {
    if (opts.clear) {
      audit.clear();
      console.log(chalk.green('✅ Audit log cleared'));
      return;
    }

    const entries = audit.getLast(parseInt(opts.last));

    if (opts.json) {
      console.log(JSON.stringify(entries));
      return;
    }

    const Table = require('cli-table3');
    const table = new Table({
      head: [
        chalk.cyan('Time'),
        chalk.cyan('Event'),
        chalk.cyan('Details')
      ],
      style: { head: [], border: [] }
    });

    entries.forEach(e => {
      table.push([
        new Date(e.timestamp).toLocaleString(),
        e.event,
        e.details ? JSON.stringify(e.details) : '-'
      ]);
    });

    console.log(chalk.bold('\n📋 Envlock Audit Log:\n'));
    console.log(table.toString());
  });

// ─── CONFIG ─────────────────────────────────────────────────────
program
  .command('config')
  .description('View or set configuration')
  .option('--set <key=value>', 'Set a config value')
  .option('--get <key>', 'Get a config value')
  .option('--reset', 'Reset to defaults')
  .action((opts) => {
    if (opts.reset) {
      config.reset();
      console.log(chalk.green('✅ Config reset to defaults'));
      return;
    }

    if (opts.set) {
      const [key, ...rest] = opts.set.split('=');
      config.set(key, rest.join('='));
      console.log(chalk.green(`✅ Set ${key}`));
      return;
    }

    if (opts.get) {
      const val = config.get(opts.get);
      console.log(opts.json ? JSON.stringify({ [opts.get]: val }) : val || '(not set)');
      return;
    }

    // Show all config
    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.cyan('Key'), chalk.cyan('Value')],
      style: { head: [], border: [] }
    });

    const all = config.getAll();
    Object.entries(all).forEach(([k, v]) => {
      table.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    });

    console.log(chalk.bold('\n⚙️  Envlock Configuration:\n'));
    console.log(table.toString());
  });

// ─── LOCK / UNLOCK ──────────────────────────────────────────────
program
  .command('lock')
  .description('Lock the vault (clear decrypted cache)')
  .action(() => {
    vault.lock();
    audit.log('vault_locked');
    console.log(chalk.green('🔒 Vault locked'));
  });

program
  .command('unlock')
  .description('Unlock the vault')
  .action(async () => {
    const inquirer = require('inquirer');
    const { password } = await inquirer.prompt([{
      type: 'password',
      name: 'password',
      message: '🔑 Master password:',
      mask: '*'
    }]);

    try {
      vault.unlock(password);
      audit.log('vault_unlocked');
      console.log(chalk.green('🔓 Vault unlocked'));
    } catch {
      console.log(chalk.red('❌ Invalid password'));
      process.exit(1);
    }
  });

// ─── ROTATE (change master password) ────────────────────────────
program
  .command('rotate')
  .description('Change master password and re-encrypt all secrets')
  .action(async () => {
    ensureVault();
    const inquirer = require('inquirer');
    const ora = require('ora');

    const { oldPassword } = await inquirer.prompt([{
      type: 'password',
      name: 'oldPassword',
      message: '🔑 Current master password:',
      mask: '*'
    }]);

    const { newPassword } = await inquirer.prompt([{
      type: 'password',
      name: 'newPassword',
      message: '🔑 New master password:',
      mask: '*'
    }]);

    const { confirmPassword } = await inquirer.prompt([{
      type: 'password',
      name: 'confirmPassword',
      message: '🔑 Confirm new password:',
      mask: '*'
    }]);

    if (newPassword !== confirmPassword) {
      console.log(chalk.red('❌ Passwords do not match'));
      process.exit(1);
    }

    const spinner = ora('🔐 Re-encrypting all secrets...').start();
    vault.rotatePassword(oldPassword, newPassword);
    audit.log('password_rotated');
    spinner.succeed(chalk.green('✅ Master password rotated successfully'));
  });

// ─── SHARE (export encrypted bundle) ────────────────────────────
program
  .command('share <name>')
  .description('Generate a shareable encrypted bundle for a secret')
  .option('--password <pwd>', 'Encryption password for the bundle')
  .action(async (name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    let pwd = opts.password;
    if (!pwd) {
      const inquirer = require('inquirer');
      const res = await inquirer.prompt([{
        type: 'password',
        name: 'pwd',
        message: '🔑 Set a password for the shared bundle:',
        mask: '*'
      }]);
      pwd = res.pwd;
    }

    const bundle = vault.createBundle(upperName, pwd);
    audit.log('secret_shared', { name: upperName });

    console.log(chalk.green(`✅ Shareable bundle created for ${chalk.bold(upperName)}:`));
    console.log(chalk.white(bundle));
    console.log(chalk.gray('\n💡 Share this bundle + the password with the recipient'));
    console.log(chalk.gray('   They can import it with: envlock import <bundle>'));
  });

// ─── IMPORT ─────────────────────────────────────────────────────
program
  .command('import <bundle>')
  .description('Import an encrypted bundle')
  .option('--password <pwd>', 'Decryption password')
  .action(async (bundle, opts) => {
    ensureVault();

    let pwd = opts.password;
    if (!pwd) {
      const inquirer = require('inquirer');
      const res = await inquirer.prompt([{
        type: 'password',
        name: 'pwd',
        message: '🔑 Bundle password:',
        mask: '*'
      }]);
      pwd = res.pwd;
    }

    try {
      const name = vault.importBundle(bundle, pwd);
      audit.log('secret_imported', { name });
      console.log(chalk.green(`✅ Imported: ${chalk.bold(name)}`));
    } catch (err) {
      console.log(chalk.red(`❌ Import failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── STATUS ─────────────────────────────────────────────────────
program
  .command('status')
  .description('Show vault status and summary')
  .action(() => {
    const Table = require('cli-table3');

    const table = new Table({
      style: { head: [], border: [] }
    });

    const exists = vault.exists();
    const locked = exists ? vault.isLocked() : null;
    const slots = exists ? vault.listSlots().length : 0;
    const setValues = exists ? vault.listSlots().filter(s => vault.hasValue(s.name)).length : 0;

    table.push(
      [chalk.cyan('Vault'), exists ? chalk.green('✅ Initialized') : chalk.red('❌ Not initialized')],
      [chalk.cyan('Status'), locked === true ? chalk.yellow('🔒 Locked') : locked === false ? chalk.green('🔓 Unlocked') : chalk.gray('N/A')],
      [chalk.cyan('Total Slots'), chalk.bold(slots)],
      [chalk.cyan('Values Set'), chalk.bold(setValues)],
      [chalk.cyan('Version'), '1.0.0']
    );

    console.log(chalk.bold('\n🔐 Envlock Status:\n'));
    console.log(table.toString());
  });

// ─── SERVE (Web UI) ────────────────────────────────────────────
program
  .command('serve')
  .description('Start web UI for users to input secrets via browser')
  .option('-p, --port <port>', 'Port to listen on (default: random)')
  .option('--no-open', 'Don\'t auto-open browser')
  .action(async (opts) => {
    ensureVault();
    const port = opts.port ? parseInt(opts.port) : 0;

    const info = await webui.start(port);
    audit.log('webui_started', { port: info.port });

    console.log(chalk.hex('#9b59b6').bold('\n🌐 Envlock Web UI is running!\n'));
    console.log(chalk.white('  Open this URL in your browser:\n'));
    console.log(chalk.green.bold(`  ${info.fullUrl}\n`));
    console.log(chalk.gray('  ─────────────────────────────────────'));
    console.log(chalk.gray('  This URL contains your access token.'));
    console.log(chalk.gray('  Share it only with trusted users.'));
    console.log(chalk.gray('  The server runs on localhost only.'));
    console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

    // Keep process alive
    process.on('SIGINT', () => {
      webui.stop();
      console.log(chalk.gray('\n🛑 Web UI stopped.'));
      process.exit(0);
    });

    // Prevent process from exiting
    setInterval(() => {}, 1000 * 60 * 60);
  });

// ─── TEMPLATES ─────────────────────────────────────────────────
program
  .command('templates')
  .description('List available credential templates')
  .option('-c, --category <cat>', 'Filter by category')
  .action((opts) => {
    if (opts.json) {
      const categories = listCategories();
      const templates = listTemplates(opts.category);
      console.log(JSON.stringify({ categories, templates }));
      return;
    }

    const Table = require('cli-table3');

    if (opts.category) {
      const templates = listTemplates(opts.category);
      const table = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Icon'), chalk.cyan('Fields')],
        style: { head: [], border: [] }
      });
      templates.forEach(t => table.push([t.id, t.name, t.icon, t.fieldCount]));
      console.log(chalk.bold(`\n📋 Templates (${opts.category}):\n`));
      console.log(table.toString());
    } else {
      const categories = listCategories();
      categories.forEach(cat => {
        const templates = listTemplates(cat.id);
        if (templates.length === 0) return;
        console.log(chalk.bold(`\n${cat.icon} ${cat.name} (${templates.length})`));
        templates.forEach(t => {
          console.log(`  ${t.icon}  ${chalk.white(t.id.padEnd(18))} ${chalk.gray(t.name)} ${chalk.gray(`(${t.fieldCount} fields)`)}`);
        });
      });
      console.log(chalk.gray(`\n💡 Use: envlock templates -c <category>`));
      console.log(chalk.gray(`💡 Use: envlock from-template <id> to add credentials\n`));
    }
  });

// ─── FROM-TEMPLATE (quick-add from template) ───────────────────
program
  .command('from-template <templateId>')
  .description('Add credentials from a template (interactive)')
  .action(async (templateId) => {
    ensureVault();
    const template = getTemplate(templateId);
    if (!template) {
      console.log(chalk.red(`❌ Template "${templateId}" not found. Run \`envlock templates\` to see available ones.`));
      process.exit(1);
    }

    const inquirer = require('inquirer');
    console.log(chalk.hex('#9b59b6').bold(`\n${template.icon} ${template.name}\n`));

    const answers = {};
    for (const field of template.fields) {
      const promptType = field.type === 'secret' ? 'password' : 'input';
      const { value } = await inquirer.prompt([{
        type: promptType,
        name: 'value',
        message: `${field.label}${field.required ? ' (required)' : ''}:`,
        mask: field.type === 'secret' ? '*' : undefined,
        default: field.placeholder || undefined
      }]);
      if (value) answers[field.name] = value;
    }

    // Save all fields
    const results = [];
    for (const [name, value] of Object.entries(answers)) {
      if (!vault.has(name)) {
        vault.createSlot({
          name,
          description: `${template.name} — ${name}`,
          type: 'api_key',
          scope: 'global',
          createdAt: new Date().toISOString()
        });
      }
      vault.set(name, value);
      results.push(name);
    }

    audit.log('template_used', { template: templateId, count: results.length });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, saved: results }));
    } else {
      console.log(chalk.green(`\n✅ Saved ${results.length} secrets from ${template.icon} ${template.name}:`));
      results.forEach(r => console.log(chalk.white(`  🔑 ${r}`)));
    }
  });

// ─── IMPORT-ENV (import .env file) ─────────────────────────────
program
  .command('import-env <filepath>')
  .description('Import secrets from a .env file')
  .action(async (filepath) => {
    ensureVault();
    const fs = require('fs');
    const path = require('path');

    const fullPath = path.resolve(filepath);
    if (!fs.existsSync(fullPath)) {
      console.log(chalk.red(`❌ File not found: ${fullPath}`));
      process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const imported = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, name, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, '').trim();
      if (!value) continue;

      const upperName = name.toUpperCase();
      if (!vault.has(upperName)) {
        vault.createSlot({
          name: upperName,
          description: `Imported from ${filepath}: ${upperName}`,
          type: 'api_key',
          scope: 'global',
          createdAt: new Date().toISOString()
        });
      }
      vault.set(upperName, value);
      imported.push(upperName);
    }

    audit.log('env_imported', { file: filepath, count: imported.length });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, imported }));
    } else {
      console.log(chalk.green(`\n✅ Imported ${imported.length} secrets from ${filepath}:`));
      imported.forEach(r => console.log(chalk.white(`  🔑 ${r}`)));
    }
  });

// ─── GENERATE (Password / Key / Token) ─────────────────────────
program
  .command('generate')
  .alias('gen')
  .description('Generate passwords, API keys, tokens, or UUIDs')
  .option('-l, --length <n>', 'Password length', '32')
  .option('-t, --type <type>', 'Type: password | apikey | token | uuid', 'password')
  .option('--prefix <prefix>', 'Prefix for API keys')
  .option('--no-uppercase', 'Exclude uppercase letters')
  .option('--no-lowercase', 'Exclude lowercase letters')
  .option('--no-numbers', 'Exclude numbers')
  .option('--no-symbols', 'Exclude symbols')
  .option('--exclude-ambiguous', 'Exclude ambiguous chars (0, O, l, 1, I)')
  .option('--save <name>', 'Save generated value as a secret')
  .action((opts) => {
    let value;
    const length = parseInt(opts.length);

    switch (opts.type) {
      case 'apikey':
        value = PasswordGenerator.generateApiKey(opts.prefix);
        break;
      case 'token':
        value = PasswordGenerator.generateToken(length);
        break;
      case 'uuid':
        value = PasswordGenerator.generateUUID();
        break;
      default:
        value = PasswordGenerator.generate({
          length,
          uppercase: opts.uppercase !== false,
          lowercase: opts.lowercase !== false,
          numbers: opts.numbers !== false,
          symbols: opts.symbols !== false,
          excludeAmbiguous: opts.excludeAmbiguous || false
        });
    }

    const strength = PasswordGenerator.analyzeStrength(value);

    if (opts.json) {
      console.log(JSON.stringify({ value, strength }));
    } else {
      console.log(chalk.hex('#9b59b6').bold(`\n🔐 Generated ${opts.type}:\n`));
      console.log(chalk.white.bold(`  ${value}\n`));
      console.log(chalk.gray(`  Length: ${value.length} chars`));
      console.log(chalk.gray(`  Strength: ${strength.label}`));
      if (strength.feedback.length) {
        console.log(chalk.gray(`  Notes: ${strength.feedback.join(', ')}`));
      }
    }

    // Save if requested
    if (opts.save) {
      ensureVault();
      const name = opts.save.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!vault.has(name)) {
        vault.createSlot({
          name,
          description: `Generated ${opts.type}`,
          type: 'api_key',
          scope: 'global',
          createdAt: new Date().toISOString()
        });
      }
      vault.set(name, value);
      audit.log('generated_and_saved', { name, type: opts.type });
      if (!opts.json) console.log(chalk.green(`\n  ✅ Saved as: ${name}`));
    }
  });

// ─── STRENGTH (Analyze password strength) ──────────────────────
program
  .command('strength [password]')
  .description('Analyze password/key strength')
  .action((password, opts) => {
    const pwd = password || process.env.TEST_PASSWORD;
    if (!pwd) {
      const inquirer = require('inquirer');
      inquirer.prompt([{
        type: 'password',
        name: 'pwd',
        message: '🔑 Enter password to analyze:',
        mask: '*'
      }]).then(({ pwd }) => {
        const result = PasswordGenerator.analyzeStrength(pwd);
        displayStrength(result, opts.json);
      });
      return;
    }

    const result = PasswordGenerator.analyzeStrength(pwd);
    displayStrength(result, opts.json);
  });

function displayStrength(result, isJson) {
  if (isJson) {
    console.log(JSON.stringify(result));
    return;
  }
  console.log(chalk.hex('#9b59b6').bold('\n💪 Password Strength Analysis:\n'));
  console.log(`  Score:     ${result.label}`);
  console.log(`  Entropy:   ~${result.entropy} bits`);
  console.log(`  Length:    ${result.length} chars`);
  if (result.feedback.length) {
    console.log(`  Feedback:`);
    result.feedback.forEach(f => console.log(chalk.yellow(`    ⚠️  ${f}`)));
  }
}

// ─── PROFILES (Environment profiles) ───────────────────────────
program
  .command('profiles')
  .description('Manage environment profiles (dev/staging/prod)')
  .option('--create <id>', 'Create a new profile')
  .option('--delete <id>', 'Delete a profile')
  .option('--diff <id1,id2>', 'Compare two profiles')
  .action((opts) => {
    if (opts.create) {
      const profile = profiles.create(opts.create, { name: opts.create });
      audit.log('profile_created', { id: opts.create });
      console.log(chalk.green(`✅ Profile "${opts.create}" created`));
      return;
    }

    if (opts.delete) {
      profiles.delete(opts.delete);
      audit.log('profile_deleted', { id: opts.delete });
      console.log(chalk.green(`✅ Profile "${opts.delete}" deleted`));
      return;
    }

    if (opts.diff) {
      const [id1, id2] = opts.diff.split(',');
      const diff = profiles.diff(id1.trim(), id2.trim());
      if (opts.json) { console.log(JSON.stringify(diff)); return; }

      console.log(chalk.hex('#9b59b6').bold(`\n🔀 Diff: ${id1} ↔ ${id2}\n`));
      if (diff.onlyIn1.length) {
        console.log(chalk.red(`  Only in ${id1}:`));
        diff.onlyIn1.forEach(k => console.log(`    - ${k}`));
      }
      if (diff.onlyIn2.length) {
        console.log(chalk.green(`  Only in ${id2}:`));
        diff.onlyIn2.forEach(k => console.log(`    + ${k}`));
      }
      if (diff.different.length) {
        console.log(chalk.yellow(`  Different values:`));
        diff.different.forEach(k => console.log(`    ≠ ${k}`));
      }
      if (diff.shared.length) {
        console.log(chalk.gray(`  Same: ${diff.shared.join(', ')}`));
      }
      return;
    }

    // List profiles
    const list = profiles.list();
    if (opts.json) { console.log(JSON.stringify(list)); return; }

    if (list.length === 0) {
      console.log(chalk.yellow('📭 No profiles yet. Create one with: envlock profiles --create dev'));
      return;
    }

    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Secrets'), chalk.cyan('Created')],
      style: { head: [], border: [] }
    });
    list.forEach(p => table.push([p.id, p.name, p.secretCount, new Date(p.createdAt).toLocaleDateString()]));
    console.log(chalk.bold('\n📁 Environment Profiles:\n'));
    console.log(table.toString());
  });

// ─── HISTORY (Track changes) ───────────────────────────────────
program
  .command('history [name]')
  .description('View change history for secrets')
  .option('-n, --last <count>', 'Show last N entries', '10')
  .option('--clear', 'Clear history')
  .action((name, opts) => {
    if (opts.clear) {
      history.clear(name);
      console.log(chalk.green('✅ History cleared'));
      return;
    }

    if (name) {
      const entries = history.get(name.toUpperCase(), parseInt(opts.last));
      if (opts.json) { console.log(JSON.stringify(entries)); return; }

      if (entries.length === 0) {
        console.log(chalk.gray(`📭 No history for ${name.toUpperCase()}`));
        return;
      }

      console.log(chalk.hex('#9b59b6').bold(`\n📜 History for ${name.toUpperCase()}:\n`));
      entries.forEach(e => {
        console.log(chalk.gray(`  ${new Date(e.timestamp).toLocaleString()} — ${e.action}`));
      });
    } else {
      const all = history.getAll(parseInt(opts.last));
      if (opts.json) { console.log(JSON.stringify(all)); return; }

      if (all.length === 0) {
        console.log(chalk.gray('📭 No history yet'));
        return;
      }

      const Table = require('cli-table3');
      const table = new Table({
        head: [chalk.cyan('Secret'), chalk.cyan('Last Change'), chalk.cyan('Action'), chalk.cyan('Total Changes')],
        style: { head: [], border: [] }
      });
      all.forEach(h => table.push([
        h.name,
        new Date(h.lastChange.timestamp).toLocaleString(),
        h.lastChange.action,
        h.changeCount
      ]));
      console.log(chalk.bold('\n📜 Change History:\n'));
      console.log(table.toString());
    }
  });

// ─── HEALTH (Check credential validity) ────────────────────────
program
  .command('health [name]')
  .description('Check credential health and format validity')
  .action(async (name, opts) => {
    ensureVault();

    let secrets;
    if (name) {
      const upperName = name.toUpperCase();
      secrets = { [upperName]: vault.get(upperName) };
    } else {
      secrets = vault.export(null, true);
    }

    const results = await HealthChecker.batchCheck(secrets);

    if (opts.json) {
      console.log(JSON.stringify(results));
      return;
    }

    console.log(chalk.hex('#9b59b6').bold('\n🏥 Credential Health Check:\n'));

    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.cyan('Secret'), chalk.cyan('Format'), chalk.cyan('Details')],
      style: { head: [], border: [] }
    });

    results.forEach(r => {
      const status = r.format.valid ? chalk.green('✅ Valid') : chalk.yellow('⚠️  Check');
      const details = r.format.checks ? r.format.checks.join(', ') : (r.format.service || '—');
      table.push([r.name, status, details]);
    });

    console.log(table.toString());
  });

// ─── BACKUP / RESTORE ──────────────────────────────────────────
program
  .command('backup')
  .description('Create an encrypted backup of the vault')
  .option('--password <pwd>', 'Backup encryption password')
  .action(async (opts) => {
    ensureVault();

    let pwd = opts.password;
    if (!pwd) {
      const inquirer = require('inquirer');
      const res = await inquirer.prompt([{
        type: 'password',
        name: 'pwd',
        message: '🔑 Backup password:',
        mask: '*'
      }]);
      pwd = res.pwd;
    }

    const result = backup.create(pwd);
    audit.log('backup_created', { id: result.id });

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(chalk.green(`\n✅ Backup created: ${chalk.bold(result.id)}`));
      console.log(chalk.gray(`   Path: ${result.path}`));
      console.log(chalk.gray(`   Files: ${result.files.join(', ')}`));
    }
  });

program
  .command('restore <backupId>')
  .description('Restore a vault from backup')
  .option('--password <pwd>', 'Backup decryption password')
  .action(async (backupId, opts) => {
    let pwd = opts.password;
    if (!pwd) {
      const inquirer = require('inquirer');
      const res = await inquirer.prompt([{
        type: 'password',
        name: 'pwd',
        message: '🔑 Backup password:',
        mask: '*'
      }]);
      pwd = res.pwd;
    }

    try {
      const result = backup.restore(backupId, pwd);
      audit.log('backup_restored', { id: backupId });

      if (opts.json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(chalk.green(`\n✅ Restored from: ${chalk.bold(result.id)}`));
        console.log(chalk.gray(`   Files: ${result.files.join(', ')}`));
      }
    } catch (err) {
      console.log(chalk.red(`❌ Restore failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('backups')
  .description('List available backups')
  .action((opts) => {
    const list = backup.list();
    if (opts.json) { console.log(JSON.stringify(list)); return; }

    if (list.length === 0) {
      console.log(chalk.gray('📭 No backups yet. Create one with: envlock backup'));
      return;
    }

    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Size'), chalk.cyan('Created')],
      style: { head: [], border: [] }
    });
    list.forEach(b => table.push([b.id, `${(b.size / 1024).toFixed(1)} KB`, new Date(b.createdAt).toLocaleString()]));
    console.log(chalk.bold('\n💾 Backups:\n'));
    console.log(table.toString());
  });

// ─── TAGS (Organize secrets) ───────────────────────────────────
program
  .command('tag <name> <tags...>')
  .description('Add tags to a secret for organization')
  .action((name, tags, opts) => {
    ensureVault();
    const upperName = name.toUpperCase();
    if (!vault.has(upperName)) {
      console.log(chalk.red(`❌ Secret "${upperName}" not found`));
      process.exit(1);
    }

    vault.addTags(upperName, tags);
    audit.log('tagged', { name: upperName, tags });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, name: upperName, tags }));
    } else {
      console.log(chalk.green(`✅ Tagged ${upperName}: ${tags.join(', ')}`));
    }
  });

// ─── FAVORITES (Pin frequently used) ───────────────────────────
program
  .command('fav <name>')
  .alias('favorite')
  .description('Toggle favorite status for a secret')
  .action((name, opts) => {
    ensureVault();
    const upperName = name.toUpperCase();
    if (!vault.has(upperName)) {
      console.log(chalk.red(`❌ Secret "${upperName}" not found`));
      process.exit(1);
    }

    const isFav = vault.toggleFavorite(upperName);
    audit.log('favorite_toggled', { name: upperName, favorite: isFav });

    if (opts.json) {
      console.log(JSON.stringify({ success: true, name: upperName, favorite: isFav }));
    } else {
      console.log(isFav
        ? chalk.green(`⭐ ${upperName} added to favorites`)
        : chalk.gray(`☆ ${upperName} removed from favorites`)
      );
    }
  });

// ─── SEARCH ────────────────────────────────────────────────────
program
  .command('search <query>')
  .alias('find')
  .description('Search secrets by name, description, or tags')
  .action((query, opts) => {
    ensureVault();
    const results = vault.search(query);

    if (opts.json) {
      console.log(JSON.stringify(results));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.gray(`📭 No secrets matching "${query}"`));
      return;
    }

    console.log(chalk.hex('#9b59b6').bold(`\n🔍 Search results for "${query}":\n`));
    results.forEach(r => {
      const hasVal = vault.hasValue(r.name) ? chalk.green('✅') : chalk.gray('⬜');
      const fav = r.favorite ? chalk.yellow('⭐') : '  ';
      console.log(`  ${hasVal} ${fav} ${chalk.bold(r.name)} — ${chalk.gray(r.description || '-')}`);
    });
  });

// ─── HELPERS ────────────────────────────────────────────────────
function ensureVault() {
  if (!vault.exists()) {
    console.log(chalk.red('❌ Vault not initialized. Run `envlock init` first.'));
    process.exit(1);
  }
  if (vault.isLocked()) {
    console.log(chalk.yellow('🔒 Vault is locked. Run `envlock unlock` first.'));
    process.exit(1);
  }
}

// ─── Parse ──────────────────────────────────────────────────────
program.parse();
