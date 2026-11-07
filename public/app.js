/* ==========================================================================
   Lume AI — interface
   ========================================================================== */

const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  configured: false,
  keySource: null,
  keyPreview: '',
  settings: {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.7,
    persona: 'assistente',
    language: 'pt-BR',
    customInstructions: '',
    smartMode: true,
    webSearch: false,
    discordUrl: 'https://discord.gg/DHe8aZmTjK',
  },
  personas: [],
  models: [],
  billing: null,
  version: '1.4.0',
  publicMode: false,
  discordUrl: 'https://discord.gg/DHe8aZmTjK',
  conversations: [],
  current: null,
  search: '',
  streaming: false,
  abort: null,
  pending: [],
  theme: localStorage.getItem('lume-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
};

const els = {
  app: $('#app'),
  sidebar: $('#sidebar'),
  scrim: $('#scrim'),
  menuBtn: $('#menu-btn'),
  closeSidebar: $('#close-sidebar'),
  newChat: $('#new-chat'),
  convSearch: $('#conv-search'),
  convList: $('#conv-list'),
  usageCard: $('#usage-card'),
  planName: $('#plan-name'),
  usageLabel: $('#usage-label'),
  usageFill: $('#usage-fill'),
  status: $('#status'),
  statusDot: $('#status-dot'),
  statusText: $('#status-text'),
  settingsBtn: $('#settings-btn'),
  themeBtn: $('#theme-btn'),
  themeIcon: $('#theme-icon'),
  chatTitle: $('#chat-title'),
  modelBadge: $('#model-badge'),
  msgCount: $('#msg-count'),
  planBadge: $('#plan-badge'),
  exportBtn: $('#export-btn'),
  clearBtn: $('#clear-btn'),
  chatScroll: $('#chat-scroll'),
  messages: $('#messages'),
  welcome: $('#welcome'),
  welcomeNote: $('#welcome-note'),
  welcomeConfig: $('#welcome-config'),
  suggestions: $('#suggestions'),
  composer: $('#composer'),
  input: $('#input'),
  sendBtn: $('#send-btn'),
  stopBtn: $('#stop-btn'),
  smartToggle: $('#smart-toggle'),
  webToggle: $('#web-toggle'),
  attachBtn: $('#attach-btn'),
  fileInput: $('#file-input'),
  attachmentsPreview: $('#attachments-preview'),
  limitBanner: $('#limit-banner'),
  limitText: $('#limit-text'),
  limitUpgrade: $('#limit-upgrade'),
  toasts: $('#toasts'),
  settingsDialog: $('#settings-dialog'),
  settingsForm: $('#settings-form'),
  closeSettings: $('#close-settings'),
  cancelSettings: $('#cancel-settings'),
  saveSettings: $('#save-settings'),
  apiKey: $('#api-key'),
  keyPill: $('#key-pill'),
  removeKey: $('#remove-key'),
  modelSelect: $('#model-select'),
  modelHint: $('#model-hint'),
  refreshModels: $('#refresh-models'),
  personaSelect: $('#persona-select'),
  personaHint: $('#persona-hint'),
  temperature: $('#temperature'),
  tempLabel: $('#temp-label'),
  languageSelect: $('#language-select'),
  customInstructions: $('#custom-instructions'),
  testConnection: $('#test-connection'),
  testResult: $('#test-result'),
  discordUrl: $('#discord-url'),
  discordBtn: $('#discord-btn'),
  discordDialog: $('#discord-dialog'),
  closeDiscord: $('#close-discord'),
  closeDiscord2: $('#close-discord-2'),
  discordLink: $('#discord-link'),
  discordStatus: $('#discord-status'),
  discordSettings: $('#discord-settings'),
  plansDiscord: $('#plans-discord'),
  clearAll: $('#clear-all'),
  versionLabel: $('#version-label'),
  settingsPlan: $('#settings-plan'),
  openPlansFromSettings: $('#open-plans-from-settings'),
  plansDialog: $('#plans-dialog'),
  closePlans: $('#close-plans'),
  closePlans2: $('#close-plans-2'),
  usageSummary: $('#usage-summary'),
  plansGrid: $('#plans-grid'),
  licenseCode: $('#license-code'),
  activateLicense: $('#activate-license'),
  activationResult: $('#activation-result'),
};

/* ==========================================================================
   Utilidades
   ========================================================================== */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function safeAttachmentUrl(value) {
  const url = String(value || '');
  if (url.startsWith('/api/uploads/')) return url;
  if (url.startsWith('blob:')) return url;
  return '';
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  els.toasts.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  }, 4200);
}

async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${pathname}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = new Error(data?.error || `Erro ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    err.billing = data?.billing;
    throw err;
  }
  return data;
}

function relativeTime(iso) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (abs < 60) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function slug(value) {
  return String(value || 'conversa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'conversa';
}

/* ==========================================================================
   Markdown
   ========================================================================== */

function codeBlockHtml(block) {
  const lang = String(block.lang || '').replace(/[^\w+#.-]/g, '').slice(0, 20) || 'código';
  return `<div class="code-block"><div class="code-head"><span class="code-lang">${escapeHtml(lang)}</span><button class="copy-code" type="button">Copiar</button></div><pre><code>${escapeHtml(block.code)}</code></pre></div>`;
}

function renderMarkdown(source) {
  const blocks = [];
  let text = String(source || '').replace(/```([^\n`]*)\r?\n?([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
    blocks.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return `\u0000B${blocks.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  const inline = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    inline.push(code);
    return `\u0000I${inline.length - 1}\u0000`;
  });

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (match, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/\u0000I(\d+)\u0000/g, (match, index) => `<code>${inline[Number(index)]}</code>`);

  const lines = text.split('\n');
  let html = '';
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${paragraph.join('<br>')}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };
  const openList = (type) => {
    if (listType !== type) {
      closeList();
      html += `<${type}>`;
      listType = type;
    }
  };
  const splitRow = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const blockMatch = /^\u0000B(\d+)\u0000$/.exec(line);
    if (blockMatch) {
      flushParagraph();
      closeList();
      html += codeBlockHtml(blocks[Number(blockMatch[1])]);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${heading[2]}</h${level}>`;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      closeList();
      html += '<hr>';
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      html += `<blockquote>${quote[1]}</blockquote>`;
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length) {
      const separator = lines[i + 1].trim();
      if (separator.startsWith('|') && /^\|?[\s:|-]+\|?$/.test(separator) && separator.includes('-')) {
        flushParagraph();
        closeList();
        const header = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(splitRow(lines[i].trim()));
          i += 1;
        }
        i -= 1;
        html += `<table><thead><tr>${header.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`;
        continue;
      }
    }

    const unordered = /^[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      openList(type);
      html += `<li>${unordered ? unordered[1] : ordered[1]}</li>`;
      continue;
    }

    if (listType) closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();

  return html.replace(/\u0000B(\d+)\u0000/g, (match, index) => codeBlockHtml(blocks[Number(index)]));
}

/* ==========================================================================
   Estado / render
   ========================================================================== */

function modelName() {
  const model = state.models.find((item) => item.id === state.settings.model);
  return model?.name || state.settings.model;
}

function renderStatus() {
  els.status.classList.toggle('online', state.configured);
  els.status.classList.toggle('offline', !state.configured);
  els.statusText.textContent = state.publicMode
    ? 'Demonstração pública'
    : (state.configured ? 'Lume AI conectado' : 'Conectar Lume AI');
}

function renderHeader() {
  els.chatTitle.textContent = state.current?.title || 'Nova conversa';
  els.modelBadge.textContent = `Lume AI${state.settings.smartMode ? ' · Turbo' : ''}`;
  const count = state.current?.messages?.length || 0;
  els.msgCount.textContent = `${count} ${count === 1 ? 'mensagem' : 'mensagens'}`;
  els.planBadge.textContent = state.billing?.plan?.name || 'Grátis';
}

function renderBilling() {
  const billing = state.billing;
  if (!billing) return;

  const limit = billing.limits.messagesPerDay;
  const used = billing.usage.messages;
  els.planName.textContent = billing.plan.name;
  els.usageLabel.textContent = limit == null ? `${used} hoje · ilimitado` : `${used}/${limit} hoje`;
  const percent = limit == null ? (used ? 18 : 6) : Math.min(100, (used / limit) * 100);
  els.usageFill.style.width = `${percent}%`;
  els.usageCard.classList.toggle('limit', billing.remaining.messages === 0);

  els.limitBanner.hidden = billing.remaining.messages !== 0;
  els.limitText.textContent = `Você atingiu o limite diário do plano ${billing.plan.name}.`;

  els.planBadge.textContent = billing.plan.name;
  renderSettingsPlan();
  renderToggles();
  updateSendState();
}

function renderSettingsPlan() {
  const billing = state.billing;
  if (!billing) return;
  let text = billing.plan.name;
  if (billing.expiresAt) {
    text += ` · até ${new Date(billing.expiresAt).toLocaleDateString('pt-BR')}`;
  }
  els.settingsPlan.textContent = text;
}

function renderToggles() {
  const smart = Boolean(state.settings.smartMode);
  els.smartToggle.classList.toggle('active', smart);
  els.smartToggle.setAttribute('aria-pressed', String(smart));

  const webAllowed = Boolean(state.billing?.limits?.webSearch);
  const web = Boolean(state.settings.webSearch) && webAllowed;
  els.webToggle.classList.toggle('active', web);
  els.webToggle.classList.toggle('locked', !webAllowed);
  els.webToggle.setAttribute('aria-pressed', String(web));
  els.webToggle.title = webAllowed ? 'Pesquisar fatos atuais no Google' : 'Pesquisa na web está nos planos pagos';
}

function renderWelcomeNote() {
  if (state.publicMode) {
    els.welcomeNote.hidden = false;
    els.welcomeNote.textContent = 'Demonstração pública: as conversas ficam apenas nesta sessão. Para a versão completa, fale no Discord.';
    return;
  }
  els.welcomeNote.hidden = state.configured;
}

function updateSendState() {
  const blocked = state.billing?.remaining?.messages === 0;
  els.sendBtn.disabled = state.streaming || blocked || (!els.input.value.trim() && state.pending.length === 0);
}

function setStreamingUI(streaming) {
  state.streaming = streaming;
  els.stopBtn.hidden = !streaming;
  els.sendBtn.disabled = streaming || state.billing?.remaining?.messages === 0;
  if (!streaming) updateSendState();
}

function applyState(payload) {
  state.configured = payload.configured;
  state.keySource = payload.keySource;
  state.keyPreview = payload.keyPreview;
  state.settings = payload.settings;
  state.personas = payload.personas;
  state.models = payload.models;
  state.billing = payload.billing;
  state.version = payload.version || state.version;
  state.publicMode = Boolean(payload.publicMode);
  state.discordUrl = payload.discordUrl || payload.settings?.discordUrl || '';
  els.versionLabel.textContent = `Lume AI · v${state.version}`;

  renderStatus();
  renderHeader();
  renderBilling();
  renderWelcomeNote();
}

/* ==========================================================================
   Conversas
   ========================================================================== */

async function loadConversations() {
  const data = await api('/conversations');
  state.conversations = data.conversations || [];
  renderConversations();
}

function renderConversations() {
  els.convList.innerHTML = '';
  const query = state.search.trim().toLowerCase();
  const items = state.conversations.filter((conv) => !query || conv.title.toLowerCase().includes(query));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = query ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda. Comece pela caixa de mensagem.';
    els.convList.append(empty);
    return;
  }

  for (const conv of items) {
    const item = document.createElement('div');
    item.className = 'conv-item';
    item.dataset.id = conv.id;
    if (state.current?.id === conv.id) item.classList.add('active');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'conv-open';
    open.dataset.act = 'open';

    const name = document.createElement('span');
    name.className = 'conv-name';
    name.textContent = conv.title;

    const time = document.createElement('span');
    time.className = 'conv-time';
    time.textContent = `${relativeTime(conv.updatedAt)} · ${conv.messageCount} msg`;

    open.append(name, time);

    const tools = document.createElement('div');
    tools.className = 'conv-tools';

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.dataset.act = 'rename';
    rename.title = 'Renomear';
    rename.textContent = '✎';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.act = 'delete';
    remove.title = 'Apagar';
    remove.textContent = '🗑';

    tools.append(rename, remove);
    item.append(open, tools);
    els.convList.append(item);
  }
}

async function openConversation(id) {
  if (state.streaming) stopStreaming();
  try {
    const conv = await api(`/conversations/${id}`);
    state.current = conv;
    state.pending = [];
    renderPending();
    renderMessages();
    renderConversations();
    renderHeader();
    closeSidebar();
    els.input.focus();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function newChat() {
  if (state.streaming) stopStreaming();
  state.current = null;
  state.pending = [];
  renderPending();
  renderMessages();
  renderConversations();
  renderHeader();
  closeSidebar();
  els.input.value = '';
  autoGrow();
  updateSendState();
  els.input.focus();
}

async function syncCurrentConversation() {
  if (!state.current?.id) {
    renderMessages();
    renderHeader();
    return;
  }
  try {
    state.current = await api(`/conversations/${state.current.id}`);
  } catch (err) {
    if (err.status === 404) state.current = null;
  }
  renderMessages();
  renderHeader();
  renderConversations();
  await refreshBilling();
}

async function refreshBilling() {
  try {
    state.billing = await api('/plans');
    renderBilling();
  } catch {
    // silencioso
  }
}

async function renameConversation(id, currentTitle) {
  const title = window.prompt('Novo nome da conversa:', currentTitle);
  if (!title || !title.trim()) return;
  try {
    await api(`/conversations/${id}`, { method: 'PATCH', body: { title: title.trim() } });
    await loadConversations();
    if (state.current?.id === id) state.current.title = title.trim();
    renderConversations();
    renderHeader();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteConversation(id) {
  if (!window.confirm('Apagar esta conversa? Não dá para desfazer.')) return;
  try {
    await api(`/conversations/${id}`, { method: 'DELETE' });
    await loadConversations();
    if (state.current?.id === id) newChat();
    renderConversations();
    toast('Conversa apagada.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function clearCurrentConversation() {
  if (!state.current?.id) {
    newChat();
    return;
  }
  await deleteConversation(state.current.id);
}

/* ==========================================================================
   Mensagens
   ========================================================================== */

function appendMessageEl(message, isLastAssistant = false) {
  const row = document.createElement('article');
  row.className = `msg ${message.role}`;
  row.dataset.id = message.id || '';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  if (message.role === 'assistant') {
    avatar.innerHTML = '<svg viewBox="0 0 64 64" width="20" height="20"><use href="#flame" /></svg>';
  } else {
    avatar.textContent = 'EU';
  }

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = message.role === 'assistant' ? 'Lume AI' : 'Você';

  body.append(meta);

  if (message.role === 'assistant') {
    const content = document.createElement('div');
    content.className = 'msg-content md';
    content.innerHTML = renderMarkdown(message.content || '');
    body.append(content);
  } else if (message.content) {
    const content = document.createElement('div');
    content.className = 'msg-content';
    content.textContent = message.content;
    body.append(content);
  }

  if (Array.isArray(message.attachments) && message.attachments.length) {
    const grid = document.createElement('div');
    grid.className = 'msg-attachments';
    for (const att of message.attachments) {
      const attachmentUrl = safeAttachmentUrl(att?.url);
      if (!attachmentUrl) continue;
      const isLogo = att?.kind === 'logo';
      const isImage = att?.kind === 'image';
      const isGenerated = isLogo || isImage;
      const link = document.createElement('a');
      link.className = `msg-attachment${isLogo ? ' logo' : ''}${isImage ? ' image' : ''}${isGenerated && att.transparent ? ' transparent' : ''}`;
      link.href = attachmentUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = isLogo ? 'Baixar logo' : isImage ? 'Baixar imagem' : (att.name || 'anexo');
      if (isGenerated) {
        link.setAttribute('download', att.name || `${isImage ? 'imagem' : 'logo'}.${att.format || 'png'}`);
      }
      if (isImage && /^\d+:\d+$/.test(String(att.aspectRatio || ''))) {
        const [w, h] = String(att.aspectRatio).split(':').map(Number);
        if (w && h) link.style.setProperty('--att-ratio', `${w} / ${h}`);
      }

      if (String(att.mimeType || '').startsWith('image/')) {
        const img = document.createElement('img');
        img.src = attachmentUrl;
        img.alt = att.name || (isLogo ? 'logo gerada' : isImage ? 'imagem gerada' : 'anexo');
        img.loading = isImage ? 'eager' : 'lazy';
        link.append(img);
      } else {
        link.classList.add('pdf');
        const icon = document.createElement('span');
        icon.className = 'pdf-icon';
        icon.textContent = '📄';
        const name = document.createElement('span');
        name.textContent = att.name || 'PDF';
        link.append(icon, name);
      }
      grid.append(link);
    }
    body.append(grid);
  }

  if (message.interrupted) {
    const note = document.createElement('div');
    note.className = 'interrupted-note';
    note.textContent = '(resposta interrompida)';
    body.append(note);
  }

  if (Array.isArray(message.sources) && message.sources.length) {
    const sources = document.createElement('div');
    sources.className = 'msg-sources';
    for (const source of message.sources) {
      const sourceUrl = safeHttpUrl(source?.uri);
      if (!sourceUrl) continue;
      const link = document.createElement('a');
      link.className = 'source-chip';
      link.href = sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `🔗 ${source.title || source.uri}`;
      link.title = source.title || source.uri;
      sources.append(link);
    }
    body.append(sources);
  }

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.dataset.act = 'copy';
  copy.textContent = 'Copiar';
  actions.append(copy);

  if (message.role === 'assistant' && isLastAssistant) {
    const regen = document.createElement('button');
    regen.type = 'button';
    regen.dataset.act = 'regen';
    regen.textContent = 'Regerar';
    actions.append(regen);
  }

  body.append(actions);
  row.append(avatar, body);
  els.messages.append(row);
}

function renderMessages() {
  els.messages.innerHTML = '';
  const messages = state.current?.messages || [];
  els.welcome.hidden = messages.length > 0;

  if (!messages.length) return;

  let lastAssistant = -1;
  messages.forEach((message, index) => {
    if (message.role === 'assistant') lastAssistant = index;
  });

  messages.forEach((message, index) => appendMessageEl(message, index === lastAssistant));
  scrollToBottom(true);
}

function createStreamingMessage() {
  els.welcome.hidden = true;

  const row = document.createElement('article');
  row.className = 'msg assistant streaming';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.innerHTML = '<svg viewBox="0 0 64 64" width="20" height="20"><use href="#flame" /></svg>';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = 'Lume AI';

  const content = document.createElement('div');
  content.className = 'msg-content md';
  content.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  body.append(meta, content);
  row.append(avatar, body);
  els.messages.append(row);
  scrollToBottom(true);

  let text = '';
  let thinking = false;
  let frame = null;
  let sources = [];
  let status = '';

  const paint = () => {
    frame = null;
    content.innerHTML = renderMarkdown(text);
    if (thinking && !text) {
      content.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      if (status) {
        const note = document.createElement('div');
        note.className = 'thinking-note';
        note.textContent = status;
        content.append(note);
      }
    }
    if (thinking && text) {
      const note = document.createElement('div');
      note.className = 'thinking-note';
      note.textContent = status || 'refinando a resposta…';
      content.append(note);
    }
    if (sources.length && text) {
      const box = document.createElement('div');
      box.className = 'msg-sources';
      for (const source of sources) {
        const sourceUrl = safeHttpUrl(source?.uri);
        if (!sourceUrl) continue;
        const link = document.createElement('a');
        link.className = 'source-chip';
        link.href = sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `🔗 ${source.title || sourceUrl}`;
        box.append(link);
      }
      content.append(box);
    }
  };

  return {
    row,
    append(chunk) {
      text += chunk;
      thinking = false;
      if (!frame) frame = requestAnimationFrame(paint);
      if (isNearBottom()) scrollToBottom();
    },
    showThinking() {
      thinking = true;
      if (!text && !frame) frame = requestAnimationFrame(paint);
    },
    setStatus(message) {
      status = String(message || '');
      thinking = true;
      if (!frame) frame = requestAnimationFrame(paint);
      if (isNearBottom()) scrollToBottom();
    },
    setSources(next) {
      sources = next || [];
    },
    error(message) {
      row.classList.remove('streaming');
      row.classList.add('error');
      content.textContent = message;
    },
    remove() {
      row.remove();
    },
    getText() {
      return text;
    },
  };
}

function isNearBottom() {
  const el = els.chatScroll;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
}

function scrollToBottom(force = false) {
  if (force || isNearBottom()) {
    els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
  }
}

async function readSSE(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      let event = 'message';
      const dataLines = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;

      let payload;
      try {
        payload = JSON.parse(dataLines.join('\n'));
      } catch {
        continue;
      }
      onEvent(event, payload);
    }
  }
}

async function streamRequest(body, stream) {
  state.streaming = true;
  setStreamingUI(true);

  const controller = new AbortController();
  state.abort = controller;

  let accepted = false;
  let gotText = false;
  let donePayload = null;
  let errorMessage = null;
  let noticeShown = false;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const err = new Error(data?.error || `Erro ${res.status}`);
      err.code = data?.code;
      err.billing = data?.billing;
      throw err;
    }

    accepted = true;

    await readSSE(res.body, (event, payload) => {
      if (event === 'meta') {
        if (payload.title && state.current) state.current.title = payload.title;
        if (payload.model) state.settings.model = payload.model;
        if (payload.notice && !noticeShown) {
          noticeShown = true;
          toast(payload.notice, 'info');
        }
        if (payload.billing) {
          state.billing = payload.billing;
          renderBilling();
        }
        renderHeader();
      } else if (event === 'thinking') {
        stream.showThinking();
      } else if (event === 'status') {
        stream.setStatus(payload.message || '');
      } else if (event === 'delta') {
        gotText = true;
        stream.append(payload.text || '');
      } else if (event === 'sources') {
        stream.setSources(payload.sources || []);
      } else if (event === 'done') {
        donePayload = payload;
      } else if (event === 'error') {
        const err = new Error(payload.error || 'Erro ao falar com o Lume AI.');
        err.code = payload.code;
        throw err;
      }
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      toast('Resposta interrompida.');
    } else {
      errorMessage = err.message || 'Erro ao falar com o Lume AI.';
      if (!gotText) stream.error(errorMessage);
      toast(errorMessage, 'error');
      if (err.billing) {
        state.billing = err.billing;
        renderBilling();
      }
    }
  } finally {
    state.streaming = false;
    state.abort = null;
    setStreamingUI(false);
  }

  if (donePayload?.conversation) {
    state.current = donePayload.conversation;
    if (donePayload.billing) state.billing = donePayload.billing;
    await loadConversations().catch(() => {});
    renderMessages();
    renderHeader();
    renderBilling();
    renderConversations();
    scrollToBottom(true);
    return { ok: true, done: true, accepted, gotText };
  }

  await syncCurrentConversation();
  return { ok: false, done: false, accepted, gotText, error: errorMessage };
}

async function ensureConversation() {
  if (state.current?.id) return state.current;
  try {
    const conv = await api('/conversations', { method: 'POST', body: {} });
    state.current = conv;
    await loadConversations();
    renderConversations();
    return conv;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}

async function sendMessage() {
  const text = els.input.value.trim();
  if (state.streaming) return;
  if (!text && !state.pending.length) return;

  if (!state.configured) {
    openSettings();
    toast('Conecte o Lume AI em Configurações para conversar.', 'error');
    return;
  }

  if (state.billing?.remaining?.messages === 0) {
    openPlans();
    toast('Limite diário atingido. Veja os planos para continuar hoje.', 'error');
    return;
  }

  const files = state.pending.slice();
  const remainingAttachments = state.billing?.remaining?.attachments;
  if (files.length && remainingAttachments != null && remainingAttachments < files.length) {
    openPlans();
    toast('Você não tem anexos suficientes hoje. Veja os planos.', 'error');
    return;
  }

  let attachments = [];
  try {
    attachments = await Promise.all(
      files.map(async (item) => ({
        name: item.file.name,
        mimeType: item.file.type,
        data: await fileToBase64(item.file),
      })),
    );
  } catch {
    toast('Não consegui ler um dos anexos. Tente de novo.', 'error');
    return;
  }

  els.input.value = '';
  autoGrow();
  state.pending = [];
  renderPending();

  const conv = await ensureConversation();
  if (!conv) {
    restorePending(files);
    els.input.value = text;
    autoGrow();
    updateSendState();
    return;
  }

  const beforeCount = conv.messages.length;
  const localMessage = {
    id: `local-${Date.now()}`,
    role: 'user',
    content: text,
    at: new Date().toISOString(),
    attachments: files.map((item) => ({
      name: item.file.name,
      mimeType: item.file.type,
      size: item.file.size,
      url: item.url,
    })),
  };

  state.current.messages.push(localMessage);
  els.welcome.hidden = true;
  appendMessageEl(localMessage, false);
  scrollToBottom(true);
  renderHeader();
  updateSendState();

  const stream = createStreamingMessage();
  const result = await streamRequest({ conversationId: conv.id, message: text, attachments }, stream);

  if (!result.ok && !result.done) {
    const saved = (state.current?.messages?.length || 0) > beforeCount;
    if (!saved) {
      restorePending(files);
      if (!els.input.value.trim()) {
        els.input.value = text;
        autoGrow();
      }
      updateSendState();
    }
  }
}

function restorePending(files) {
  if (!files.length) return;
  for (const item of files) {
    if (!state.pending.some((pending) => pending.id === item.id)) state.pending.push(item);
  }
  renderPending();
  updateSendState();
}

async function regenerate() {
  if (state.streaming || !state.current?.id) return;

  if (state.billing?.remaining?.messages === 0) {
    openPlans();
    toast('Limite diário atingido. Veja os planos para continuar hoje.', 'error');
    return;
  }

  while (state.current.messages.length && state.current.messages[state.current.messages.length - 1].role === 'assistant') {
    state.current.messages.pop();
  }
  renderMessages();
  renderHeader();

  const stream = createStreamingMessage();
  await streamRequest({ conversationId: state.current.id, regenerate: true }, stream);
}

function stopStreaming() {
  if (state.abort) state.abort.abort();
}

/* ==========================================================================
   Anexos
   ========================================================================== */

function renderPending() {
  els.attachmentsPreview.innerHTML = '';
  els.attachmentsPreview.hidden = state.pending.length === 0;

  for (const item of state.pending) {
    const box = document.createElement('div');
    box.className = 'attach-item';

    if (item.file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.file.name;
      box.append(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = '📄';
      box.append(icon);
    }

    const name = document.createElement('span');
    name.className = 'attach-name';
    name.textContent = item.file.name;
    box.append(name);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'attach-remove';
    remove.dataset.id = item.id;
    remove.title = 'Remover anexo';
    remove.textContent = '✕';
    box.append(remove);

    els.attachmentsPreview.append(box);
  }

  updateSendState();
}

function addFiles(fileList) {
  const billing = state.billing;
  if (!billing) return;

  const limits = billing.limits;
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

  for (const file of fileList) {
    if (state.pending.length >= limits.maxAttachmentsPerMessage) {
      toast(`O plano ${billing.plan.name} permite até ${limits.maxAttachmentsPerMessage} anexos por mensagem.`, 'error');
      break;
    }
    if (!allowed.includes(file.type)) {
      toast(`${file.name}: formato não suportado. Use PNG, JPG, WEBP, HEIC ou PDF.`, 'error');
      continue;
    }
    if (file.size > limits.maxAttachmentMb * 1024 * 1024) {
      toast(`${file.name}: maior que ${limits.maxAttachmentMb} MB (limite do plano ${billing.plan.name}).`, 'error');
      continue;
    }
    if (billing.remaining.attachments === 0) {
      openPlans();
      toast('Seus anexos do dia acabaram. Veja os planos.', 'error');
      break;
    }

    state.pending.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    });
  }

  renderPending();
}

/* ==========================================================================
   Planos
   ========================================================================== */

function openPlans() {
  renderPlans();
  if (!els.plansDialog.open) els.plansDialog.showModal();
}

function renderPlans() {
  const billing = state.billing;
  if (!billing) return;

  const limitMessages = billing.limits.messagesPerDay;
  const limitAttachments = billing.limits.attachmentsPerDay;
  const resetDate = billing.resetAt ? new Date(`${billing.resetAt}T12:00:00`).toLocaleDateString('pt-BR') : '—';
  const expiryText = billing.expiresAt ? ` · expira em ${new Date(billing.expiresAt).toLocaleDateString('pt-BR')}` : '';

  els.usageSummary.innerHTML = `
    <span>Plano atual: <strong>${escapeHtml(billing.plan.name)}${escapeHtml(expiryText)}</strong></span>
    <span>Mensagens hoje: <strong>${billing.usage.messages}${limitMessages == null ? ' (ilimitado)' : `/${limitMessages}`}</strong></span>
    <span>Anexos hoje: <strong>${billing.usage.attachments}${limitAttachments == null ? ' (ilimitado)' : `/${limitAttachments}`}</strong></span>
    <span>Renova em: <strong>${escapeHtml(resetDate)}</strong></span>
  `;

  els.plansGrid.innerHTML = '';

  for (const plan of billing.plans) {
    const current = plan.id === billing.plan.id;
    const card = document.createElement('div');
    card.className = `plan-card${plan.highlight ? ' highlight' : ''}${current ? ' current' : ''}`;

    const emoji = document.createElement('div');
    emoji.className = 'plan-emoji';
    emoji.textContent = plan.emoji;

    const name = document.createElement('h3');
    name.textContent = plan.name;

    const tagline = document.createElement('p');
    tagline.className = 'plan-tagline';
    tagline.textContent = plan.tagline;

    const price = document.createElement('div');
    price.className = 'plan-price';
    price.innerHTML = `<strong>${escapeHtml(plan.priceLabel)}</strong><span>${escapeHtml(plan.period)}</span>`;

    const features = document.createElement('ul');
    features.className = 'plan-features';
    for (const feature of plan.features) {
      const li = document.createElement('li');
      li.textContent = feature;
      features.append(li);
    }

    if (current) {
      const badge = document.createElement('span');
      badge.className = 'pill on';
      badge.textContent = 'Plano atual';
      card.append(emoji, name, tagline, price, features, badge);
    } else if (plan.id === 'free') {
      const note = document.createElement('span');
      note.className = 'pill';
      note.textContent = 'Incluído';
      card.append(emoji, name, tagline, price, features, note);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary-btn plan-cta';
      const checkout = billing.checkout?.[plan.id];
      button.textContent = checkout ? 'Assinar agora' : 'Como assinar?';
      button.addEventListener('click', () => {
        if (checkout) {
          window.open(checkout, '_blank', 'noopener,noreferrer');
        } else {
          els.licenseCode.focus();
          toast('Faça o pagamento com o suporte e ative com o código que você receber.', 'info');
        }
      });
      card.append(emoji, name, tagline, price, features, button);
    }

    els.plansGrid.append(card);
  }
}

async function activateLicense() {
  const code = els.licenseCode.value.trim();
  if (!code) {
    els.activationResult.textContent = 'Digite o código de ativação.';
    els.activationResult.className = 'field-help bad';
    return;
  }

  els.activateLicense.disabled = true;
  els.activationResult.textContent = 'Validando…';
  els.activationResult.className = 'field-help';

  try {
    const data = await api('/plan/activate', { method: 'POST', body: { code } });
    state.billing = data.billing;
    renderBilling();
    renderPlans();
    els.licenseCode.value = '';
    els.activationResult.textContent = `Plano ${data.billing.plan.name} ativado! Bom proveito.`;
    els.activationResult.className = 'field-help ok';
    toast(`Plano ${data.billing.plan.name} ativado.`, 'success');
  } catch (err) {
    els.activationResult.textContent = err.message;
    els.activationResult.className = 'field-help bad';
  } finally {
    els.activateLicense.disabled = false;
  }
}

/* ==========================================================================
   Configurações
   ========================================================================== */

function fillModelSelect() {
  els.modelSelect.innerHTML = '';
  for (const model of state.models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    els.modelSelect.append(option);
  }
  if (state.settings.model && !state.models.some((model) => model.id === state.settings.model)) {
    const option = document.createElement('option');
    option.value = state.settings.model;
    option.textContent = state.settings.model;
    els.modelSelect.append(option);
  }
  els.modelSelect.value = state.settings.model;
  updateModelHint();
}

function fillPersonaSelect() {
  els.personaSelect.innerHTML = '';
  for (const persona of state.personas) {
    const option = document.createElement('option');
    option.value = persona.id;
    option.textContent = `${persona.emoji} ${persona.name}`;
    els.personaSelect.append(option);
  }
  els.personaSelect.value = state.settings.persona;
  updatePersonaHint();
}

function updateModelHint() {
  const model = state.models.find((item) => item.id === els.modelSelect.value);
  els.modelHint.textContent = model?.hint || 'O Lume AI escolhe o melhor modelo automaticamente.';
}

function updatePersonaHint() {
  const persona = state.personas.find((item) => item.id === els.personaSelect.value);
  els.personaHint.textContent = persona?.description || 'Como o Lume AI deve conversar com você.';
}

function temperatureLabel(value) {
  const number = Number(value);
  if (number <= 0.3) return 'preciso';
  if (number <= 0.7) return 'equilibrado';
  if (number <= 1.1) return 'criativo';
  return 'muito criativo';
}

function openSettings() {
  if (state.publicMode) {
    toast('A demonstração pública não permite alterar configurações.', 'info');
    return;
  }
  els.apiKey.value = '';
  els.apiKey.placeholder = state.configured
    ? `Salva (${state.keyPreview}) — deixe vazio para manter`
    : 'Cole sua chave AIza…';
  els.keyPill.textContent = state.configured ? 'configurada' : 'não configurada';
  els.keyPill.className = `pill ${state.configured ? 'on' : 'off'}`;
  els.removeKey.disabled = !state.configured;

  fillModelSelect();
  fillPersonaSelect();

  els.temperature.value = state.settings.temperature;
  els.tempLabel.textContent = `${Number(state.settings.temperature).toFixed(1)} · ${temperatureLabel(state.settings.temperature)}`;
  els.languageSelect.value = state.settings.language;
  els.customInstructions.value = state.settings.customInstructions || '';
  els.discordUrl.value = state.settings.discordUrl || state.discordUrl || '';
  els.testResult.textContent = '';
  els.testResult.className = 'test-result';
  els.versionLabel.textContent = `Lume AI · v${state.version}`;
  renderSettingsPlan();

  if (!els.settingsDialog.open) els.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  const body = {
    model: els.modelSelect.value,
    persona: els.personaSelect.value,
    language: els.languageSelect.value,
    temperature: Number(els.temperature.value),
    customInstructions: els.customInstructions.value,
    discordUrl: els.discordUrl.value.trim(),
  };
  if (els.apiKey.value.trim()) body.apiKey = els.apiKey.value.trim();

  els.saveSettings.disabled = true;
  try {
    const payload = await api('/settings', { method: 'PUT', body });
    applyState(payload);
    els.settingsDialog.close();
    toast('Configurações salvas.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    els.saveSettings.disabled = false;
  }
}

async function testConnection() {
  els.testConnection.disabled = true;
  els.testResult.textContent = 'Testando…';
  els.testResult.className = 'test-result';

  try {
    const data = await api('/settings/test', {
      method: 'POST',
      body: { apiKey: els.apiKey.value.trim(), model: els.modelSelect.value },
    });
    els.testResult.textContent = `Lume AI conectado · ${data.latencyMs} ms`;
    els.testResult.className = 'test-result ok';
  } catch (err) {
    els.testResult.textContent = err.message;
    els.testResult.className = 'test-result bad';
  } finally {
    els.testConnection.disabled = false;
  }
}

async function refreshModels() {
  els.refreshModels.disabled = true;
  try {
    const data = await api('/models', {
      method: 'POST',
      body: { apiKey: els.apiKey.value.trim() },
    });
    state.models = data.models;
    fillModelSelect();
    toast(`${data.models.length} modelos disponíveis.`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    els.refreshModels.disabled = false;
  }
}

async function removeApiKey() {
  if (!window.confirm('Remover a chave de conexão do Lume AI salva neste computador?')) return;
  try {
    const payload = await api('/settings', { method: 'PUT', body: { removeApiKey: true } });
    applyState(payload);
    openSettings();
    toast('Chave removida.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function clearAllConversations() {
  if (!window.confirm('Apagar TODAS as conversas? Isso não pode ser desfeito.')) return;
  try {
    await api('/conversations', { method: 'DELETE' });
    await loadConversations();
    newChat();
    toast('Histórico apagado.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleSmartMode() {
  const next = !state.settings.smartMode;
  try {
    const payload = await api('/settings', { method: 'PUT', body: { smartMode: next } });
    applyState(payload);
    toast(next ? 'Modo inteligente ativado.' : 'Modo rápido ativado.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleWebSearch() {
  if (!state.billing?.limits?.webSearch) {
    openPlans();
    toast('Pesquisa na web está disponível nos planos Plus e Pro.', 'info');
    return;
  }
  const next = !state.settings.webSearch;
  try {
    const payload = await api('/settings', { method: 'PUT', body: { webSearch: next } });
    applyState(payload);
    toast(next ? 'Pesquisa na web ativada.' : 'Pesquisa na web desativada.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   Exportar / tema / mobile
   ========================================================================== */

function exportConversation() {
  if (!state.current?.messages?.length) {
    toast('Não há conversa para exportar.', 'error');
    return;
  }

  const lines = [
    `# ${state.current.title}`,
    '',
    `_Exportado do Lume AI em ${new Date().toLocaleString('pt-BR')}_`,
    '',
  ];

  for (const message of state.current.messages) {
    lines.push(`## ${message.role === 'user' ? 'Você' : 'Lume AI'}`);
    if (message.content) lines.push('', message.content);
    for (const att of message.attachments || []) {
      lines.push('', `- Anexo: ${att.name} (${Math.round((att.size || 0) / 1024)} KB)`);
    }
    for (const source of message.sources || []) {
      lines.push('', `- Fonte: [${source.title}](${source.uri})`);
    }
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lume-${slug(state.current.title)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  els.themeIcon.textContent = state.theme === 'dark' ? '☀' : '☾';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#0b0a09' : '#f8f4ed');
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('lume-theme', state.theme);
  applyTheme();
}

function openSidebar() {
  els.sidebar.classList.add('open');
  els.scrim.hidden = false;
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.scrim.hidden = true;
}

function autoGrow() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(els.input.scrollHeight, 200)}px`;
}

/* ==========================================================================
   Discord / comunidade
   ========================================================================== */

function renderDiscord() {
  const url = safeHttpUrl(state.settings.discordUrl || state.discordUrl);
  if (url) {
    els.discordStatus.textContent = 'Entre na comunidade para suporte, novidades e compra de planos.';
    els.discordLink.href = url;
    els.discordLink.hidden = false;
  } else {
    els.discordStatus.textContent = 'O link do Discord ainda não foi configurado.';
    els.discordLink.href = '#';
    els.discordLink.hidden = true;
  }
}

function openDiscord() {
  const url = safeHttpUrl(state.settings.discordUrl || state.discordUrl);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  renderDiscord();
  if (!els.discordDialog.open) els.discordDialog.showModal();
}

/* ==========================================================================
   Eventos
   ========================================================================== */

function bindEvents() {
  els.newChat.addEventListener('click', newChat);
  els.menuBtn.addEventListener('click', openSidebar);
  els.closeSidebar.addEventListener('click', closeSidebar);
  els.scrim.addEventListener('click', closeSidebar);
  els.themeBtn.addEventListener('click', toggleTheme);
  els.settingsBtn.addEventListener('click', openSettings);
  els.status.addEventListener('click', openSettings);
  els.planBadge.addEventListener('click', openPlans);
  els.usageCard.addEventListener('click', openPlans);
  els.limitUpgrade.addEventListener('click', openPlans);
  els.welcomeConfig.addEventListener('click', openSettings);
  els.discordBtn.addEventListener('click', openDiscord);
  els.closeDiscord.addEventListener('click', () => els.discordDialog.close());
  els.closeDiscord2.addEventListener('click', () => els.discordDialog.close());
  els.discordSettings.addEventListener('click', () => {
    els.discordDialog.close();
    openSettings();
    setTimeout(() => els.discordUrl.focus(), 60);
  });

  els.convSearch.addEventListener('input', () => {
    state.search = els.convSearch.value;
    renderConversations();
  });

  els.convList.addEventListener('click', (event) => {
    const item = event.target.closest('.conv-item');
    if (!item) return;
    const id = item.dataset.id;
    const conv = state.conversations.find((entry) => entry.id === id);
    const action = event.target.closest('[data-act]')?.dataset.act;

    if (action === 'rename' && conv) renameConversation(id, conv.title);
    else if (action === 'delete') deleteConversation(id);
    else openConversation(id);
  });

  els.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
  });

  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  });

  els.input.addEventListener('input', () => {
    autoGrow();
    updateSendState();
  });

  els.sendBtn.addEventListener('click', (event) => {
    event.preventDefault();
    sendMessage();
  });

  els.stopBtn.addEventListener('click', stopStreaming);

  els.smartToggle.addEventListener('click', toggleSmartMode);
  els.webToggle.addEventListener('click', toggleWebSearch);

  els.attachBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    addFiles([...els.fileInput.files]);
    els.fileInput.value = '';
  });

  els.attachmentsPreview.addEventListener('click', (event) => {
    const button = event.target.closest('.attach-remove');
    if (!button) return;
    state.pending = state.pending.filter((item) => item.id !== button.dataset.id);
    renderPending();
  });

  els.suggestions.addEventListener('click', (event) => {
    const button = event.target.closest('.suggestion');
    if (!button) return;
    els.input.value = button.dataset.prompt || '';
    autoGrow();
    sendMessage();
  });

  els.messages.addEventListener('click', async (event) => {
    const codeButton = event.target.closest('.copy-code');
    if (codeButton) {
      const code = codeButton.closest('.code-block')?.querySelector('code')?.innerText || '';
      await copyText(code);
      codeButton.textContent = 'Copiado!';
      setTimeout(() => {
        codeButton.textContent = 'Copiar';
      }, 1600);
      return;
    }

    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'copy') {
      const row = event.target.closest('.msg');
      const message = state.current?.messages?.find((item) => item.id === row?.dataset.id);
      if (message?.content) {
        await copyText(message.content);
        toast('Mensagem copiada.', 'success');
      }
    } else if (action === 'regen') {
      regenerate();
    }
  });

  els.exportBtn.addEventListener('click', exportConversation);
  els.clearBtn.addEventListener('click', clearCurrentConversation);

  els.settingsForm.addEventListener('submit', saveSettings);
  els.closeSettings.addEventListener('click', () => els.settingsDialog.close());
  els.cancelSettings.addEventListener('click', () => els.settingsDialog.close());
  els.temperature.addEventListener('input', () => {
    els.tempLabel.textContent = `${Number(els.temperature.value).toFixed(1)} · ${temperatureLabel(els.temperature.value)}`;
  });
  els.modelSelect.addEventListener('change', updateModelHint);
  els.personaSelect.addEventListener('change', updatePersonaHint);
  els.refreshModels.addEventListener('click', refreshModels);
  els.testConnection.addEventListener('click', testConnection);
  els.removeKey.addEventListener('click', removeApiKey);
  els.clearAll.addEventListener('click', clearAllConversations);
  els.openPlansFromSettings.addEventListener('click', () => {
    els.settingsDialog.close();
    openPlans();
  });

  els.closePlans.addEventListener('click', () => els.plansDialog.close());
  els.closePlans2.addEventListener('click', () => els.plansDialog.close());
  els.plansDiscord.addEventListener('click', () => {
    els.plansDialog.close();
    openDiscord();
  });
  els.activateLicense.addEventListener('click', activateLicense);
  els.licenseCode.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      activateLicense();
    }
  });

  for (const dialog of [els.settingsDialog, els.plansDialog, els.discordDialog]) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      newChat();
    }
    if (event.key === 'Escape') closeSidebar();
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

/* ==========================================================================
   Inicialização
   ========================================================================== */

async function init() {
  applyTheme();
  bindEvents();
  autoGrow();

  try {
    const payload = await api('/state');
    applyState(payload);
    await loadConversations();
    renderMessages();
    renderHeader();
    renderWelcomeNote();
    renderBilling();
    els.input.focus();
  } catch (err) {
    renderStatus();
    els.status.classList.add('offline');
    els.statusText.textContent = 'Servidor indisponível';
    toast('Não consegui falar com o servidor do Lume AI. Ele está rodando?', 'error');
  }
}

init();
