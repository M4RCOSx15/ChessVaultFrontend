// js/games-viewer.js - Visualizador de partida (tabuleiro + navegação de lances)

let viewerMoves = [];
let viewerMoveIndex = 0;
let currentGameData = null;

function openGameViewer(game) {
  currentGameData = game;
  viewerMoves = parsePGN(game.PGN || '');
  viewerMoveIndex = 0;

  document.getElementById('viewer-title').textContent = game.nome;

  showSection('viewer');
  goToMove(0);
}

function closeGameViewer() {
  showSection('games');
}

function goToMove(idx) {
  const total = viewerMoves.length;
  if (idx === -1) idx = total;
  idx = Math.max(0, Math.min(idx, total));

  resetViewerEngine();
  for (let i = 0; i < idx; i++) {
    const san = viewerMoves[i];
    const mv = algebraicToMove(san, vBoard, vTurn);
    if (mv) {
      vApplyMove(mv[0], mv[1], mv[2], mv[3], mv[4]);
    } else {
      console.error(`goToMove: lance inválido "${san}" no índice ${i} (turn=${vTurn})`);
      break;
    }
  }
  viewerMoveIndex = idx;
  renderViewerBoard();
  renderMovesTable();
}

function nextMove() { if (viewerMoveIndex < viewerMoves.length) goToMove(viewerMoveIndex + 1); }
function prevMove() { if (viewerMoveIndex > 0) goToMove(viewerMoveIndex - 1); }

function renderViewerBoard() {
  const boardEl = document.getElementById('vboard');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const legalSet = new Set(vLegalMoves.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = document.createElement('div');
    const isLight = (r + c) % 2 === 0;
    sq.className = 'vsq ' + (isLight ? 'vl' : 'vd');
    const isLast = vLastMove.some(([lr, lc]) => lr === r && lc === c);
    if (isLast) sq.classList.add('vlast');
    if (vSelected && vSelected[0] === r && vSelected[1] === c) sq.classList.add('vsel');
    if (legalSet.has(`${r},${c}`)) {
      sq.classList.add('vlegal');
      if (vBoard[r][c]) sq.classList.add('vhas');
    }
    if (vBoard[r][c]) sq.textContent = VPIECES[vBoard[r][c]] || '';
    sq.onclick = () => handleViewerClick(r, c);
    boardEl.appendChild(sq);
  }

  const ranksEl = document.getElementById('vboard-ranks');
  ranksEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    const d = document.createElement('div');
    d.className = 'vlab';
    d.textContent = 8 - r;
    ranksEl.appendChild(d);
  }
  const filesEl = document.getElementById('vboard-files');
  filesEl.innerHTML = '';
  for (const l of ['a','b','c','d','e','f','g','h']) {
    const d = document.createElement('div');
    d.className = 'vlab';
    d.textContent = l;
    filesEl.appendChild(d);
  }

  document.getElementById('move-counter').textContent = `${viewerMoveIndex} / ${viewerMoves.length}`;
  document.getElementById('btn-prev').disabled  = viewerMoveIndex === 0;
  document.getElementById('btn-start').disabled = viewerMoveIndex === 0;
  document.getElementById('btn-next').disabled  = viewerMoveIndex === viewerMoves.length;
  document.getElementById('btn-end').disabled   = viewerMoveIndex === viewerMoves.length;
}

function handleViewerClick(r, c) {
  const p = vBoard[r][c];
  if (vSelected) {
    const mv = vLegalMoves.find(([mr, mc]) => mr === r && mc === c);
    if (mv) {
      vApplyMove(vSelected[0], vSelected[1], r, c, null);
      vSelected = null; vLegalMoves = [];
      renderViewerBoard();
      return;
    }
  }
  if (p && vColor(p) === vTurn) {
    vSelected = [r, c];
    vLegalMoves = vGetLegal(r, c, vBoard, vTurn, vCastling, vEnPassant);
  } else {
    vSelected = null; vLegalMoves = [];
  }
  renderViewerBoard();
}

function renderMovesTable() {
  const table = document.getElementById('moves-table');
  if (!table) return;
  let html = '';
  for (let i = 0; i < viewerMoves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const wMove = viewerMoves[i] || '';
    const bMove = viewerMoves[i + 1] || '';
    const wActive = viewerMoveIndex === i + 1 ? 'active' : '';
    const bActive = viewerMoveIndex === i + 2 ? 'active' : '';
    html += `<tr>
      <td class="move-num">${moveNum}.</td>
      <td class="move-cell ${wActive}" onclick="goToMove(${i + 1})">${wMove}</td>
      <td class="move-cell ${bActive}" onclick="goToMove(${i + 2})">${bMove}</td>
    </tr>`;
  }
  table.innerHTML = html;

  const active = table.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.addEventListener('keydown', e => {
  const viewerSection = document.getElementById('viewer-section');
  if (!viewerSection || viewerSection.style.display === 'none') return;
  if (e.key === 'ArrowRight') nextMove();
  if (e.key === 'ArrowLeft') prevMove();
  if (e.key === 'Home') goToMove(0);
  if (e.key === 'End') goToMove(-1);
});
