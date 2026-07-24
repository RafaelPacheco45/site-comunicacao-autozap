"use strict";

/*
 * CONFIGURAÇÃO DA API
 * -------------------
 * Canal público de pré-cadastro de fornecedores, servido pelo backend real
 * da AutoZap (aip.autozap.log.br). Não exige login: cada envio vira um
 * "lead" para revisão manual do time, sem criar usuário/fornecedor real.
 */
const API_CONFIG = {
  baseUrl: "https://aip.autozap.log.br",
  endpoints: {
    cadastro: "/public/fornecedor-lead",
    mensagens: (leadId) => `/public/fornecedor-lead/${encodeURIComponent(leadId)}/mensagens`,
  },
};

const STORAGE_KEY = "autozap_comunicacao_fornecedor";

const els = {
  navStatus: document.getElementById("navStatus"),
  navSupplierName: document.getElementById("navSupplierName"),
  navCta: document.getElementById("navCta"),

  heroBanner: document.getElementById("heroBanner"),
  viewCadastro: document.getElementById("viewCadastro"),
  viewMensagens: document.getElementById("viewMensagens"),

  formCadastro: document.getElementById("formCadastro"),
  btnCadastrar: document.getElementById("btnCadastrar"),
  cadastroStatus: document.getElementById("cadastroStatus"),

  resumoNome: document.getElementById("resumoNome"),
  resumoDetalhe: document.getElementById("resumoDetalhe"),
  btnEditarCadastro: document.getElementById("btnEditarCadastro"),

  chatLog: document.getElementById("chatLog"),
  chatInputRow: document.getElementById("chatInputRow"),
  mensagemTexto: document.getElementById("mensagemTexto"),
  btnEnviarMensagem: document.getElementById("btnEnviarMensagem"),
  mensagemStatus: document.getElementById("mensagemStatus"),
  emailFollowup: document.getElementById("emailFollowup"),
  followupEmail: document.getElementById("followupEmail"),
};

const PREFILL_MAP = {
  nome_responsavel: "nome",
  nome: "nome",
  empresa: "empresa",
  cnpj: "cnpj",
  email: "email",
  telefone: "telefone",
  whatsapp: "telefone",
  cidade: "cidade",
  uf: "uf",
  categoria: "categoria",
};

// Outros sites (ex.: autozap-partner) usam categorias próprias, diferentes
// das opções deste formulário. Traduz pro equivalente mais próximo.
const CATEGORIA_ALIASES = {
  "capinhas": "Celulares e acessórios",
  "películas": "Celulares e acessórios",
  "peliculas": "Celulares e acessórios",
  "acessórios": "Celulares e acessórios",
  "acessorios": "Celulares e acessórios",
  "peças e assistência": "Peças e componentes",
  "pecas e assistencia": "Peças e componentes",
  "assistência técnica": "Peças e componentes",
  "assistencia tecnica": "Peças e componentes",
  "outros produtos": "Outro",
};

function resolveCategoriaValue(rawValue, selectEl) {
  const options = Array.from(selectEl.options).map((opt) => opt.value);
  if (options.includes(rawValue)) return rawValue;

  const normalized = rawValue.trim().toLowerCase();
  const exactCi = options.find((opt) => opt.toLowerCase() === normalized);
  if (exactCi) return exactCi;

  return CATEGORIA_ALIASES[normalized] || "";
}

function getQueryParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

function applyPrefillFromQuery() {
  const params = getQueryParams();
  let hasPrefill = false;

  for (const [paramName, fieldId] of Object.entries(PREFILL_MAP)) {
    const value = params.get(paramName);
    if (!value) continue;
    const input = document.getElementById(fieldId);
    if (!input) continue;

    if (fieldId === "categoria" && input.tagName === "SELECT") {
      const resolved = resolveCategoriaValue(value, input);
      if (!resolved) continue;
      input.value = resolved;
    } else if (fieldId === "telefone") {
      input.value = maskPhone(value);
    } else if (fieldId === "cnpj") {
      input.value = maskCnpj(value);
    } else {
      input.value = value;
    }
    hasPrefill = true;
  }

  return hasPrefill;
}

function apiUrl(path) {
  return API_CONFIG.baseUrl ? API_CONFIG.baseUrl.replace(/\/$/, "") + path : null;
}

async function postJson(path, payload) {
  const url = apiUrl(path);
  if (!url) {
    return { ok: false, offline: true, data: null };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, offline: false, data };
  } catch (err) {
    return { ok: false, offline: true, data: null };
  }
}

/* ---------- Máscaras e validação ---------- */

function maskCnpj(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

document.getElementById("cnpj").addEventListener("input", (e) => {
  e.target.value = maskCnpj(e.target.value);
});

document.getElementById("telefone").addEventListener("input", (e) => {
  e.target.value = maskPhone(e.target.value);
});

function setFieldError(name, message) {
  const input = document.getElementById(name);
  const errorEl = document.querySelector(`[data-error-for="${name}"]`);
  if (message) {
    input.classList.add("invalid");
    if (errorEl) errorEl.textContent = message;
  } else {
    input.classList.remove("invalid");
    if (errorEl) errorEl.textContent = "";
  }
}

function validateCadastro(data) {
  let valid = true;

  if (!data.nome.trim()) { setFieldError("nome", "Informe o nome do responsável."); valid = false; }
  else setFieldError("nome", "");

  if (!data.empresa.trim()) { setFieldError("empresa", "Informe o nome da empresa."); valid = false; }
  else setFieldError("empresa", "");

  const cnpjDigits = data.cnpj.replace(/\D/g, "");
  if (cnpjDigits.length !== 14) { setFieldError("cnpj", "CNPJ deve ter 14 dígitos."); valid = false; }
  else setFieldError("cnpj", "");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
  if (!emailOk) { setFieldError("email", "Informe um e-mail válido."); valid = false; }
  else setFieldError("email", "");

  const telDigits = data.telefone.replace(/\D/g, "");
  if (telDigits.length < 10) { setFieldError("telefone", "Informe um telefone válido com DDD."); valid = false; }
  else setFieldError("telefone", "");

  if (!data.cidade.trim()) { setFieldError("cidade", "Informe a cidade."); valid = false; }
  else setFieldError("cidade", "");

  if (!data.uf) { setFieldError("uf", "Selecione a UF."); valid = false; }
  else setFieldError("uf", "");

  if (!data.categoria) { setFieldError("categoria", "Selecione uma categoria."); valid = false; }
  else setFieldError("categoria", "");

  return valid;
}

/* ---------- Sessão do fornecedor ---------- */

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/* ---------- Navegação entre etapas (com fade) ---------- */

function fadeOut(el, done) {
  if (!el || el.hidden) { if (done) done(); return; }
  el.style.transition = "opacity .15s ease";
  el.style.opacity = "0";
  setTimeout(() => {
    el.hidden = true;
    el.style.opacity = "";
    el.style.transition = "";
    if (done) done();
  }, 150);
}

function fadeIn(el) {
  if (!el) return;
  el.hidden = false;
  el.style.transition = "none";
  el.style.opacity = "0";
  requestAnimationFrame(() => {
    el.style.transition = "opacity .22s ease";
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.transition = "";
      el.style.opacity = "";
    }, 250);
  });
}

function showCadastro(animate = true) {
  if (animate) {
    fadeOut(els.viewMensagens, () => {
      fadeIn(els.heroBanner);
      fadeIn(els.viewCadastro);
    });
  } else {
    els.heroBanner.hidden = false;
    els.viewCadastro.hidden = false;
    els.viewMensagens.hidden = true;
  }
  els.navStatus.hidden = true;
  els.navCta.hidden = false;
}

function showMensagens(session, animate = true) {
  if (animate) {
    fadeOut(els.heroBanner);
    fadeOut(els.viewCadastro, () => fadeIn(els.viewMensagens));
  } else {
    els.heroBanner.hidden = true;
    els.viewCadastro.hidden = true;
    els.viewMensagens.hidden = false;
  }
  els.navStatus.hidden = false;
  els.navCta.hidden = true;

  els.navSupplierName.textContent = session.empresa;
  els.resumoNome.textContent = `${session.nome} · ${session.empresa}`;
  els.resumoDetalhe.textContent = `${session.cidade}/${session.uf} · ${session.categoria} · ${session.email}`;

  renderChat(session);
  updateFollowupState(session);
}

function updateFollowupState(session) {
  const alreadySent = loadMessages(session).some((msg) => msg.from === "user");
  if (alreadySent) {
    els.chatInputRow.hidden = true;
    els.mensagemStatus.hidden = true;
    els.followupEmail.textContent = session.email;
    els.emailFollowup.hidden = false;
  } else {
    els.chatInputRow.hidden = false;
    els.mensagemStatus.hidden = false;
    els.emailFollowup.hidden = true;
  }
}

/* ---------- Chat / mensagens ---------- */

function chatKey(session) {
  return `${STORAGE_KEY}_msgs_${session.cnpj.replace(/\D/g, "")}`;
}

function loadMessages(session) {
  try {
    const raw = localStorage.getItem(chatKey(session));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(session, messages) {
  localStorage.setItem(chatKey(session), JSON.stringify(messages));
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderChat(session) {
  const messages = loadMessages(session);

  if (messages.length === 0) {
    messages.push({
      from: "bot",
      text: `Olá, ${session.nome}! Recebemos o cadastro da ${session.empresa}. Escreva abaixo sua mensagem — proposta, produtos ou condições comerciais — e nossa equipe responde por e-mail.`,
      ts: new Date().toISOString(),
    });
    saveMessages(session, messages);
  }

  els.chatLog.innerHTML = "";
  messages.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.from === "user" ? "user" : "bot"}`;
    bubble.innerHTML = `${escapeHtml(msg.text)}<span class="ts">${formatTimestamp(msg.ts)}</span>`;
    els.chatLog.appendChild(bubble);
  });
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function sendMessage() {
  const session = loadSession();
  if (!session) return;

  const text = els.mensagemTexto.value.trim();
  if (!text) return;

  els.btnEnviarMensagem.disabled = true;
  els.btnEnviarMensagem.classList.add("is-loading");

  const message = { from: "user", text, ts: new Date().toISOString() };
  const messages = loadMessages(session);
  messages.push(message);
  saveMessages(session, messages);
  renderChat(session);
  els.mensagemTexto.value = "";

  let result = { ok: false, offline: true, data: null };
  if (session.leadId) {
    result = await postJson(API_CONFIG.endpoints.mensagens(session.leadId), { text });
  }

  if (result.ok) {
    updateFollowupState(session);
  } else {
    els.mensagemStatus.textContent =
      "Não foi possível confirmar com o servidor agora. Tente novamente em instantes.";
    els.mensagemStatus.className = "status-banner warn";
    els.mensagemStatus.hidden = false;
  }

  els.btnEnviarMensagem.disabled = false;
  els.btnEnviarMensagem.classList.remove("is-loading");
}

els.btnEnviarMensagem.addEventListener("click", sendMessage);
els.mensagemTexto.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ---------- Cadastro: submit ---------- */

els.formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    nome: document.getElementById("nome").value,
    empresa: document.getElementById("empresa").value,
    cnpj: document.getElementById("cnpj").value,
    email: document.getElementById("email").value,
    telefone: document.getElementById("telefone").value,
    cidade: document.getElementById("cidade").value,
    uf: document.getElementById("uf").value,
    categoria: document.getElementById("categoria").value,
  };

  if (!validateCadastro(data)) {
    els.cadastroStatus.textContent = "Verifique os campos destacados.";
    els.cadastroStatus.className = "status-banner warn";
    return;
  }

  els.btnCadastrar.disabled = true;
  els.btnCadastrar.classList.add("is-loading");
  els.cadastroStatus.textContent = "Enviando cadastro...";
  els.cadastroStatus.className = "status-banner";

  const result = await postJson(API_CONFIG.endpoints.cadastro, data);

  if (result.ok && result.data && result.data.leadId) {
    data.leadId = result.data.leadId;
  }
  saveSession(data);

  if (result.ok) {
    els.cadastroStatus.textContent = "Cadastro confirmado.";
    els.cadastroStatus.className = "status-banner ok";
  } else {
    els.cadastroStatus.textContent =
      "Cadastro salvo localmente. Não foi possível confirmar com o servidor agora, mas você pode continuar.";
    els.cadastroStatus.className = "status-banner warn";
  }

  els.btnCadastrar.disabled = false;
  els.btnCadastrar.classList.remove("is-loading");
  showMensagens(data);
});

/* ---------- Editar / trocar cadastro ---------- */

function goEditCadastro() {
  const session = loadSession();
  if (session) {
    document.getElementById("nome").value = session.nome;
    document.getElementById("empresa").value = session.empresa;
    document.getElementById("cnpj").value = session.cnpj;
    document.getElementById("email").value = session.email;
    document.getElementById("telefone").value = session.telefone;
    document.getElementById("cidade").value = session.cidade;
    document.getElementById("uf").value = session.uf;
    document.getElementById("categoria").value = session.categoria;
  }
  showCadastro();
}

els.btnEditarCadastro.addEventListener("click", goEditCadastro);

/* ---------- Inicialização ---------- */

(function init() {
  applyPrefillFromQuery();
  const session = loadSession();
  if (session) {
    showMensagens(session, false);
  } else {
    showCadastro(false);
  }
})();
