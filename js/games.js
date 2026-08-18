// js/games.js - Lista de partidas (substitui o CARLSEN_GAMES mock por dados reais)

// ============================================================
// CARD DE PARTIDA — visual inspirado no design de referência, mas
// usando SÓ dado real (nome que você digitou + o próprio PGN).
// Nada de ECO/abertura/data inventados, porque isso não existe no
// PartidasModel — mentir na tela é pior que não mostrar.
// ============================================================

const PECAS_DECORATIVAS = ['♜','♞','♝','♛','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟'];

/**
 * Se o nome seguir o padrão "Jogador1 vs Jogador2" (o que você já
 * digita hoje no formulário), extraímos os dois nomes pra mostrar
 * como na referência. Se não seguir esse padrão, não forçamos nada.
 */
function extrairJogadores(nome) {
  const partes = (nome || '').split(/\s+(?:vs\.?|x)\s+/i);
  if (partes.length === 2 && partes[0].trim() && partes[1].trim()) {
    return { brancas: partes[0].trim(), pretas: partes[1].trim() };
  }
  return null;
}

/**
 * O resultado (1-0, 0-1, 1/2-1/2) já vem DENTRO do texto do PGN que
 * você cola no formulário — não precisamos adivinhar nada, só ler o
 * fim do texto.
 */
function extrairResultado(pgnTexto) {
  const m = (pgnTexto || '').trim().match(/(1-0|0-1|1\/2-1\/2)\s*$/);
  if (!m) return null;
  const mapa = { '1-0': 'Brancas vencem', '0-1': 'Pretas vencem', '1/2-1/2': 'Empate' };
  return mapa[m[1]];
}

function renderGameCardHTML(p) {
  const jogadores = extrairJogadores(p.nome);
  const resultado = extrairResultado(p.PGN);
  const lances = (typeof parsePGN === 'function') ? parsePGN(p.PGN || '').length : 0;
  const padrao = PECAS_DECORATIVAS.join(' ');

  const jsonSeguro = JSON.stringify(p).replace(/'/g, "&#39;");
  const nomeSeguro = (p.nome || '').replace(/'/g, "\\'");

  const bannerJogadores = jogadores ? `
    <div class="game-card-players">
      <div class="game-card-player">
        <span class="game-card-player-dot filled"></span>${jogadores.brancas}
      </div>
      <div class="game-card-vs">vs</div>
      <div class="game-card-player">
        <span class="game-card-player-dot empty"></span>${jogadores.pretas}
      </div>
    </div>
  ` : `
    <div class="game-card-players">
      <div class="game-card-player">♟ ${p.nome}</div>
    </div>
  `;

  return `
    <div class="game-card" onclick='openGameViewer(${jsonSeguro})'>
      <button class="game-card-delete" title="Deletar" onclick="event.stopPropagation(); handleDeleteGame(${p.id}, '${nomeSeguro}')">🗑</button>
      <div class="game-card-banner">
        <div class="game-card-pattern">${padrao}</div>
        ${bannerJogadores}
        ${resultado ? `<div class="game-card-badge">${resultado}</div>` : ''}
      </div>
      <div class="game-card-body">
        <div class="game-card-title-real">${p.nome}</div>
        <div class="game-card-footer">${lances} lance${lances === 1 ? '' : 's'}</div>
      </div>
    </div>
  `;
}

async function loadGamesList() {
  const container = document.getElementById('games-list');
  const statEl = document.getElementById('stat-total-games');
  container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Carregando partidas...</p>`;
  if (statEl) statEl.textContent = '—';

  try {
    const partidas = await api.get(CONFIG.ENDPOINTS.PARTIDAS.LISTAR);

    if (statEl) statEl.textContent = partidas.length;

    if (!partidas || partidas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">♟️</div>
          <div class="empty-state-title">Nenhuma partida ainda</div>
          <p>Clique em "+ Nova Partida" para adicionar a primeira.</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="games-grid">${partidas.map(p => renderGameCardHTML(p)).join('')}</div>`;

  } catch (err) {
    error('Erro ao carregar partidas', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Não foi possível carregar</div>
        <p>${err.message}</p>
      </div>`;
  }
}

// ========== DELETAR PARTIDA ==========

async function handleDeleteGame(id, nome) {
  const confirmado = confirm(`Deletar a partida "${nome}"? Essa ação não pode ser desfeita.`);
  if (!confirmado) return;

  try {
    await api.delete(`${CONFIG.ENDPOINTS.PARTIDAS.DELETAR}/${id}`);
    showToast('Partida deletada.', 'success');
    await loadGamesList();
  } catch (err) {
    error('Erro ao deletar partida', err);
    showToast(err.message, 'error');
  }
}

// ========== CRIAR PARTIDA ==========

function openNewGameModal() {
  document.getElementById('new-game-form').reset();
  const searchForm = document.getElementById('new-game-search-form');
  if (searchForm) searchForm.reset();
  const resultsEl = document.getElementById('new-game-search-results');
  if (resultsEl) resultsEl.innerHTML = '';
  switchNewGameTab('manual');
  document.getElementById('new-game-overlay').classList.add('visible');
}

/** Alterna entre a aba "Manual" e "Buscar por Jogadores" do modal de nova partida. */
function switchNewGameTab(tab) {
  document.querySelectorAll('#new-game-overlay .modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#new-game-overlay .modal-tab-panel').forEach(p => p.classList.remove('active'));

  const activeTab   = document.querySelector(`#new-game-overlay [data-newgame-tab="${tab}"]`);
  const activePanel = document.getElementById(tab === 'manual' ? 'new-game-form' : 'new-game-search-panel');

  if (activeTab)   activeTab.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
}

function closeNewGameModal() {
  document.getElementById('new-game-overlay').classList.remove('visible');
}

/**
 * Detecta o sintoma mais comum de PGN colado sem espaço: uma casa do
 * tabuleiro (dígito 1-8) seguida IMEDIATAMENTE por uma letra que só
 * poderia ser o começo do PRÓXIMO lance (peça, coluna ou roque) — sem
 * espaço, xeque (+/#) ou promoção (=) entre os dois.
 *
 * Isso não cobre 100% dos casos possíveis de PGN (ex: desambiguação
 * por linha, tipo "R1a3", pode gerar falso positivo aqui) — mas cobre
 * o padrão real que você encontrou, e prefere AVISAR demais a aceitar
 * dado ruim silenciosamente.
 */

async function handleNewGameSubmit(nome, pgn) {
  if (!nome.trim()) {
    showToast('Dê um nome para a partida.', 'error');
    return;
  }
  if (!pgn.trim()) {
    showToast('Cole o PGN da partida.', 'error');
    return;
  }
  // Sem checagem de formato aqui — só campos vazios (isso é UX, não
  // validação de xadrez). O PGN em si é validado pelo backend, que
  // devolve 400 + mensagem explicando o que está errado (lance ilegal,
  // notação quebrada, etc.) se o PgnInvalidoException for lançado.

  try {
    await api.post(CONFIG.ENDPOINTS.PARTIDAS.CRIAR, { nome: nome, PGN: pgn });
    showToast('Partida salva com sucesso!', 'success');
    closeNewGameModal();
    await loadGamesList();
  } catch (err) {
    error('Erro ao criar partida', err);
    showToast(err.message, 'error');
  }
}

/**
 * Ponto único de salvamento usado pelas duas abas do modal (Manual e
 * Buscar por Jogadores). Se o modal foi aberto a partir do card de um
 * jogador específico (jogadorDetalheAtual, setado em jogadores.js), delega
 * pra handleNewGameSubmitComVinculo pra já salvar vinculado; senão usa o
 * fluxo normal.
 */
async function salvarNovaPartida(nome, pgn) {
  if (typeof jogadorDetalheAtual !== 'undefined' && jogadorDetalheAtual &&
      typeof handleNewGameSubmitComVinculo === 'function') {
    await handleNewGameSubmitComVinculo(nome, pgn);
  } else {
    await handleNewGameSubmit(nome, pgn);
  }
}

// ========== BUSCAR PARTIDAS POR JOGADORES (Chess.com) ==========
//
// Mesmo princípio do fluxo de livros (books.js): busca numa API externa,
// mostra os resultados como cards, o usuário clica num pra salvar — sem
// precisar preencher nome/PGN manualmente.
//
// A API pública do Chess.com não tem "buscar partida entre X e Y"; o que
// existe é o histórico mensal de UM jogador. Então: pegamos os arquivos
// do jogador1 no ano informado, abrimos cada mês e filtramos as partidas
// em que o jogador2 aparece como adversário.

let ultimosResultadosBuscaPartida = [];

async function buscarPartidasChessCom(jogador1, jogador2, ano) {
  const j1 = (jogador1 || '').trim();
  const j2 = (jogador2 || '').trim();

  if (!j1) throw new Error('Informe o usuário do Chess.com do primeiro jogador.');
  if (!j2) throw new Error('Informe o usuário do Chess.com do segundo jogador.');
  if (!/^\d{4}$/.test((ano || '').trim())) throw new Error('Informe um ano válido (ex: 2023).');

  const anoStr = ano.trim();

  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(j1)}/games/archives`);
  if (archivesRes.status === 404) throw new Error(`Usuário "${j1}" não encontrado no Chess.com.`);
  if (!archivesRes.ok) throw new Error('Erro ao buscar o histórico de partidas no Chess.com.');

  const archivesData = await archivesRes.json();
  const arquivosDoAno = (archivesData.archives || []).filter(url => url.includes(`/games/${anoStr}/`));

  if (arquivosDoAno.length === 0) return [];

  const meses = await Promise.all(
    arquivosDoAno.map(url =>
      fetch(url).then(r => r.ok ? r.json() : { games: [] }).catch(() => ({ games: [] }))
    )
  );

  const alvo1 = j1.toLowerCase();
  const alvo2 = j2.toLowerCase();
  const encontrados = [];

  for (const mes of meses) {
    for (const jogo of (mes.games || [])) {
      if (!jogo.pgn) continue;
      const brancoU = (jogo.white?.username || '').toLowerCase();
      const pretoU  = (jogo.black?.username || '').toLowerCase();
      const temJ1 = brancoU === alvo1 || pretoU === alvo1;
      const temJ2 = brancoU === alvo2 || pretoU === alvo2;
      if (!temJ1 || !temJ2) continue;

      encontrados.push({
        nome: `${jogo.white?.username || '?'} vs ${jogo.black?.username || '?'}`,
        pgn: jogo.pgn,
        endTime: jogo.end_time || 0,
        data: jogo.end_time ? new Date(jogo.end_time * 1000).toLocaleDateString('pt-BR') : '',
        timeClass: jogo.time_class || '',
      });
    }
  }

  encontrados.sort((a, b) => b.endTime - a.endTime);
  return encontrados.slice(0, 50);
}

function renderGameSearchResults(partidas) {
  const container = document.getElementById('new-game-search-results');
  if (!container) return;

  if (!partidas || partidas.length === 0) {
    container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Nenhuma partida encontrada entre esses jogadores nesse ano.</p>`;
    return;
  }

  container.innerHTML = partidas.map((p, i) => `
    <div class="game-search-result-card" onclick="handlePickGameSearchResult(${i})">
      <div class="game-search-result-info">
        <div class="game-search-result-title">${p.nome}</div>
        <div class="game-search-result-desc">${p.data}${p.timeClass ? ' · ' + p.timeClass : ''}</div>
      </div>
    </div>`).join('');
}

async function handleGameSearchSubmit(jogador1, jogador2, ano) {
  const container = document.getElementById('new-game-search-results');
  if (container) container.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">Buscando no Chess.com (pode levar alguns segundos)...</p>`;

  try {
    ultimosResultadosBuscaPartida = await buscarPartidasChessCom(jogador1, jogador2, ano);
    renderGameSearchResults(ultimosResultadosBuscaPartida);
  } catch (err) {
    error('Erro ao buscar partidas no Chess.com', err);
    showToast(err.message, 'error');
    if (container) container.innerHTML = '';
  }
}

async function handlePickGameSearchResult(index) {
  const partida = ultimosResultadosBuscaPartida[index];
  if (!partida) return;
  await salvarNovaPartida(partida.nome, partida.pgn);
}