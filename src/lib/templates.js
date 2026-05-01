'use strict';

// ─── Credential Templates ──────────────────────────────────────
// Pre-built templates for common services so agents/users
// don't have to figure out what fields they need.

const TEMPLATES = {
  // ── AI & ML ────────────────────────────────────────────────
  'openai': {
    name: 'OpenAI',
    category: 'ai',
    icon: '🤖',
    fields: [
      { name: 'OPENAI_API_KEY', label: 'API Key', type: 'secret', required: true, placeholder: 'sk-...' },
      { name: 'OPENAI_ORG_ID', label: 'Organization ID', type: 'text', required: false, placeholder: 'org-...' }
    ]
  },
  'anthropic': {
    name: 'Anthropic (Claude)',
    category: 'ai',
    icon: '🧠',
    fields: [
      { name: 'ANTHROPIC_API_KEY', label: 'API Key', type: 'secret', required: true, placeholder: 'sk-ant-...' }
    ]
  },
  'google-ai': {
    name: 'Google AI (Gemini)',
    category: 'ai',
    icon: '💎',
    fields: [
      { name: 'GOOGLE_AI_KEY', label: 'API Key', type: 'secret', required: true, placeholder: 'AIza...' }
    ]
  },
  'huggingface': {
    name: 'Hugging Face',
    category: 'ai',
    icon: '🤗',
    fields: [
      { name: 'HF_TOKEN', label: 'Access Token', type: 'secret', required: true, placeholder: 'hf_...' }
    ]
  },
  'replicate': {
    name: 'Replicate',
    category: 'ai',
    icon: '🔄',
    fields: [
      { name: 'REPLICATE_API_TOKEN', label: 'API Token', type: 'secret', required: true, placeholder: 'r8_...' }
    ]
  },

  // ── Social Media ───────────────────────────────────────────
  'twitter': {
    name: 'Twitter / X',
    category: 'social',
    icon: '🐦',
    fields: [
      { name: 'TWITTER_API_KEY', label: 'API Key (Consumer Key)', type: 'secret', required: true },
      { name: 'TWITTER_API_SECRET', label: 'API Secret', type: 'secret', required: true },
      { name: 'TWITTER_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: true },
      { name: 'TWITTER_ACCESS_SECRET', label: 'Access Token Secret', type: 'secret', required: true },
      { name: 'TWITTER_BEARER_TOKEN', label: 'Bearer Token', type: 'secret', required: false }
    ]
  },
  'discord': {
    name: 'Discord',
    category: 'social',
    icon: '💬',
    fields: [
      { name: 'DISCORD_TOKEN', label: 'Bot Token', type: 'secret', required: true },
      { name: 'DISCORD_CLIENT_ID', label: 'Client ID', type: 'text', required: false },
      { name: 'DISCORD_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: false }
    ]
  },
  'telegram': {
    name: 'Telegram',
    category: 'social',
    icon: '✈️',
    fields: [
      { name: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', type: 'secret', required: true, placeholder: '123456:ABC-DEF...' },
      { name: 'TELEGRAM_CHAT_ID', label: 'Chat ID', type: 'text', required: false }
    ]
  },
  'slack': {
    name: 'Slack',
    category: 'social',
    icon: '📡',
    fields: [
      { name: 'SLACK_BOT_TOKEN', label: 'Bot Token', type: 'secret', required: true, placeholder: 'xoxb-...' },
      { name: 'SLACK_APP_TOKEN', label: 'App Token', type: 'secret', required: false, placeholder: 'xapp-...' },
      { name: 'SLACK_WEBHOOK_URL', label: 'Webhook URL', type: 'secret', required: false }
    ]
  },
  'github': {
    name: 'GitHub',
    category: 'dev',
    icon: '🐙',
    fields: [
      { name: 'GITHUB_TOKEN', label: 'Personal Access Token', type: 'secret', required: true, placeholder: 'ghp_...' },
      { name: 'GITHUB_USERNAME', label: 'Username', type: 'text', required: false }
    ]
  },
  'instagram': {
    name: 'Instagram',
    category: 'social',
    icon: '📸',
    fields: [
      { name: 'INSTAGRAM_USERNAME', label: 'Username', type: 'text', required: true },
      { name: 'INSTAGRAM_PASSWORD', label: 'Password', type: 'secret', required: true },
      { name: 'INSTAGRAM_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: false }
    ]
  },
  'facebook': {
    name: 'Facebook / Meta',
    category: 'social',
    icon: '👤',
    fields: [
      { name: 'FACEBOOK_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: true },
      { name: 'FACEBOOK_APP_ID', label: 'App ID', type: 'text', required: false },
      { name: 'FACEBOOK_APP_SECRET', label: 'App Secret', type: 'secret', required: false }
    ]
  },
  'linkedin': {
    name: 'LinkedIn',
    category: 'social',
    icon: '💼',
    fields: [
      { name: 'LINKEDIN_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: true },
      { name: 'LINKEDIN_CLIENT_ID', label: 'Client ID', type: 'text', required: false },
      { name: 'LINKEDIN_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: false }
    ]
  },
  'youtube': {
    name: 'YouTube / Google',
    category: 'social',
    icon: '▶️',
    fields: [
      { name: 'YOUTUBE_API_KEY', label: 'API Key', type: 'secret', required: true },
      { name: 'YOUTUBE_CLIENT_ID', label: 'OAuth Client ID', type: 'text', required: false },
      { name: 'YOUTUBE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'secret', required: false },
      { name: 'YOUTUBE_REFRESH_TOKEN', label: 'Refresh Token', type: 'secret', required: false }
    ]
  },
  'tiktok': {
    name: 'TikTok',
    category: 'social',
    icon: '🎵',
    fields: [
      { name: 'TIKTOK_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: true },
      { name: 'TIKTOK_CLIENT_KEY', label: 'Client Key', type: 'text', required: false },
      { name: 'TIKTOK_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: false }
    ]
  },
  'reddit': {
    name: 'Reddit',
    category: 'social',
    icon: '🤖',
    fields: [
      { name: 'REDDIT_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
      { name: 'REDDIT_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
      { name: 'REDDIT_USERNAME', label: 'Username', type: 'text', required: false },
      { name: 'REDDIT_PASSWORD', label: 'Password', type: 'secret', required: false }
    ]
  },
  'pinterest': {
    name: 'Pinterest',
    category: 'social',
    icon: '📌',
    fields: [
      { name: 'PINTEREST_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: true },
      { name: 'PINTEREST_APP_ID', label: 'App ID', type: 'text', required: false }
    ]
  },

  // ── Cloud & Infrastructure ─────────────────────────────────
  'aws': {
    name: 'AWS',
    category: 'cloud',
    icon: '☁️',
    fields: [
      { name: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', type: 'text', required: true, placeholder: 'AKIA...' },
      { name: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'secret', required: true },
      { name: 'AWS_REGION', label: 'Default Region', type: 'text', required: false, placeholder: 'us-east-1' },
      { name: 'AWS_SESSION_TOKEN', label: 'Session Token', type: 'secret', required: false }
    ]
  },
  'gcp': {
    name: 'Google Cloud',
    category: 'cloud',
    icon: '🌐',
    fields: [
      { name: 'GCP_PROJECT_ID', label: 'Project ID', type: 'text', required: true },
      { name: 'GCP_SERVICE_ACCOUNT', label: 'Service Account JSON', type: 'secret', required: true, placeholder: '{"type": "service_account"...}' }
    ]
  },
  'azure': {
    name: 'Azure',
    category: 'cloud',
    icon: '🔷',
    fields: [
      { name: 'AZURE_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
      { name: 'AZURE_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
      { name: 'AZURE_TENANT_ID', label: 'Tenant ID', type: 'text', required: true },
      { name: 'AZURE_SUBSCRIPTION_ID', label: 'Subscription ID', type: 'text', required: false }
    ]
  },
  'vercel': {
    name: 'Vercel',
    category: 'cloud',
    icon: '▲',
    fields: [
      { name: 'VERCEL_TOKEN', label: 'API Token', type: 'secret', required: true }
    ]
  },
  'netlify': {
    name: 'Netlify',
    category: 'cloud',
    icon: '🟢',
    fields: [
      { name: 'NETLIFY_AUTH_TOKEN', label: 'Auth Token', type: 'secret', required: true }
    ]
  },
  'digitalocean': {
    name: 'DigitalOcean',
    category: 'cloud',
    icon: '🌊',
    fields: [
      { name: 'DO_TOKEN', label: 'API Token', type: 'secret', required: true }
    ]
  },
  'flyio': {
    name: 'Fly.io',
    category: 'cloud',
    icon: '🪁',
    fields: [
      { name: 'FLY_API_TOKEN', label: 'API Token', type: 'secret', required: true }
    ]
  },

  // ── Databases ──────────────────────────────────────────────
  'postgres': {
    name: 'PostgreSQL',
    category: 'database',
    icon: '🐘',
    fields: [
      { name: 'DATABASE_URL', label: 'Connection URL', type: 'secret', required: true, placeholder: 'postgresql://user:pass@host:5432/db' },
      { name: 'PGHOST', label: 'Host', type: 'text', required: false },
      { name: 'PGPORT', label: 'Port', type: 'text', required: false, placeholder: '5432' },
      { name: 'PGUSER', label: 'User', type: 'text', required: false },
      { name: 'PGPASSWORD', label: 'Password', type: 'secret', required: false },
      { name: 'PGDATABASE', label: 'Database', type: 'text', required: false }
    ]
  },
  'mysql': {
    name: 'MySQL',
    category: 'database',
    icon: '🐬',
    fields: [
      { name: 'MYSQL_URL', label: 'Connection URL', type: 'secret', required: true, placeholder: 'mysql://user:pass@host:3306/db' },
      { name: 'MYSQL_HOST', label: 'Host', type: 'text', required: false },
      { name: 'MYSQL_USER', label: 'User', type: 'text', required: false },
      { name: 'MYSQL_PASSWORD', label: 'Password', type: 'secret', required: false },
      { name: 'MYSQL_DATABASE', label: 'Database', type: 'text', required: false }
    ]
  },
  'mongodb': {
    name: 'MongoDB',
    category: 'database',
    icon: '🍃',
    fields: [
      { name: 'MONGODB_URI', label: 'Connection URI', type: 'secret', required: true, placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db' }
    ]
  },
  'redis': {
    name: 'Redis',
    category: 'database',
    icon: '🔴',
    fields: [
      { name: 'REDIS_URL', label: 'Connection URL', type: 'secret', required: true, placeholder: 'redis://user:pass@host:6379' }
    ]
  },
  'firebase': {
    name: 'Firebase',
    category: 'database',
    icon: '🔥',
    fields: [
      { name: 'FIREBASE_API_KEY', label: 'API Key', type: 'secret', required: true },
      { name: 'FIREBASE_AUTH_DOMAIN', label: 'Auth Domain', type: 'text', required: true },
      { name: 'FIREBASE_PROJECT_ID', label: 'Project ID', type: 'text', required: true },
      { name: 'FIREBASE_SERVICE_ACCOUNT', label: 'Service Account JSON', type: 'secret', required: false }
    ]
  },
  'supabase': {
    name: 'Supabase',
    category: 'database',
    icon: '⚡',
    fields: [
      { name: 'SUPABASE_URL', label: 'Project URL', type: 'text', required: true, placeholder: 'https://xxx.supabase.co' },
      { name: 'SUPABASE_ANON_KEY', label: 'Anon Key', type: 'secret', required: true },
      { name: 'SUPABASE_SERVICE_KEY', label: 'Service Role Key', type: 'secret', required: false }
    ]
  },

  // ── Payments ───────────────────────────────────────────────
  'stripe': {
    name: 'Stripe',
    category: 'payments',
    icon: '💳',
    fields: [
      { name: 'STRIPE_SECRET_KEY', label: 'Secret Key', type: 'secret', required: true, placeholder: 'sk_live_...' },
      { name: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', type: 'text', required: false, placeholder: 'pk_live_...' },
      { name: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', type: 'secret', required: false }
    ]
  },
  'paypal': {
    name: 'PayPal',
    category: 'payments',
    icon: '🅿️',
    fields: [
      { name: 'PAYPAL_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
      { name: 'PAYPAL_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
      { name: 'PAYPAL_MODE', label: 'Mode', type: 'text', required: false, placeholder: 'sandbox | live' }
    ]
  },

  // ── Email & Communication ──────────────────────────────────
  'sendgrid': {
    name: 'SendGrid',
    category: 'email',
    icon: '📧',
    fields: [
      { name: 'SENDGRID_API_KEY', label: 'API Key', type: 'secret', required: true, placeholder: 'SG...' }
    ]
  },
  'mailgun': {
    name: 'Mailgun',
    category: 'email',
    icon: '🔫',
    fields: [
      { name: 'MAILGUN_API_KEY', label: 'API Key', type: 'secret', required: true },
      { name: 'MAILGUN_DOMAIN', label: 'Domain', type: 'text', required: true }
    ]
  },
  'twilio': {
    name: 'Twilio',
    category: 'communication',
    icon: '📱',
    fields: [
      { name: 'TWILIO_ACCOUNT_SID', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
      { name: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', type: 'secret', required: true },
      { name: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', type: 'text', required: false, placeholder: '+1234567890' }
    ]
  },

  // ── Analytics & Monitoring ─────────────────────────────────
  'datadog': {
    name: 'Datadog',
    category: 'monitoring',
    icon: '🐕',
    fields: [
      { name: 'DD_API_KEY', label: 'API Key', type: 'secret', required: true },
      { name: 'DD_APP_KEY', label: 'Application Key', type: 'secret', required: false }
    ]
  },
  'sentry': {
    name: 'Sentry',
    category: 'monitoring',
    icon: '🐛',
    fields: [
      { name: 'SENTRY_DSN', label: 'DSN', type: 'secret', required: true, placeholder: 'https://xxx@sentry.io/...' },
      { name: 'SENTRY_AUTH_TOKEN', label: 'Auth Token', type: 'secret', required: false }
    ]
  },
  'newrelic': {
    name: 'New Relic',
    category: 'monitoring',
    icon: '📊',
    fields: [
      { name: 'NEWRELIC_LICENSE_KEY', label: 'License Key', type: 'secret', required: true },
      { name: 'NEWRELIC_APP_NAME', label: 'App Name', type: 'text', required: false }
    ]
  },

  // ── DevOps & CI/CD ─────────────────────────────────────────
  'docker': {
    name: 'Docker Hub',
    category: 'devops',
    icon: '🐳',
    fields: [
      { name: 'DOCKER_USERNAME', label: 'Username', type: 'text', required: true },
      { name: 'DOCKER_PASSWORD', label: 'Password / Token', type: 'secret', required: true }
    ]
  },
  'npm': {
    name: 'npm',
    category: 'devops',
    icon: '📦',
    fields: [
      { name: 'NPM_TOKEN', label: 'Access Token', type: 'secret', required: true, placeholder: 'npm_...' }
    ]
  },

  // ── VPN & Network ──────────────────────────────────────────
  'vpn': {
    name: 'VPN Credentials',
    category: 'network',
    icon: '🛡️',
    fields: [
      { name: 'VPN_SERVER', label: 'Server Address', type: 'text', required: true },
      { name: 'VPN_USERNAME', label: 'Username', type: 'text', required: true },
      { name: 'VPN_PASSWORD', label: 'Password', type: 'secret', required: true },
      { name: 'VPN_CONFIG', label: 'Config File / Key', type: 'secret', required: false }
    ]
  },

  // ── SSH ────────────────────────────────────────────────────
  'ssh': {
    name: 'SSH Key',
    category: 'network',
    icon: '🔑',
    fields: [
      { name: 'SSH_HOST', label: 'Host', type: 'text', required: true },
      { name: 'SSH_USERNAME', label: 'Username', type: 'text', required: true, placeholder: 'root' },
      { name: 'SSH_PRIVATE_KEY', label: 'Private Key', type: 'secret', required: true, placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----' },
      { name: 'SSH_PASSPHRASE', label: 'Passphrase', type: 'secret', required: false }
    ]
  },

  // ── Custom / Generic ───────────────────────────────────────
  'api-key': {
    name: 'Generic API Key',
    category: 'custom',
    icon: '🔑',
    fields: [
      { name: 'API_KEY', label: 'API Key', type: 'secret', required: true },
      { name: 'API_SECRET', label: 'API Secret', type: 'secret', required: false },
      { name: 'API_BASE_URL', label: 'Base URL', type: 'text', required: false }
    ]
  },
  'oauth': {
    name: 'OAuth Credentials',
    category: 'custom',
    icon: '🔓',
    fields: [
      { name: 'OAUTH_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
      { name: 'OAUTH_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
      { name: 'OAUTH_REDIRECT_URI', label: 'Redirect URI', type: 'text', required: false },
      { name: 'OAUTH_ACCESS_TOKEN', label: 'Access Token', type: 'secret', required: false },
      { name: 'OAUTH_REFRESH_TOKEN', label: 'Refresh Token', type: 'secret', required: false }
    ]
  },
  'basic-auth': {
    name: 'Username & Password',
    category: 'custom',
    icon: '👤',
    fields: [
      { name: 'USERNAME', label: 'Username / Email', type: 'text', required: true },
      { name: 'PASSWORD', label: 'Password', type: 'secret', required: true }
    ]
  },
  'bearer-token': {
    name: 'Bearer Token',
    category: 'custom',
    icon: '🎫',
    fields: [
      { name: 'BEARER_TOKEN', label: 'Bearer Token', type: 'secret', required: true },
      { name: 'TOKEN_BASE_URL', label: 'API Base URL', type: 'text', required: false }
    ]
  }
};

const CATEGORIES = {
  ai: { name: 'AI & Machine Learning', icon: '🤖' },
  social: { name: 'Social Media', icon: '📱' },
  dev: { name: 'Developer Tools', icon: '🛠️' },
  cloud: { name: 'Cloud & Infrastructure', icon: '☁️' },
  database: { name: 'Databases', icon: '🗄️' },
  payments: { name: 'Payments', icon: '💳' },
  email: { name: 'Email & Communication', icon: '📧' },
  monitoring: { name: 'Analytics & Monitoring', icon: '📊' },
  devops: { name: 'DevOps & CI/CD', icon: '🚀' },
  network: { name: 'VPN & Network', icon: '🛡️' },
  custom: { name: 'Custom / Generic', icon: '🔧' }
};

function getTemplate(id) {
  return TEMPLATES[id] || null;
}

function listTemplates(category) {
  let entries = Object.entries(TEMPLATES);
  if (category) entries = entries.filter(([, t]) => t.category === category);
  return entries.map(([id, t]) => ({
    id,
    name: t.name,
    category: t.category,
    icon: t.icon,
    fieldCount: t.fields.length
  }));
}

function listCategories() {
  return Object.entries(CATEGORIES).map(([id, c]) => ({
    id,
    ...c,
    templateCount: Object.values(TEMPLATES).filter(t => t.category === id).length
  }));
}

module.exports = { TEMPLATES, CATEGORIES, getTemplate, listTemplates, listCategories };
