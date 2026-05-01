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
  <a href="https://atum246.github.io/envlock/">Website</a> •
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

### Step 1: Install (AI Agent does this)

```bash
npm install -g @adewale0o/envlock
```

### Step 2: Initialize (AI Agent does this)

```bash
envlock init
# You'll set a master password. This encrypts everything.
```

### Step 3: Start Web UI (AI Agent does this)

**If agent and user are on the same computer:**
```bash
envlock serve
# → http://127.0.0.1:3847/?token=abc123...
```

**If agent is on a server and user is on a different device:**
```bash
envlock serve --expose
# → http://192.168.1.100:3847/?token=abc123...
```

### Step 4: User Opens Link (User does this)

The agent tells the user: *"Open this link to add your API keys"*

The user:
1. Opens the URL in their browser
2. Sees a clean form with service templates (OpenAI, Stripe, Discord, etc.)
3. Picks the service they want
4. Pastes their API key into the form
5. Clicks "Save Securely"
6. Done! Key is encrypted in the vault. Never touched chat.

### Step 5: Agent Reads Keys (AI Agent does this)

```bash
envlock get OPENAI_API_KEY
# → sk-1234567890...
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

## 🌐 Web UI — The Core Feature

The web UI is **why Envlock exists** — instead of pasting API keys into chat (where they get logged, stored, and potentially leaked), users paste them into a **clean web form** that goes straight into an encrypted vault.

```
❌ DON'T DO THIS:
User: "here's my API key: sk-1234567890..."
→ Key is now in chat history, logs, training data

✅ DO THIS INSTEAD:
Agent: "Open http://127.0.0.1:3847/?token=xxx to add your keys"
User: *opens link, picks OpenAI, pastes key in form*
→ Key goes directly into encrypted vault. Never in chat.
```

---

### Two Modes — Which One Do I Use?

#### Mode 1: Localhost (Default)

```bash
envlock serve
```

```
Your Computer
┌──────────────────────────────┐
│  AI Agent (OpenClaw, etc.)   │
│         ↓                    │
│  Envlock Vault (encrypted)   │
│         ↓                    │
│  Web UI at 127.0.0.1:3847   │◄── Only accessible from THIS machine
└──────────────────────────────┘
```

**When to use:**
- ✅ AI agent runs on YOUR computer (Cursor, Claude Code desktop, OpenClaw local)
- ✅ You open the browser on the SAME machine
- ✅ Most secure — nothing leaves your computer

**How it works:**
1. Agent runs `envlock serve`
2. Agent gives you the URL: `http://127.0.0.1:3847/?token=abc123`
3. You open that URL in your browser ON THE SAME COMPUTER
4. You see the form, pick a service, paste your key
5. Key is encrypted and stored locally
6. Agent reads it when needed

**Who can access:** Only you, from the same machine. Nobody else can reach `127.0.0.1`.

---

#### Mode 2: Network Exposed (`--expose`)

```bash
envlock serve --expose
```

```
Your VPS/Server                    Your Laptop/Phone
┌──────────────────────┐          ┌──────────────┐
│  AI Agent            │          │  Browser     │
│         ↓            │          │              │
│  Envlock Vault       │◄─────────│  You open    │
│         ↓            │ network  │  the URL     │
│  Web UI at           │          │              │
│  0.0.0.0:3847        │          └──────────────┘
└──────────────────────┘
```

**When to use:**
- ✅ AI agent runs on a VPS/cloud server (DigitalOcean, AWS, etc.)
- ✅ You want to add keys from your laptop or phone
- ✅ You're on the same WiFi/LAN network as the server

**How it works:**
1. Agent runs `envlock serve --expose` on the server
2. Agent gives you the URL: `http://192.168.1.100:3847/?token=abc123`
3. You open that URL from ANY device on the same network
4. You see the form, pick a service, paste your key
5. Key is encrypted and stored on the server
6. Agent reads it when needed

**Who can access:** Anyone on the same network who has the token URL. The token is required — without it, you just see a "enter token" page.

---

### Quick Decision Guide

| Your Setup | Command | Why |
|------------|---------|-----|
| Agent on my laptop, I use my laptop | `envlock serve` | Same machine = localhost is enough |
| Agent on a VPS, I use my laptop | `envlock serve --expose` | Different machines = need network access |
| Agent on a VPS, I'm on the internet | `envlock serve --expose` + firewall/port forward | Need to open port on your VPS |
| Just me, just testing | `envlock serve` | Simplest option |

---

### Security — Is This Safe?

**Yes.** Here's why:

| Layer | Protection |
|-------|-----------|
| 🔑 **Token auth** | URL contains a random 32-char token. No token = no access |
| 🏠 **Localhost default** | Only exposed to the internet if YOU choose `--expose` |
| 🔐 **Encrypted** | All secrets are AES-256 encrypted on disk |
| 🚫 **No chat** | Keys never enter conversation history |
| 📋 **Audit log** | Every access is logged with timestamp |
| ⏰ **One-time token** | Token changes each time you restart `envlock serve` |

**Even with `--expose`:**
- The server only listens on your local network (LAN), not the internet
- A random token is required for every request
- Without the token, you see nothing useful
- The token changes every restart

---

### Web UI Features

| Feature | Description |
|---------|-------------|
| 🎨 **Clean Dark UI** | Purple-themed, minimal, not generic AI slop |
| 📋 **46 Templates** | Pick OpenAI, Stripe, Discord, AWS, etc. |
| 📝 **Bulk Add** | Paste multiple `NAME=value` pairs at once |
| 📥 **Import .env** | Paste your existing `.env` file |
| 🔐 **Encrypted** | All data encrypted immediately |
| 🔑 **Token Protected** | URL contains one-time access token |

### What Users See

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

## 🔧 Technical Deep Dive — What's Happening in the Background

### The Full Flow (Step by Step)

When an AI agent uses Envlock, here's exactly what happens at each layer:

#### 1. Installation

```bash
npm install -g @adewale0o/envlock
```

- npm downloads the package to your global `node_modules`
- The `envlock` and `el` commands become available globally
- No background services, no daemons, no system modifications
- Everything runs on-demand when you invoke a command

#### 2. Initialization (`envlock init`)

```
User enters master password
         ↓
PBKDF2 derives encryption key (100,000 iterations, SHA-256)
         ↓
Creates ~/.envlock/ directory (permissions: 0700)
         ↓
Creates vault.enc (AES-256 encrypted, permissions: 0600)
         ↓
Creates slots.enc (encrypted metadata, permissions: 0600)
         ↓
Creates meta.json, config.json, audit.json
```

**What's stored on disk:**
- `~/.envlock/vault.enc` — Your secrets, encrypted with AES-256-CBC
- `~/.envlock/slots.enc` — Slot metadata (names, types, tags), also encrypted
- `~/.envlock/meta.json` — Vault creation date, version (not encrypted, no secrets)
- `~/.envlock/config.json` — Your preferences (not encrypted, no secrets)
- `~/.envlock/audit.json` — Access log (not encrypted, no secrets)

#### 3. Web UI (`envlock serve`)

```
envlock serve
      ↓
Generates random 32-char access token
      ↓
Starts HTTP server on 127.0.0.1:RANDOM_PORT (or 0.0.0.0 with --expose)
      ↓
Serves HTML/CSS/JS directly from memory (no external dependencies)
      ↓
User opens URL with token in browser
      ↓
Token is validated on every request (query param or header)
      ↓
User fills form → POST /api/secret → encrypted immediately → saved to vault.enc
      ↓
Server runs until Ctrl+C
```

**The web server:**
- Pure Node.js `http.createServer` — no Express, no frameworks
- All HTML/CSS/JS is embedded in the source code (no external assets)
- Token is required for every API request
- Without token, user sees a "enter token" page
- Server binds to localhost by default (127.0.0.1)
- With `--expose`, binds to 0.0.0.0 (all network interfaces)
- CORS headers set for local development
- No WebSocket, no long-polling — simple HTTP request/response

#### 4. Agent API (`envlock api`)

```bash
envlock api get OPENAI_API_KEY --json
```

```
Agent calls: envlock api get OPENAI_API_KEY --json
      ↓
CLI loads vault.enc, decrypts with master key
      ↓
Finds slot OPENAI_API_KEY in slots
      ↓
Decrypts value from vault
      ↓
Outputs JSON: {"success": true, "slot": "OPENAI_API_KEY", "value": "sk-..."}
      ↓
Agent uses the value to call OpenAI API
```

**Agent permissions:**
- Agents register with `envlock api register`
- Each agent has: `permissions` (read/list/write/create/delete/execute)
- Each agent has: `allowedSlots` (which secrets they can access, or `*` for all)
- Rate limiting: max 1000 requests/hour per agent (configurable)
- All access logged in audit.json

#### 5. Encryption Details

| Layer | Algorithm | Key Size | Details |
|-------|-----------|----------|---------|
| Key Derivation | PBKDF2 | 256-bit | 100,000 iterations, SHA-256 |
| Vault Encryption | AES-256-CBC | 256-bit | Each value encrypted separately |
| Backup Encryption | AES-256-CBC | 256-bit | Entire vault bundled and encrypted |
| Share Bundles | AES-256-CBC | 256-bit | Single secret encrypted with bundle password |
| Profile Export | AES-256-CBC | 256-bit | Profile data encrypted with password |

**How encryption works:**
1. You set a master password
2. PBKDF2 turns that password into a 256-bit key (100,000 iterations)
3. Every secret is individually encrypted with AES-256-CBC using that key
4. The encrypted data is written to `vault.enc`
5. Without the master password, the data is unreadable
6. Even if someone steals `vault.enc`, they can't decrypt it without your password

#### 6. Network Modes Explained

**Localhost Mode (`envlock serve`):**
```
┌─────────────────────────────────┐
│         Your Computer           │
│                                 │
│  ┌───────────┐  ┌───────────┐  │
│  │ AI Agent  │  │ Browser   │  │
│  │ (Node.js) │  │ (Chrome)  │  │
│  └─────┬─────┘  └─────┬─────┘  │
│        │              │         │
│        └──────┬───────┘         │
│               │                 │
│        ┌──────▼──────┐         │
│        │ Envlock     │         │
│        │ 127.0.0.1   │         │
│        └─────────────┘         │
└─────────────────────────────────┘
```
- Server binds to `127.0.0.1` (loopback address)
- Only processes on THIS machine can connect
- Your phone, another computer, or the internet CANNOT reach it
- This is the safest option

**Network Mode (`envlock serve --expose`):**
```
┌──────────────────────┐         ┌──────────────────┐
│    Your VPS/Server   │         │  Your Laptop     │
│                      │         │                  │
│  ┌──────────┐        │   LAN   │  ┌──────────┐   │
│  │AI Agent  │        │  ◄───── │  │ Browser  │   │
│  └────┬─────┘        │         │  └──────────┘   │
│       │              │         │                  │
│  ┌────▼──────┐       │         └──────────────────┘
│  │Envlock   │       │
│  │0.0.0.0   │       │
│  └──────────┘       │
└──────────────────────┘
```
- Server binds to `0.0.0.0` (all network interfaces)
- Accessible from any device on the same network
- "Same network" means: same WiFi, same LAN, same VPN, or same private cloud network
- NOT accessible from the internet (unless you open ports on your firewall)
- Token authentication still required

**What "same network" actually means:**

| Scenario | Same Network? | Works? |
|----------|--------------|--------|
| Laptop + phone on home WiFi | ✅ Yes | `--expose` works |
| Two computers in same office | ✅ Yes | `--expose` works |
| VPS + your laptop via VPN | ✅ Yes | `--expose` works |
| Your laptop + friend's laptop (different houses) | ❌ No | Need tunnel or port forward |
| Your laptop + random VPS on internet | ❌ No | Need firewall rule + port forward |

**If you need internet access (advanced):**
1. Open the port on your VPS firewall (e.g., `ufw allow 3847`)
2. Use the VPS's public IP: `http://YOUR_VPS_IP:3847/?token=xxx`
3. Or use a tunnel: `ngrok http 3847` (creates a temporary public URL)
4. ⚠️ Only do this if you understand the security implications

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
