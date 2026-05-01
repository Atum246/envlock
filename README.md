# 🔐 Envlock

**Secure Credential Vault for AI Agents**

```
  ███████╗███╗   ██╗██╗   ██╗██╗      ██████╗  ██████╗██╗  ██╗
  ██╔════╝████╗  ██║██║   ██║██║     ██╔═══██╗██╔════╝██║ ██╔╝
  █████╗  ██╔██╗ ██║██║   ██║██║     ██║   ██║██║     █████╔╝
  ██╔══╝  ██║╚██╗██║██║   ██║██║     ██║   ██║██║     ██╔═██╗
  ███████╗██║ ╚████║╚██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗
  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝

       .-"""-.
      /        \
     |  .--.  |
     | |    | |
     | | 🔒 | |
     | |    | |
     |  '--'  |
      \      /
       '-..-'
```

> Stop pasting API keys into chat. Start storing them securely. 🔐

---

## 🤔 Why Envlock?

When you use AI agents (OpenClaw, Claude Code, Cursor, etc.), you often need to provide API keys, tokens, and credentials. The current approach? **Just paste them into the chat.** 😬

**The problems:**
- 🔓 Keys end up in conversation history
- 📝 They get logged, stored, potentially trained on
- 🎣 Prompt injection could exfiltrate your keys
- 💀 Anyone who sees the chat sees your secrets

**Envlock solves this:**
- 🔐 Keys stored in an encrypted local vault
- 🚫 Never enter conversation history
- 🤖 AI agents access them through a secure API
- 🌐 **Web UI** for users to paste secrets in a browser (not in chat!)
- 📋 Full audit log of who accessed what & when
- 📦 **40+ service templates** — pre-built forms for every major platform

---

## ⚡ Quick Start

### For AI Agents (the primary use case)

```bash
# Agent installs envlock
npm install -g envlock

# Agent initializes vault
envlock init

# Agent starts web UI → user pastes secrets in browser
envlock serve
# → Spins up http://127.0.0.1:PORT?token=SECRET
# → User opens link, sees clean form, pastes keys
# → Keys go straight into encrypted vault
# → Agent reads them via API
```

### The Flow

```
1. 🤖 AI Agent: npm install -g envlock && envlock init
2. 🤖 AI Agent: envlock serve → gets URL with token
3. 👤 User: opens URL in browser
4. 👤 User: sees clean form, picks a service template (OpenAI, Stripe, etc.)
5. 👤 User: pastes API key into the form
6. 🔐 Key stored in encrypted vault (never in chat!)
7. 🤖 AI Agent: envlock get OPENAI_API_KEY → uses it
```

---

## 🌐 Web UI

The killer feature — **spin up a local web page** for users to input secrets:

```bash
envlock serve
```

```
🌐 Envlock Web UI is running!

  Open this URL in your browser:

  http://127.0.0.1:3847/token=abc123...

  ─────────────────────────────────────
  This URL contains your access token.
  Share it only with trusted users.
  The server runs on localhost only.
  Press Ctrl+C to stop.
```

**Web UI features:**
- 🎨 Clean, dark-themed UI (not generic AI slop)
- 📋 Service templates — pick OpenAI, Stripe, Discord, etc.
- 📝 Bulk add — paste multiple secrets at once
- 📥 Import .env — paste your existing .env file
- 🔐 All data encrypted immediately, never leaves localhost

---

## 📦 40+ Service Templates

Pre-built forms so users don't have to figure out field names:

### 🤖 AI & Machine Learning
| Template | Fields |
|----------|--------|
| `openai` | API Key, Org ID |
| `anthropic` | API Key |
| `google-ai` | API Key |
| `huggingface` | Access Token |
| `replicate` | API Token |

### 📱 Social Media
| Template | Fields |
|----------|--------|
| `twitter` | API Key, Secret, Access Token, Bearer Token |
| `discord` | Bot Token, Client ID, Secret |
| `telegram` | Bot Token, Chat ID |
| `slack` | Bot Token, App Token, Webhook |
| `instagram` | Username, Password, Access Token |
| `facebook` | Access Token, App ID, Secret |
| `linkedin` | Access Token, Client ID, Secret |
| `youtube` | API Key, OAuth credentials |
| `tiktok` | Access Token, Client Key, Secret |
| `reddit` | Client ID, Secret, credentials |
| `pinterest` | Access Token, App ID |

### ☁️ Cloud & Infrastructure
| Template | Fields |
|----------|--------|
| `aws` | Access Key ID, Secret, Region, Session Token |
| `gcp` | Project ID, Service Account JSON |
| `azure` | Client ID, Secret, Tenant, Subscription |
| `vercel` | API Token |
| `netlify` | Auth Token |
| `digitalocean` | API Token |
| `flyio` | API Token |

### 🗄️ Databases
| Template | Fields |
|----------|--------|
| `postgres` | Connection URL + individual fields |
| `mysql` | Connection URL + individual fields |
| `mongodb` | Connection URI |
| `redis` | Connection URL |
| `firebase` | API Key, Auth Domain, Project ID |
| `supabase` | URL, Anon Key, Service Key |

### 💳 Payments
| Template | Fields |
|----------|--------|
| `stripe` | Secret Key, Publishable Key, Webhook Secret |
| `paypal` | Client ID, Secret, Mode |

### 📧 Email & Communication
| Template | Fields |
|----------|--------|
| `sendgrid` | API Key |
| `mailgun` | API Key, Domain |
| `twilio` | Account SID, Auth Token, Phone |

### 📊 Monitoring
| Template | Fields |
|----------|--------|
| `datadog` | API Key, App Key |
| `sentry` | DSN, Auth Token |
| `newrelic` | License Key, App Name |

### 🚀 DevOps
| Template | Fields |
|----------|--------|
| `docker` | Username, Password |
| `npm` | Access Token |

### 🛡️ Network
| Template | Fields |
|----------|--------|
| `vpn` | Server, Username, Password, Config |
| `ssh` | Host, Username, Private Key, Passphrase |

### 🔧 Custom
| Template | Fields |
|----------|--------|
| `api-key` | API Key, Secret, Base URL |
| `oauth` | Client ID, Secret, Redirect URI, Tokens |
| `basic-auth` | Username, Password |
| `bearer-token` | Bearer Token, Base URL |

---

## 📋 All Commands

| Command | Description |
|---------|-------------|
| `envlock init` | Initialize vault with master password |
| `envlock create <name>` | Create a new secret slot |
| `envlock set <name>` | Set value for a secret |
| `envlock get <name>` | Retrieve a secret |
| `envlock list` | List all secret slots |
| `envlock delete <name>` | Delete a secret |
| `envlock serve` | **🌐 Start web UI for users** |
| `envlock templates` | **📋 List 40+ service templates** |
| `envlock from-template <id>` | **➕ Add from template interactively** |
| `envlock import-env <file>` | **📥 Import .env file** |
| `envlock export` | Export secrets as env vars |
| `envlock inject <cmd>` | Run command with secrets injected |
| `envlock api <method>` | Agent API (JSON in/out) |
| `envlock audit` | View audit log |
| `envlock config` | View/set configuration |
| `envlock lock` | Lock the vault |
| `envlock unlock` | Unlock the vault |
| `envlock rotate` | Change master password |
| `envlock share <name>` | Create shareable encrypted bundle |
| `envlock import <bundle>` | Import an encrypted bundle |
| `envlock status` | Show vault status |

---

## 🤖 Agent API

AI agents interact with Envlock programmatically:

```bash
# List all secrets
envlock api list --json

# Get a specific secret
envlock api get OPENAI_API_KEY --json

# Create and set in one call
envlock api create NEW_KEY --json
envlock api set NEW_KEY --json

# Export all secrets as env vars
envlock api export --json

# Register an agent with permissions
envlock api register --json

# Run a command with secrets injected
envlock api inject node app.js --json
```

---

## 🔒 Security

- **AES-256 encryption** via CryptoJS
- **PBKDF2 key derivation** (100,000 iterations)
- **Local-only storage** — nothing leaves your machine
- **File permissions** — vault files are `0600` (owner-only)
- **Auto-expiry** — set secrets to expire after N seconds
- **Audit log** — every access is logged with timestamp
- **Web UI** — localhost only, token-protected, no external exposure

---

## 🎯 Export Formats

```bash
# Shell
envlock export --format shell
export OPENAI_API_KEY="sk-..."

# dotenv
envlock export --format dotenv
OPENAI_API_KEY="sk-..."

# Docker
envlock export --format docker
-e OPENAI_API_KEY="sk-..."

# JSON
envlock export --format json
{"OPENAI_API_KEY": "sk-..."}
```

---

## 🏗️ Architecture

```
~/.envlock/
├── vault.enc           # Encrypted secrets (AES-256)
├── slots.enc           # Encrypted slot metadata
├── meta.json           # Vault metadata
├── config.json         # Configuration
├── audit.json          # Audit log
├── agents.json         # Registered agents
└── agent-requests.json # Pending access requests
```

---

## 📄 License

MIT © [Envlock Contributors](https://github.com/envlock/envlock)

---

**Built with 💜 by John & Neo**
