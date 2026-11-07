// Planos, limites de uso e licenças.
//
// Os limites são aplicados no servidor. A ativação de planos pagos é feita por
// código de licença (gerado com tools/gerar-licenca.js após o pagamento).
// Para uso próprio, defina LUME_PLAN=plus|pro no .env.

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.LUME_DATA_DIR
  ? path.resolve(process.env.LUME_DATA_DIR)
  : path.join(ROOT, 'data');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');
const SECRET_FILE = path.join(DATA_DIR, '.license-secret');

const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS = {
  free: {
    id: 'free',
    name: 'Grátis',
    emoji: '🌱',
    tagline: 'Para conhecer o Lume AI',
    price: 0,
    priceLabel: 'R$ 0',
    period: 'para sempre',
    highlight: false,
    limits: {
      messagesPerDay: 30,
      attachmentsPerDay: 3,
      maxAttachmentsPerMessage: 2,
      maxAttachmentMb: 5,
      maxOutputTokens: 4096,
      webSearch: false,
      smartMode: true,
    },
    features: [
      '30 mensagens por dia',
      '3 anexos por dia (imagens e PDF)',
      'Modo inteligente incluído',
      'Histórico salvo no seu PC',
      'Respostas de até 4.096 tokens',
    ],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    emoji: '⚡',
    tagline: 'Para usar todos os dias',
    price: 19.9,
    priceLabel: 'R$ 19,90',
    period: 'por mês',
    highlight: true,
    limits: {
      messagesPerDay: 500,
      attachmentsPerDay: 100,
      maxAttachmentsPerMessage: 4,
      maxAttachmentMb: 10,
      maxOutputTokens: 8192,
      webSearch: true,
      smartMode: true,
    },
    features: [
      '500 mensagens por dia',
      '100 anexos por dia',
      'Pesquisa no Google em tempo real',
      'Anexos até 10 MB e 4 por mensagem',
      'Respostas de até 8.192 tokens',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    emoji: '🔥',
    tagline: 'Potência máxima, sem limites',
    price: 49.9,
    priceLabel: 'R$ 49,90',
    period: 'por mês',
    highlight: false,
    limits: {
      messagesPerDay: null,
      attachmentsPerDay: null,
      maxAttachmentsPerMessage: 6,
      maxAttachmentMb: 20,
      maxOutputTokens: 16384,
      webSearch: true,
      smartMode: true,
      priority: true,
    },
    features: [
      'Mensagens ilimitadas',
      'Anexos ilimitados',
      'Pesquisa no Google em tempo real',
      'Anexos até 20 MB e 6 por mensagem',
      'Respostas de até 16.384 tokens',
      'Suporte prioritário',
    ],
  },
};

const PLAN_ORDER = ['free', 'plus', 'pro'];

function publicPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    emoji: plan.emoji,
    tagline: plan.tagline,
    price: plan.price,
    priceLabel: plan.priceLabel,
    period: plan.period,
    highlight: plan.highlight,
    limits: plan.limits,
    features: plan.features,
  };
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function tomorrowKey() {
  return todayKey(new Date(Date.now() + DAY_MS));
}

let usageCache = null;
let writeQueue = Promise.resolve();

async function loadUsage() {
  if (usageCache) return usageCache;
  try {
    const raw = JSON.parse(await fs.readFile(USAGE_FILE, 'utf8'));
    usageCache = {
      plan: PLANS[raw?.plan] ? raw.plan : 'free',
      planExpiresAt: raw?.planExpiresAt || null,
      activatedAt: raw?.activatedAt || null,
      days: raw?.days && typeof raw.days === 'object' ? raw.days : {},
    };
  } catch {
    usageCache = { plan: 'free', planExpiresAt: null, activatedAt: null, days: {} };
  }
  return usageCache;
}

function persist() {
  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${USAGE_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(usageCache, null, 2), 'utf8');
      await fs.rename(tmp, USAGE_FILE);
    })
    .catch((err) => console.error('[planos] falha ao salvar uso:', err.message));
  return writeQueue;
}

function pruneDays(usage) {
  const keys = Object.keys(usage.days).sort();
  const keep = new Set(keys.slice(-14));
  for (const key of keys) if (!keep.has(key)) delete usage.days[key];
}

function dayUsage(usage) {
  const key = todayKey();
  if (!usage.days[key]) usage.days[key] = { messages: 0, attachments: 0 };
  if (typeof usage.days[key].messages !== 'number') usage.days[key].messages = 0;
  if (typeof usage.days[key].attachments !== 'number') usage.days[key].attachments = 0;
  return usage.days[key];
}

function effectivePlan(usage) {
  const envPlan = String(process.env.LUME_PLAN || '').trim().toLowerCase();
  if (PLANS[envPlan]) {
    return { id: envPlan, source: 'env', expiresAt: process.env.LUME_PLAN_EXPIRES || null };
  }

  if (usage.plan && usage.plan !== 'free' && PLANS[usage.plan]) {
    const expiresAt = usage.planExpiresAt ? new Date(usage.planExpiresAt).getTime() : 0;
    if (!expiresAt || expiresAt > Date.now()) {
      return { id: usage.plan, source: 'license', expiresAt: usage.planExpiresAt };
    }
  }

  return { id: 'free', source: 'free', expiresAt: null };
}

function remainingFor(limit, used) {
  if (limit == null) return null;
  return Math.max(0, limit - used);
}

export async function getBillingStatus() {
  const usage = await loadUsage();
  const effective = effectivePlan(usage);
  const plan = PLANS[effective.id];
  const today = dayUsage(usage);

  return {
    plan: publicPlan(plan),
    plans: PLAN_ORDER.map((id) => publicPlan(PLANS[id])),
    usage: { messages: today.messages, attachments: today.attachments },
    limits: plan.limits,
    remaining: {
      messages: remainingFor(plan.limits.messagesPerDay, today.messages),
      attachments: remainingFor(plan.limits.attachmentsPerDay, today.attachments),
    },
    expiresAt: effective.expiresAt,
    source: effective.source,
    checkout: {
      plus: String(process.env.CHECKOUT_PLUS_URL || '').trim(),
      pro: String(process.env.CHECKOUT_PRO_URL || '').trim(),
    },
    resetAt: tomorrowKey(),
    serverDate: todayKey(),
  };
}

export async function checkMessageAllowed() {
  const billing = await getBillingStatus();
  const limit = billing.limits.messagesPerDay;
  if (limit != null && billing.usage.messages >= limit) {
    return {
      ok: false,
      billing,
      message: `Você usou as ${limit} mensagens do plano ${billing.plan.name} hoje. Atualize o plano ou volte amanhã.`,
    };
  }
  return { ok: true, billing };
}

export async function consumeMessage() {
  const usage = await loadUsage();
  const today = dayUsage(usage);
  today.messages += 1;
  pruneDays(usage);
  await persist();
}

export async function checkAttachmentsAllowed(count) {
  const billing = await getBillingStatus();
  const { limits } = billing;

  if (count > limits.maxAttachmentsPerMessage) {
    return {
      ok: false,
      billing,
      message: `O plano ${billing.plan.name} permite até ${limits.maxAttachmentsPerMessage} anexos por mensagem.`,
    };
  }

  if (limits.attachmentsPerDay != null && billing.usage.attachments + count > limits.attachmentsPerDay) {
    return {
      ok: false,
      billing,
      message: `O plano ${billing.plan.name} permite ${limits.attachmentsPerDay} anexos por dia. Atualize o plano ou tente amanhã.`,
    };
  }

  return { ok: true, billing };
}

export async function consumeAttachments(count) {
  if (!count) return;
  const usage = await loadUsage();
  const today = dayUsage(usage);
  today.attachments += count;
  pruneDays(usage);
  await persist();
}

// ---------------------------------------------------------------------------
// Licenças
// ---------------------------------------------------------------------------

let secretCache = '';

// Usa LICENSE_SECRET do .env; se não existir, cria e guarda um segredo local
// em data/.license-secret. Assim o app já funciona sem configuração extra.
function licenseSecret() {
  if (secretCache) return secretCache;

  const fromEnv = String(process.env.LICENSE_SECRET || '').trim();
  if (fromEnv) {
    if (fromEnv.length < 16) {
      throw new Error('LICENSE_SECRET precisa ter pelo menos 16 caracteres.');
    }
    secretCache = fromEnv;
    return secretCache;
  }

  try {
    const stored = fsSync.readFileSync(SECRET_FILE, 'utf8').trim();
    if (stored.length >= 16) {
      secretCache = stored;
      return secretCache;
    }
  } catch {
    // ainda não existe
  }

  const generated = crypto.randomBytes(24).toString('hex');
  try {
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
    fsSync.writeFileSync(SECRET_FILE, generated, { encoding: 'utf8', mode: 0o600 });
    console.log('[licenças] segredo local criado em data/.license-secret');
  } catch (err) {
    console.error('[licenças] não consegui salvar o segredo local:', err.message);
  }
  secretCache = generated;
  return secretCache;
}

function sign(planId, expiresAt) {
  return crypto
    .createHmac('sha256', licenseSecret())
    .update(`${planId}.${expiresAt}`)
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
}

export function generateLicense(planId, days = 30) {
  const id = String(planId || '').toLowerCase();
  if (!PLANS[id] || id === 'free') throw new Error('Plano inválido. Use "plus" ou "pro".');
  const validDays = Math.min(3650, Math.max(1, Number(days) || 30));
  const expiresAt = Date.now() + validDays * DAY_MS;
  return `LUME-${id.toUpperCase()}-${expiresAt.toString(36).toUpperCase()}-${sign(id, expiresAt)}`;
}

export function verifyLicense(code) {
  const clean = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = /^LUME-(PLUS|PRO)-([0-9A-Z]{4,12})-([A-F0-9]{20})$/.exec(clean);

  if (!match) throw new Error('Código inválido. Confira se copiou completo (ex.: LUME-PLUS-…).');

  const planId = match[1].toLowerCase();
  const expiresAt = parseInt(match[2], 36);
  const signature = match[3];

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) throw new Error('Código inválido.');

  const expected = sign(planId, expiresAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Código inválido. Confira se copiou completo e sem alterações.');
  }

  if (expiresAt <= Date.now()) throw new Error('Este código já expirou. Gere um novo com o suporte.');

  return { plan: planId, expiresAt: new Date(expiresAt).toISOString() };
}

export async function activateLicense(code) {
  const license = verifyLicense(code);
  const usage = await loadUsage();

  usage.plan = license.plan;
  usage.planExpiresAt = license.expiresAt;
  usage.activatedAt = new Date().toISOString();
  usage.days[todayKey()] = { messages: 0, attachments: 0 }; // bônus: zera o dia ao ativar

  pruneDays(usage);
  await persist();
  return getBillingStatus();
}
