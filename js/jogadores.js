// js/jogadores.js — Chess Vault
// Correções desta versão:
//   1. Delete sem partida vinculada (endpoint direto)
//   2. Detalhe do jogador com layout hero + foto real do Chess.com
//   3. "Adicionar Partida" no card abre modal de nova partida (igual ao + Nova Partida da seção games)
//   4. Botão separado "Vincular partida existente" para ligar a uma já salva
//   5. Foto do Chess.com salva no campo imagemJogador via campo oculto no form

const ICONES_JOGADOR = ['♔', '♕', '♖', '♗', '♘', '♙'];

function iconeDoJogador(nome) {
  let soma = 0;
  for (let i = 0; i < (nome || '').length; i++) soma += nome.charCodeAt(i);
  return ICONES_JOGADOR[soma % ICONES_JOGADOR.length];
}

// Jogadores carregados em memória (evita re-fetch pra abrir detalhe)
let jogadoresCarregados = [];

// ID do jogador atualmente na tela de detalhe (usado pelo modal de nova partida)
let jogadorDetalheAtual = null;

// ============================================================
// LISTA
// ============================================================

async function loadJogadoresList() {
  const container = document.getElementById('jogadores-list');
  container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Carregando jogadores...</p>`;

  try {
    jogadoresCarregados = await api.get('/jogador/buscartodosjogadores');

    if (!jogadoresCarregados || jogadoresCarregados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">♟️</div>
          <div class="empty-state-title">Nenhum jogador ainda</div>
          <p>Clique em "+ Adicionar Jogador" para cadastrar o primeiro.</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="players-grid">
      ${jogadoresCarregados.map((j, i) => renderPlayerCard(j, i)).join('')}
    </div>`;

  } catch (err) {
    error('Erro ao carregar jogadores', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Não foi possível carregar</div>
        <p>${err.message}</p>
      </div>`;
  }
}

function renderPlayerCard(j, i) {
  // Avatar: foto real do Chess.com se existir, senão ícone
  const avatarHTML = j.imagemJogador
    ? `<img src="${j.imagemJogador}" alt="${j.nome}"
           style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <span style="display:none;font-size:28px;">${iconeDoJogador(j.nome)}</span>`
    : `<span style="font-size:28px;">${iconeDoJogador(j.nome)}</span>`;

  return `
  <div class="player-card">
    <div class="player-card-icon">${avatarHTML}</div>
    <div class="player-card-nome">${j.nome}</div>
    <div class="player-card-rating">${j.rating ?? '—'}</div>
    <div class="player-card-rating-label">FIDE Rating</div>
    <div class="player-card-desc">${j.descricao || 'Sem descrição.'}</div>
    <div class="player-card-actions">
      <button class="btn btn-secondary" onclick="openPlayerDetail(${i})">Ver Detalhes</button>
      <button class="btn btn-primary" onclick="event.stopPropagation(); abrirNovaPartidaParaJogador(${j.id})">+ Partida</button>
    </div>
  </div>`;
}

// ============================================================
// CHESS.COM — preenchimento automático
// ============================================================

async function buscarDadosChessCom(username) {
  const btn = document.getElementById('buscar-chesscom-btn');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  try {
    const [perfilRes, statsRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`),
    ]);

    if (perfilRes.status === 404) throw new Error(`Usuário "${username}" não encontrado no Chess.com.`);
    if (perfilRes.status === 429 || statsRes.status === 429)
      throw new Error('Muitas requisições ao Chess.com. Aguarde alguns segundos.');
    if (!perfilRes.ok || !statsRes.ok) throw new Error('Erro ao buscar dados no Chess.com.');

    const perfil = await perfilRes.json();
    const stats  = await statsRes.json();

    // Rating — maior valor real disponível
    const candidatos = [
      stats.chess_rapid?.last?.rating,
      stats.chess_blitz?.last?.rating,
      stats.chess_bullet?.last?.rating,
      stats.chess_daily?.last?.rating,
    ].filter(r => typeof r === 'number');
    const ratingEncontrado = candidatos.length > 0 ? Math.max(...candidatos) : null;

    // Nome: username capitalizado (o campo "name" é texto livre e pode conter frases)
    const nomeBase = perfil.username
      ? perfil.username.charAt(0).toUpperCase() + perfil.username.slice(1)
      : username;
    document.getElementById('new-player-nome').value = nomeBase;

    if (ratingEncontrado) document.getElementById('new-player-rating').value = ratingEncontrado;

    // Descrição
    const partes = [];
    const tagline = [perfil.name, perfil.location].filter(Boolean).join(' ').trim();
    if (tagline) partes.push(tagline);
    if (perfil.title) partes.push(perfil.title);
    if (perfil.country) partes.push(`País: ${perfil.country.split('/').pop()}`);
    if (typeof perfil.followers === 'number') partes.push(`${perfil.followers} seguidores no Chess.com`);
    if (perfil.joined) partes.push(`no Chess.com desde ${new Date(perfil.joined * 1000).getFullYear()}`);
    if (partes.length > 0) document.getElementById('new-player-descricao').value = partes.join(' · ');

    // ── FOTO: salva a URL real no campo oculto E mostra preview ──
    const previewImg = document.getElementById('new-player-avatar-preview');
    const urlInput   = document.getElementById('new-player-imagem-url');

    if (perfil.avatar) {
      if (urlInput)   urlInput.value = perfil.avatar;
      if (previewImg) {
        previewImg.src = perfil.avatar;
        previewImg.style.display = 'block';
      }
    }

    showToast('Dados encontrados no Chess.com!', 'success');

  } catch (err) {
    error('Erro ao buscar no Chess.com', err);
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// ============================================================
// CRIAR JOGADOR
// ============================================================

function openNewPlayerModal() {
  document.getElementById('new-player-form').reset();
  const previewImg = document.getElementById('new-player-avatar-preview');
  if (previewImg) previewImg.style.display = 'none';
  document.getElementById('new-player-overlay').classList.add('visible');
}

function closeNewPlayerModal() {
  document.getElementById('new-player-overlay').classList.remove('visible');
}

async function handleNewPlayerSubmit(dados) {
  try {
    await api.post('/jogador/criarjogador', {
      nome:          dados.nome,
      rating:        Number(dados.rating),
      descricao:     dados.descricao,
      aberturasFav:  dados.aberturas,
      imagemJogador: dados.imagemUrl || null,   // ← URL real da foto do Chess.com
    });
    showToast('Jogador salvo com sucesso!', 'success');
    closeNewPlayerModal();
    await loadJogadoresList();
  } catch (err) {
    error('Erro ao salvar jogador', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// NOVA PARTIDA VINCULADA AO JOGADOR
// Abre o modal padrão de nova partida e, ao salvar, vincula ao jogador.
// ============================================================

function abrirNovaPartidaParaJogador(jogadorId) {
  // Guarda qual jogador vai receber o vínculo depois de salvar
  jogadorDetalheAtual = jogadorId;
  // Abre o modal normal de nova partida (mesmo que o botão da sidebar)
  openNewGameModal();
}

/**
 * Override de handleNewGameSubmit para, quando chamado via jogador,
 * vincular automaticamente depois de salvar.
 * A função original fica em games.js; aqui só adicionamos o passo extra.
 */
const _handleNewGameSubmit_original = typeof handleNewGameSubmit === 'function'
  ? handleNewGameSubmit
  : null;

async function handleNewGameSubmitComVinculo(nome, pgn) {
  if (!nome.trim()) { showToast('Dê um nome para a partida.', 'error'); return; }
  if (!pgn.trim())  { showToast('Cole o PGN da partida.', 'error'); return; }

  // Auto-corrige PGN colado adicionando um espaço após o ponto da jogada
  // Ex: transforma "1.e4 e5 2.Nf3" em "1. e4 e5 2. Nf3"
  let pgnFormatado = pgn.replace(/(\d+\.)([^\s])/g, '$1 $2');

  try {
    // Note que agora enviamos a variável pgnFormatado
    const novaPartida = await api.post(CONFIG.ENDPOINTS.PARTIDAS.CRIAR, { nome, PGN: pgnFormatado });

    // Se veio de um card de jogador, vincula automaticamente
    if (jogadorDetalheAtual && novaPartida && novaPartida.id) {
      await api.put(`/partidas/vincularjogador/${novaPartida.id}/${jogadorDetalheAtual}`);
      showToast('Partida criada e vinculada ao jogador!', 'success');
    } else {
      showToast('Partida salva com sucesso!', 'success');
    }

    closeNewGameModal();
    jogadorDetalheAtual = null;

    // Recarrega a lista certa
    const secaoAtiva = document.querySelector('[data-section-content]:not([style*="display:none"])');
    if (secaoAtiva && secaoAtiva.id === 'player-detail-section') {
      // Ainda na tela de detalhe — recarrega partidas vinculadas
      const jId = jogadoresCarregados.find(j => j.id === parseInt(secaoAtiva.dataset.jogadorId))?.id;
      if (jId) await carregarPartidasDoJogador(jId);
    } else {
      await loadGamesList();
    }

  } catch (err) {
    error('Erro ao criar partida', err);
    showToast(err.message, 'error');
    jogadorDetalheAtual = null;
  }
}

// ============================================================
// DETALHE DO JOGADOR
// ============================================================

async function openPlayerDetail(index) {
  const j = jogadoresCarregados[index];
  if (!j) return;

  // Guarda ID no dataset da seção para referência
  const secao = document.getElementById('player-detail-section');
  if (secao) secao.dataset.jogadorId = j.id;

  const tags = (j.aberturasFav || '')
    .split(',').map(t => t.trim()).filter(Boolean)
    .map(t => `<span class="player-tag">${t}</span>`).join('');

  // Avatar hero — foto real com fallback para ícone
  // Fix: img com classe dedicada; fallback com id único para o onerror encontrar
  const _fotoId = `av-${j.id}`;
  const avatarHTML = j.imagemJogador
    ? `<img src="${j.imagemJogador}" alt="${j.nome}" class="player-detail-hero-img"
           onerror="this.style.display='none';document.getElementById('${_fotoId}').style.display='flex';">`
    : '';
  const avatarFallback = `<span id="${_fotoId}" class="player-detail-hero-fallback"
    style="${j.imagemJogador ? 'display:none' : 'display:flex'}">${iconeDoJogador(j.nome)}</span>`;

  document.getElementById('player-detail-content').innerHTML = `

    <!-- ── HERO ── -->
    <div class="player-detail-hero">
      <div class="player-detail-hero-avatar">
        ${avatarHTML}${avatarFallback}
      </div>
      <div class="player-detail-hero-info">
        <div class="player-detail-nome">${j.nome}</div>
        <div class="player-detail-rating">FIDE Rating: <strong>${j.rating ?? '—'}</strong></div>
        <p class="player-detail-desc">${j.descricao || 'Sem descrição.'}</p>
        ${tags ? `<div class="player-tags">${tags}</div>` : ''}
      </div>
      <div class="player-detail-hero-actions">
        <button class="btn btn-danger" onclick="handleDeletePlayer(${j.id})">🗑 Remover</button>
      </div>
    </div>

    <!-- ── PARTIDAS ── -->
    <div class="section-header" style="margin-top:1.5rem;">
      <h3 class="section-title" style="font-size:17px;">Partidas Vinculadas</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="abrirNovaPartidaParaJogador(${j.id})">+ Nova Partida</button>
        <button class="btn btn-secondary" onclick="toggleSeletorVincular(${j.id})">🔗 Vincular Existente</button>
      </div>
    </div>

    <!-- Seletor de vincular existente (começa escondido) -->
    <div id="player-link-selector" style="display:none; margin-bottom:1rem;"></div>

    <!-- Lista de partidas vinculadas -->
    <div id="player-linked-games">
      <p style="color:var(--ink-muted);font-size:13px;">Carregando...</p>
    </div>
  `;

  showSection('player-detail');
  await carregarPartidasDoJogador(j.id);
}

// ── Toggle do seletor de vincular existente ───────────────────
function toggleSeletorVincular(jogadorId) {
  const container = document.getElementById('player-link-selector');
  if (container.style.display === 'none' || !container.style.display) {
    abrirSeletorVincularPartida(jogadorId);
  } else {
    container.style.display = 'none';
  }
}

// ── Carregar partidas vinculadas ──────────────────────────────
async function carregarPartidasDoJogador(jogadorId) {
  const container = document.getElementById('player-linked-games');
  try {
    const partidas = await api.get(`/partidas/buscarpartidasdojogador/${jogadorId}`);
    renderPlayerLinkedGames(partidas, jogadorId);
  } catch (err) {
    error('Erro ao carregar partidas do jogador', err);
    container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Não foi possível carregar as partidas vinculadas.</p>`;
  }
}

function renderPlayerLinkedGames(partidas, jogadorId) {
  const container = document.getElementById('player-linked-games');
  if (!partidas || partidas.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:2rem 1rem;">
        <div class="empty-state-icon" style="font-size:32px;">♟️</div>
        <div class="empty-state-title">Nenhuma partida vinculada</div>
        <p style="font-size:13px;color:var(--ink-muted);">
          Use "+ Nova Partida" para criar uma específica deste jogador,
          ou "🔗 Vincular Existente" para conectar uma partida já salva.
        </p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="games-grid">${partidas.map(p => {
    const jsonSeguro = JSON.stringify(p).replace(/'/g, "&#39;");
    return `
    <div class="game-card">
      <button class="game-card-delete" title="Desvincular"
              onclick="event.stopPropagation(); handleDesvincularPartida(${p.id}, ${jogadorId})">✕</button>
      <div class="game-card-body" style="padding-top:14px;"
           onclick='openGameViewer(${jsonSeguro})'>
        <div class="game-card-title-real">${p.nome}</div>
        <div class="game-card-footer">Clique para abrir</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── Seletor de vincular partida existente ─────────────────────
async function abrirSeletorVincularPartida(jogadorId) {
  const container = document.getElementById('player-link-selector');
  container.style.display = 'block';
  container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Carregando suas partidas...</p>`;

  try {
    const partidas = await api.get(CONFIG.ENDPOINTS.PARTIDAS.LISTAR);

    if (!partidas || partidas.length === 0) {
      container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Você ainda não tem partidas salvas.</p>`;
      return;
    }

    container.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
        <div class="auth-field" style="margin-bottom:8px;">
          <label class="auth-label">Escolha uma partida para vincular</label>
          <select id="player-link-select" class="auth-input">
            ${partidas.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;" onclick="handleVincularPartida(${jogadorId})">Vincular</button>
          <button class="btn btn-secondary" onclick="document.getElementById('player-link-selector').style.display='none'">Cancelar</button>
        </div>
      </div>`;
  } catch (err) {
    error('Erro ao carregar partidas para vincular', err);
    container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Erro ao carregar suas partidas.</p>`;
  }
}

async function handleVincularPartida(jogadorId) {
  const select = document.getElementById('player-link-select');
  const partidaId = select ? select.value : null;
  if (!partidaId) return;

  try {
    await api.put(`/partidas/vincularjogador/${partidaId}/${jogadorId}`);
    showToast('Partida vinculada com sucesso!', 'success');
    document.getElementById('player-link-selector').style.display = 'none';
    await carregarPartidasDoJogador(jogadorId);
  } catch (err) {
    error('Erro ao vincular partida', err);
    showToast(err.message, 'error');
  }
}

async function handleDesvincularPartida(partidaId, jogadorId) {
  try {
    await api.put(`/partidas/desvincularjogador/${partidaId}/${jogadorId}`);
    showToast('Partida desvinculada.', 'success');
    await carregarPartidasDoJogador(jogadorId);
  } catch (err) {
    error('Erro ao desvincular partida', err);
    showToast(err.message, 'error');
  }
}

// ── Atalho do card (abre detalhe + seletor já aberto) ─────────
async function abrirDetalheEVincular(index) {
  await openPlayerDetail(index);
  const j = jogadoresCarregados[index];
  if (j) abrirSeletorVincularPartida(j.id);
}

function closePlayerDetail() {
  jogadorDetalheAtual = null;
  showSection('jogadores');
}

// ============================================================
// DELETAR JOGADOR — sem precisar de partida vinculada
// ============================================================

async function handleDeletePlayer(id) {
  const confirmado = confirm('Remover este jogador? Essa ação não pode ser desfeita.');
  if (!confirmado) return;

  try {
    // Endpoint direto sem precisar de partidaId
    await api.delete(`/jogador/deletarjogador/${id}`);
    showToast('Jogador removido.', 'success');
    closePlayerDetail();
    await loadJogadoresList();
  } catch (err) {
    error('Erro ao remover jogador', err);
    showToast(err.message, 'error');
  }
}
