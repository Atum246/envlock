<p align="center">
  <pre align="center">
  ███████╗███╗   ██╗██╗   ██╗██╗      ██████╗  ██████╗██╗  ██╗
  ██╔════╝████╗  ██║██║   ██║██║     ██╔═══██╗██╔════╝██║ ██╔╝
  █████╗  ██╔██╗ ██║██║   ██║██║     ██║   ██║██║     █████╔╝
  ██╔══╝  ██║╚██╗██║██║   ██║██║     ██║   ██║██║     ██╔═██╗
  ███████╗██║ ╚████║╚██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗
  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝
  </pre>
</p>

<p align="center">
  <strong>🔐 Secure Credential Vault for AI Agents</strong>
</p>

<p align="center">
  <code>npm install -g envlock</code>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-for-ai-agents">For AI Agents</a> •
  <a href="#-web-ui">Web UI</a> •
  <a href="#-46-service-templates">Templates</a> •
  <a href="#-commands">Commands</a> •
  <a href="#-security">Security</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

<p align="center">
  <pre align="center">
       .-"""-.
      /        \
     |  .--.  |
     | |    | |
     | | 🔒 | |
     | |    | |
     |  '--'  |
      \      /
       '-..-'
  </pre>
</p>

> **Stop pasting API keys into chat. Store them securely. Let your AI agent access them safely.**

---

## 🤔 The Problem

Every day, millions of users paste API keys, tokens, passwords, and credentials directly into AI chat interfaces. This is **dangerous**:

| Risk | What Happens |
|------|-------------|
| 📝 **Conversation History** | Keys get stored on AI provider servers — forever |
| 🔓 **Data Breaches** | If the provider gets hacked, your keys are exposed |
| 🎣 **Prompt Injection** | Malicious prompts can trick the AI into leaking your keys |
| 🤖 **Training Data** | Keys might end up in model training data |
| 👀 **Screen Sharing** | Anyone who sees the chat sees your secrets |
| 💀 **No Revocation** | You can't "un-paste" a key from chat history |

## 💡 The Solution: Envlock

Envlock is a **secure local vault** that sits between users and AI agents. Instead of pasting keys into chat, users input them through a **secure web form**, and AI agents read them through a **safe API**.

```
❌ OLD WAY:
User → [pastes key in chat] → AI Agent → External API
         ↑
    Key exposed in chat history, logs, training data

✅ ENVLOCK WAY:
User → [pastes key in web form] → Encrypted Vault → AI Agent → External API
              ↑                         ↑
    Never enters chat            Encrypted at rest
    Localhost only               Agent reads via API
```

---

## ⚡ Quick Start

### For AI Agents (Primary Use Case)

AI agents install and manage Envlock themselves. Users only interact through the web UI.

```bash
# 1. AI Agent installs Envlock
npm install -g envlock

# 2. Agent initializes the vault
envlock init

# 3. Agent starts the web UI
envlock serve

# 4. Agent tells user: "Open this link to add your keys"
# → http://127.0.0.1:3847/?token=abc123...

# 5. User opens link, picks a service, pastes key
# → Key stored in encrypted vault (never in chat!)

# 6. Agent reads the key when needed
envlock get OPENAI_API_KEY
```

### The Complete Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │   Envlock    │         │  AI Agent   │
│             │         │   (Vault)    │         │             │
│ Opens link  │────────▶│ Web form     │         │             │
│ Picks svc   │         │ AES-256      │         │             │
│ Pastes key  │────────▶│ Encrypts     │         │             │
│             │         │ Stores       │         │             │
│             │         │              │◀────────│ Reads key   │
│             │         │              │         │ Calls API   │
│             │         │              │         │ Done ✅     │
└─────────────┘         └──────────────┘         └─────────────┘

Key NEVER enters chat. Key NEVER leaves localhost. Key is ALWAYS encrypted.
```

---

## 🤖 For AI Agents

Envlock is designed **specifically for AI agents** to install and manage. Here's how different agents use it:

### OpenClaw

```bash
# OpenClaw agent runs:
npm install -g envlock && envlock init

# Agent starts web UI, gets URL
envlock serve
# → "Open http://127.0.0.1:3847/?token=xxx to add your keys"

# Agent tells user the URL
# User opens link, adds keys
# Agent reads keys via:
envlock get OPENAI_API_KEY --raw
```

### Claude Code

```bash
# Claude Code can install and use Envlock:
npm install -g envlock

# Initialize vault
envlock init

# Create slots for needed keys
envlock create ANTHROPIC_API_KEY -d "Anthropic API key" -t api_key

# Start web UI for user input
envlock serve

# Later, read keys programmatically
envlock api get ANTHROPIC_API_KEY --json
```

### Cursor / Windsurf / Any AI Agent

```bash
# Any AI agent can use the JSON API
envlock api list --json
envlock api get KEY_NAME --json
envlock api create NEW_KEY --json
envlock api set NEW_KEY --json
envlock api export --json
```

### Agent API Reference

All agent API calls return JSON and support `--json` flag:

```bash
# List all secrets
envlock api list --json
# → {"success": true, "slots": [{"name": "OPENAI_API_KEY", "type": "api_key", ...}]}

# Get a specific secret
envlock api get OPENAI_API_KEY --json
# → {"success": true, "slot": "OPENAI_API_KEY", "value": "sk-..."}

# Create a new slot
envlock api create NEW_KEY --json
# → {"success": true, "slot": "NEW_KEY"}

# Set a value
envlock api set NEW_KEY --json
# → {"success": true, "slot": "NEW_KEY"}

# Export all secrets as env vars
envlock api export --json
# → {"success": true, "secrets": {"KEY1": "val1", "KEY2": "val2"}}

# Check vault status
envlock api status --json
# → {"success": true, "initialized": true, "locked": false, "slots": 5}
```

### Agent Permissions

When registering agents, you can set granular permissions:

```bash
# Register with specific permissions
envlock api register --json
# Permissions: read, list, write, create, delete, execute

# Scoped access — agent only sees specific slots
envlock api register --json
# allowedSlots: ["OPENAI_API_KEY", "STRIPE_KEY"]
```

---

## 🌐 Web UI

The web UI is the **killer feature** — users paste secrets in a clean browser form instead of chat.

```bash
envlock serve
```

```
🌐 Envlock Web UI is running!

  Open this URL in your browser:

  http://127.0.0.1:3847/?token=abc123def456...

  ─────────────────────────────────────
  This URL contains your access token.
  Share it only with trusted users.
  The server runs on localhost only.
  Press Ctrl+C to stop.
```

### Web UI Features

| Feature | Description |
|---------|-------------|
| 🎨 **Clean Dark UI** | Purple-themed, minimal, not generic AI slop |
| 📋 **46 Templates** | Pick OpenAI, Stripe, Discord, AWS, etc. |
| 📝 **Bulk Add** | Paste multiple `NAME=value` pairs at once |
| 📥 **Import .env** | Paste your existing `.env` file |
| 🔐 **Encrypted** | All data encrypted immediately |
| 🏠 **Localhost Only** | Never exposed to the internet |
| 🔑 **Token Protected** | URL contains one-time access token |

### Web UI Screenshots

**Dashboard:**
```
┌──────────────────────────────────────────────┐
│  🔐 Envlock          5 secrets    [+ Add]    │
├──────────────────────────────────────────────┤
│  Your Secrets                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 🔑      │ │ 🎫      │ │ 🔒      │        │
│  │ OPENAI  │ │ STRIPE  │ │ DB_URL  │        │
│  │ ✅ Set  │ │ ✅ Set  │ │ ✅ Set  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  Add by Service                              │
│  🤖 AI & Machine Learning                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │OpenAI│ │Anthro│ │Gemini│ │ HF  │           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
│  📱 Social Media                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │Twittr│ │Discrd│ │Telegr│ │Slack│           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
└──────────────────────────────────────────────┘
```

**Add Secret Form (e.g., OpenAI):**
```
┌──────────────────────────────────────────────┐
│  ← Back        🤖 OpenAI                     │
├──────────────────────────────────────────────┤
│                                              │
│  API Key *                                   │
│  ┌──────────────────────────────────────┐    │
│  │ sk-...                          👁️  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Organization ID                             │
│  ┌──────────────────────────────────────┐    │
│  │ org-...                             │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │        🔐 Save Securely              │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## 📦 46 Service Templates

Pre-built forms so users don't have to figure out field names. Agents can use templates programmatically:

```bash
# List all templates
envlock templates

# List by category
envlock templates -c social

# Use a template interactively
envlock from-template openai

# Use via web UI
# → http://127.0.0.1:PORT/add?template=openai&token=xxx
```

### 🤖 AI & Machine Learning (5)
| ID | Service | Fields |
|----|---------|--------|
| `openai` | OpenAI | API Key, Org ID |
| `anthropic` | Anthropic (Claude) | API Key |
| `google-ai` | Google AI (Gemini) | API Key |
| `huggingface` | Hugging Face | Access Token |
| `replicate` | Replicate | API Token |

### 📱 Social Media (11)
| ID | Service | Fields |
|----|---------|--------|
| `twitter` | Twitter / X | API Key, API Secret, Access Token, Access Secret, Bearer Token |
| `discord` | Discord | Bot Token, Client ID, Client Secret |
| `telegram` | Telegram | Bot Token, Chat ID |
| `slack` | Slack | Bot Token, App Token, Webhook URL |
| `instagram` | Instagram | Username, Password, Access Token |
| `facebook` | Facebook / Meta | Access Token, App ID, App Secret |
| `linkedin` | LinkedIn | Access Token, Client ID, Client Secret |
| `youtube` | YouTube / Google | API Key, Client ID, Client Secret, Refresh Token |
| `tiktok` | TikTok | Access Token, Client Key, Client Secret |
| `reddit` | Reddit | Client ID, Client Secret, Username, Password |
| `pinterest` | Pinterest | Access Token, App ID |

### 🛠️ Developer Tools (1)
| ID | Service | Fields |
|----|---------|--------|
| `github` | GitHub | Personal Access Token, Username |

### ☁️ Cloud & Infrastructure (7)
| ID | Service | Fields |
|----|---------|--------|
| `aws` | AWS | Access Key ID, Secret Access Key, Region, Session Token |
| `gcp` | Google Cloud | Project ID, Service Account JSON |
| `azure` | Azure | Client ID, Client Secret, Tenant ID, Subscription ID |
| `vercel` | Vercel | API Token |
| `netlify` | Netlify | Auth Token |
| `digitalocean` | DigitalOcean | API Token |
| `flyio` | Fly.io | API Token |

### 🗄️ Databases (6)
| ID | Service | Fields |
|----|---------|--------|
| `postgres` | PostgreSQL | Connection URL, Host, Port, User, Password, Database |
| `mysql` | MySQL | Connection URL, Host, User, Password, Database |
| `mongodb` | MongoDB | Connection URI |
| `redis` | Redis | Connection URL |
| `firebase` | Firebase | API Key, Auth Domain, Project ID, Service Account |
| `supabase` | Supabase | Project URL, Anon Key, Service Role Key |

### 💳 Payments (2)
| ID | Service | Fields |
|----|---------|--------|
| `stripe` | Stripe | Secret Key, Publishable Key, Webhook Secret |
| `paypal` | PayPal | Client ID, Client Secret, Mode |

### 📧 Email & Communication (3)
| ID | Service | Fields |
|----|---------|--------|
| `sendgrid` | SendGrid | API Key |
| `mailgun` | Mailgun | API Key, Domain |
| `twilio` | Twilio | Account SID, Auth Token, Phone Number |

### 📊 Analytics & Monitoring (3)
| ID | Service | Fields |
|----|---------|--------|
| `datadog` | Datadog | API Key, Application Key |
| `sentry` | Sentry | DSN, Auth Token |
| `newrelic` | New Relic | License Key, App Name |

### 🚀 DevOps & CI/CD (2)
| ID | Service | Fields |
|----|---------|--------|
| `docker` | Docker Hub | Username, Password |
| `npm` | npm | Access Token |

### 🛡️ VPN & Network (2)
| ID | Service | Fields |
|----|---------|--------|
| `vpn` | VPN Credentials | Server, Username, Password, Config |
| `ssh` | SSH Key | Host, Username, Private Key, Passphrase |

### 🔧 Custom / Generic (4)
| ID | Service | Fields |
|----|---------|--------|
| `api-key` | Generic API Key | API Key, API Secret, Base URL |
| `oauth` | OAuth Credentials | Client ID, Client Secret, Redirect URI, Access Token, Refresh Token |
| `basic-auth` | Username & Password | Username, Password |
| `bearer-token` | Bearer Token | Token, Base URL |

---

## 📋 Commands

### Core Vault

| Command | Description |
|---------|-------------|
| `envlock init` | Initialize vault with master password |
| `envlock create <name>` | Create a new secret slot |
| `envlock set <name>` | Set value for a secret |
| `envlock get <name>` | Retrieve a secret |
| `envlock delete <name>` | Delete a secret |
| `envlock list` | List all secret slots |
| `envlock status` | Show vault status |

### Web UI & Templates

| Command | Description |
|---------|-------------|
| `envlock serve` | 🌐 Start web UI for users to input secrets |
| `envlock templates` | 📋 List 46 service templates |
| `envlock from-template <id>` | ➕ Add credentials from a template |
| `envlock import-env <file>` | 📥 Import secrets from a .env file |

### Generation & Analysis

| Command | Description |
|---------|-------------|
| `envlock generate` | 🔐 Generate passwords, API keys, tokens, UUIDs |
| `envlock strength [pwd]` | 💪 Analyze password strength |
| `envlock health [name]` | 🏥 Check credential format validity |

### Organization

| Command | Description |
|---------|-------------|
| `envlock search <query>` | 🔍 Search secrets by name, description, or tags |
| `envlock tag <name> <tags>` | 🏷️ Add tags to a secret |
| `envlock fav <name>` | ⭐ Toggle favorite status |
| `envlock history [name]` | 📜 View change history |
| `envlock profiles` | 📁 Manage environment profiles (dev/staging/prod) |

### Security & Sharing

| Command | Description |
|---------|-------------|
| `envlock lock` | 🔒 Lock the vault |
| `envlock unlock` | 🔓 Unlock the vault |
| `envlock rotate` | 🔄 Change master password |
| `envlock backup` | 💾 Create encrypted backup |
| `envlock restore <id>` | ♻️ Restore from backup |
| `envlock backups` | 📋 List backups |
| `envlock share <name>` | 🔗 Create shareable encrypted bundle |
| `envlock import <bundle>` | 📥 Import encrypted bundle |

### Export & Injection

| Command | Description |
|---------|-------------|
| `envlock export` | Export secrets as env vars (shell/dotenv/docker/json) |
| `envlock inject <cmd>` | Run a command with secrets injected |
| `envlock api <method>` | 🤖 Agent API (JSON in/out) |

### System

| Command | Description |
|---------|-------------|
| `envlock audit` | 📋 View audit log |
| `envlock config` | ⚙️ View/set configuration |

---

## 🔒 Security

### Encryption

| Layer | Algorithm | Details |
|-------|-----------|---------|
| **Vault** | AES-256-CBC | All secrets encrypted at rest |
| **Key Derivation** | PBKDF2 | 100,000 iterations, SHA-256 |
| **File Permissions** | `0600` | Owner-only read/write |
| **Web UI** | Token-protected | One-time access token in URL |
| **Network** | Localhost only | Never exposed to internet |

### What Gets Stored

```
~/.envlock/
├── vault.enc           # 🔐 Your encrypted secrets
├── slots.enc           # 🔐 Slot metadata (names, types, tags)
├── meta.json           # 📋 Vault metadata
├── config.json         # ⚙️ Configuration
├── audit.json          # 📋 Audit log
├── agents.json         # 🤖 Registered agents
├── agent-requests.json # 📝 Pending access requests
├── profiles/           # 📁 Environment profiles
├── history/            # 📜 Change history
└── backups/            # 💾 Encrypted backups
```

### Audit Log

Every action is logged with timestamp and details:

```bash
envlock audit
```

```
📋 Envlock Audit Log:

┌─────────────────────────────┬─────────────────┬───────────────────┐
│ Time                        │ Event           │ Details           │
├─────────────────────────────┼─────────────────┼───────────────────┤
│ 5/2/2026, 4:30:00 AM       │ vault_init      │ -                 │
│ 5/2/2026, 4:30:05 AM       │ slot_created    │ {"name":"OPENAI"} │
│ 5/2/2026, 4:30:10 AM       │ secret_set      │ {"name":"OPENAI"} │
│ 5/2/2026, 4:31:00 AM       │ secret_accessed │ {"name":"OPENAI"} │
│ 5/2/2026, 4:32:00 AM       │ webui_started   │ {"port":3847}     │
└─────────────────────────────┴─────────────────┴───────────────────┘
```

---

## 🎯 Export Formats

```bash
# Shell
envlock export --format shell
export OPENAI_API_KEY="sk-..."
export STRIPE_SECRET_KEY="sk_live_..."

# dotenv
envlock export --format dotenv
OPENAI_API_KEY="sk-..."
STRIPE_SECRET_KEY="sk_live_..."

# Docker
envlock export --format docker
-e OPENAI_API_KEY="sk-..." -e STRIPE_SECRET_KEY="sk_live_..."

# JSON
envlock export --format json
{"OPENAI_API_KEY": "sk-...", "STRIPE_SECRET_KEY": "sk_live_..."}
```

### Inject into Commands

```bash
# Run any command with secrets as env vars
envlock inject node app.js
envlock inject python main.py
envlock inject docker compose up
```

---

## 🔐 Password Generator

Generate secure passwords, API keys, tokens, and UUIDs:

```bash
# Generate a password
envlock generate --type password --length 32

# Generate an API key with prefix
envlock generate --type apikey --prefix sk

# Generate a token
envlock generate --type token --length 64

# Generate a UUID
envlock generate --type uuid

# Generate and save directly
envlock generate --type password --length 24 --save MY_PASSWORD

# Analyze password strength
envlock strength "MyP@ssw0rd!"
# → Score: 🔐 Excellent
# → Entropy: ~72 bits
# → Length: 12 chars
```

---

## 📁 Environment Profiles

Manage separate secrets for different environments:

```bash
# Create profiles
envlock profiles --create dev
envlock profiles --create staging
envlock profiles --create prod

# List profiles
envlock profiles

# Compare profiles
envlock profiles --diff dev,prod
```

---

## 🏥 Health Checks

Validate that your credentials are correctly formatted:

```bash
# Check all secrets
envlock health

# Check a specific secret
envlock health OPENAI_API_KEY
```

```
🏥 Credential Health Check:

┌────────────────────┬──────────┬──────────┐
│ Secret             │ Format   │ Details  │
├────────────────────┼──────────┼──────────┤
│ OPENAI_API_KEY     │ ✅ Valid │ OpenAI   │
│ GITHUB_TOKEN       │ ✅ Valid │ GitHub   │
│ SHORT_KEY          │ ⚠️ Check │ Too short│
└────────────────────┴──────────┴──────────┘
```

---

## 🏗️ Architecture

```
envlock/
├── src/
│   ├── index.js              # Main CLI (33 commands)
│   └── lib/
│       ├── vault.js          # 🔐 Core encrypted vault
│       ├── agent-bridge.js   # 🤖 Agent API system
│       ├── web-ui.js         # 🌐 Web server + UI
│       ├── templates.js      # 📦 46 service templates
│       ├── password-gen.js   # 🔐 Password generator
│       ├── profiles.js       # 📁 Environment profiles
│       ├── history.js        # 📜 Change history
│       ├── health-check.js   # 🏥 Credential validation
│       ├── backup.js         # 💾 Backup/restore
│       ├── audit.js          # 📋 Audit logging
│       ├── config.js         # ⚙️ Configuration
│       └── logo.js           # 🎨 ASCII art
├── tests/
│   └── test.js               # ✅ 42 tests
├── README.md
├── LICENSE                   # MIT
└── package.json
```

---

## 🤝 Contributing

1. Fork it
2. Create your branch (`git checkout -b feature/awesome`)
3. Commit (`git commit -m 'Add awesome feature'`)
4. Push (`git push origin feature/awesome`)
5. Open a PR

---

## 📄 License

MIT © [Envlock Contributors](https://github.com/envlock/envlock)

---

<p align="center">
  <strong>Built with 💜 by John & Neo</strong>
</p>

<p align="center">
  <a href="https://github.com/envlock/envlock">GitHub</a> •
  <a href="https://www.npmjs.com/package/envlock">npm</a> •
  <a href="#-quick-start">Quick Start</a>
</p>
