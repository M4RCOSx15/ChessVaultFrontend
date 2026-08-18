// js/chess-engine.js - Motor de xadrez puro (validação de lances)
// Extraído do protótipo ChessVault_carlsen.html. Lógica não alterada,
// só isolada num arquivo próprio para reaproveitar na estrutura modular.

// ============================================================
// PARSER DE PGN
// ============================================================
// A regex homemade anterior quebrava com PGN sem espaço entre lances
// (bug real que você encontrou). Trocamos pela biblioteca
// @mliebelt/pgn-parser (baseada em gramática PEG, não regex) — ela
// reconhece a estrutura formal do PGN em vez de tentar "adivinhar"
// onde um lance termina por padrão de texto. parsePGN() aqui é só um
// wrapper fino, pra todo o resto do motor (goToMove, algebraicToMove
// etc.) continuar chamando a mesma função de sempre sem precisar saber
// que a implementação por trás mudou.
function parsePGN(pgn) {
  return parsePGNWithLibrary(pgn);
}

// ============================================================
// MOTOR DE XADREZ
// ============================================================
const VPIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

function vInitBoard() {
  return [
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR']
  ];
}

function vColor(p) { return p ? p[0] : null; }
function vPT(p)    { return p ? p[1] : null; }
function vIB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

let vBoard, vTurn, vCastling, vEnPassant;
let vSelected = null, vLegalMoves = [], vLastMove = [];

function resetViewerEngine() {
  vBoard     = vInitBoard();
  vTurn      = 'w';
  vCastling  = { w: { k: true, q: true }, b: { k: true, q: true } };
  vEnPassant = null;
  vSelected  = null;
  vLegalMoves = [];
  vLastMove   = [];
}

// Carrega uma posição a partir de um FEN no mesmo estado global (vBoard,
// vTurn, vCastling, vEnPassant) que o resto do motor já usa. Assim, qualquer
// tela que precise mostrar/jogar uma posição por FEN (ex.: puzzles) reaproveita
// o mesmo render + engine do visualizador de partidas, em vez de reimplementar
// tabuleiro e regras do zero.
function vLoadFEN(fen) {
  const partes = (fen || '').trim().split(/\s+/);
  const [posicao, turno = 'w', roques = '-', epCampo = '-'] = partes;

  const linhas = posicao.split('/');
  const board = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    const linha = linhas[r] || '';
    for (const ch of linha) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) row.push(null);
      } else {
        const cor = ch === ch.toUpperCase() ? 'w' : 'b';
        row.push(cor + ch.toUpperCase());
      }
    }
    board.push(row);
  }

  vBoard = board;
  vTurn  = turno === 'b' ? 'b' : 'w';
  vCastling = {
    w: { k: roques.includes('K'), q: roques.includes('Q') },
    b: { k: roques.includes('k'), q: roques.includes('q') },
  };

  if (epCampo && epCampo !== '-') {
    const FILES = 'abcdefgh';
    const RANKS = '87654321';
    vEnPassant = [RANKS.indexOf(epCampo[1]), FILES.indexOf(epCampo[0])];
  } else {
    vEnPassant = null;
  }

  vSelected   = null;
  vLegalMoves = [];
  vLastMove   = [];
}

function algebraicToMove(san, board, turn) {
  san = san.replace(/[+#!?]/g, '').trim();
  const t = turn;

  if (san === 'O-O-O' || san === '0-0-0') {
    const r = t === 'w' ? 7 : 0;
    if (board[r][4] === t + 'K' && board[r][0] === t + 'R') return [r, 4, r, 2, null];
    return null;
  }
  if (san === 'O-O' || san === '0-0') {
    const r = t === 'w' ? 7 : 0;
    if (board[r][4] === t + 'K' && board[r][7] === t + 'R') return [r, 4, r, 6, null];
    return null;
  }

  let promo = null;
  const promoMatch = san.match(/=([QRBN])$/i);
  if (promoMatch) {
    promo = t + promoMatch[1].toUpperCase();
    san   = san.replace(/=[QRBN]$/i, '');
  }

  const FILES = 'abcdefgh';
  const RANKS = '87654321';

  let piece = 'P';
  if (/^[KQRBN]/.test(san)) {
    piece = san[0];
    san   = san.slice(1);
  }

  san = san.replace('x', '');

  if (san.length < 2) return null;
  const toFile = san[san.length - 2];
  const toRank = san[san.length - 1];

  if (FILES.indexOf(toFile) === -1 || RANKS.indexOf(toRank) === -1) return null;

  const toC = FILES.indexOf(toFile);
  const toR = RANKS.indexOf(toRank);

  const hint = san.slice(0, san.length - 2);
  let fromFileHint = -1;
  let fromRankHint = -1;

  if (hint.length === 1) {
    if (/[a-h]/.test(hint)) fromFileHint = FILES.indexOf(hint);
    else if (/[1-8]/.test(hint)) fromRankHint = RANKS.indexOf(hint);
  } else if (hint.length === 2) {
    if (/[a-h]/.test(hint[0]) && /[1-8]/.test(hint[1])) {
      fromFileHint = FILES.indexOf(hint[0]);
      fromRankHint = RANKS.indexOf(hint[1]);
    } else if (/[1-8]/.test(hint[0]) && /[a-h]/.test(hint[1])) {
      fromRankHint = RANKS.indexOf(hint[0]);
      fromFileHint = FILES.indexOf(hint[1]);
    }
  }

  const candidates = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || vColor(p) !== t || vPT(p) !== piece) continue;
      if (fromFileHint >= 0 && c !== fromFileHint) continue;
      if (fromRankHint >= 0 && r !== fromRankHint) continue;
      const legalTargets = vGetLegal(r, c, board, t, vCastling, vEnPassant);
      if (legalTargets.some(([mr, mc]) => mr === toR && mc === toC)) {
        candidates.push([r, c]);
      }
    }
  }

  if (candidates.length === 0) {
    console.warn(`algebraicToMove: nenhum candidato para "${san}" (turn=${t})`);
    return null;
  }

  const [fr, fc] = candidates[0];
  return [fr, fc, toR, toC, promo];
}

function vGetLegal(r, c, board, turn, castling, enPassant) {
  const p = board[r][c];
  if (!p) return [];
  const t = vColor(p);
  if (t !== turn) return [];
  const type = vPT(p);
  const pseudo = [];

  if (type === 'P') {
    const dir = t === 'w' ? -1 : 1;
    const startRow = t === 'w' ? 6 : 1;
    const r1 = r + dir;
    if (vIB(r1, c) && !board[r1][c]) {
      pseudo.push([r1, c]);
      const r2 = r + 2 * dir;
      if (r === startRow && !board[r2][c]) pseudo.push([r2, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!vIB(nr, nc)) continue;
      if (board[nr][nc] && vColor(board[nr][nc]) !== t) pseudo.push([nr, nc]);
      if (enPassant && enPassant[0] === nr && enPassant[1] === nc) pseudo.push([nr, nc]);
    }
  } else if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (vIB(nr, nc) && vColor(board[nr][nc]) !== t) pseudo.push([nr, nc]);
    }
  } else if (type === 'B') {
    _slide(r, c, [[-1,-1],[-1,1],[1,-1],[1,1]], board, t, pseudo);
  } else if (type === 'R') {
    _slide(r, c, [[-1,0],[1,0],[0,-1],[0,1]], board, t, pseudo);
  } else if (type === 'Q') {
    _slide(r, c, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]], board, t, pseudo);
  } else if (type === 'K') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (vIB(nr, nc) && vColor(board[nr][nc]) !== t) pseudo.push([nr, nc]);
    }
    const row = t === 'w' ? 7 : 0;
    if (r === row && c === 4 && !vIsAttacked(r, c, t === 'w' ? 'b' : 'w', board)) {
      if (castling[t].k &&
          !board[row][5] && !board[row][6] &&
          board[row][7] === t + 'R' &&
          !vIsAttacked(row, 5, t === 'w' ? 'b' : 'w', board) &&
          !vIsAttacked(row, 6, t === 'w' ? 'b' : 'w', board)) {
        pseudo.push([row, 6]);
      }
      if (castling[t].q &&
          !board[row][3] && !board[row][2] && !board[row][1] &&
          board[row][0] === t + 'R' &&
          !vIsAttacked(row, 3, t === 'w' ? 'b' : 'w', board) &&
          !vIsAttacked(row, 2, t === 'w' ? 'b' : 'w', board)) {
        pseudo.push([row, 2]);
      }
    }
  }

  return pseudo.filter(([nr, nc]) => !vWouldCheck(r, c, nr, nc, t, board, enPassant));
}

function _slide(r, c, dirs, board, t, out) {
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (vIB(nr, nc)) {
      if (vColor(board[nr][nc]) === t) break;
      out.push([nr, nc]);
      if (board[nr][nc]) break;
      nr += dr; nc += dc;
    }
  }
}

function vWouldCheck(fr, fc, tr, tc, t, board, enPassant) {
  const tmp = board.map(row => [...row]);

  if (vPT(tmp[fr][fc]) === 'P' && enPassant &&
      tr === enPassant[0] && tc === enPassant[1] && !tmp[tr][tc]) {
    const capRow = t === 'w' ? tr + 1 : tr - 1;
    tmp[capRow][tc] = null;
  }

  tmp[tr][tc] = tmp[fr][fc];
  tmp[fr][fc] = null;

  let kr = -1, kc = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (tmp[r][c] === t + 'K') { kr = r; kc = c; break; }
    }
    if (kr !== -1) break;
  }
  if (kr === -1) return true;

  return vIsAttacked(kr, kc, t === 'w' ? 'b' : 'w', tmp);
}

function vIsAttacked(kr, kc, by, b2) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b2[r][c];
      if (!p || vColor(p) !== by) continue;
      const type = vPT(p);

      if (type === 'P') {
        const dir = by === 'w' ? -1 : 1;
        if (r + dir === kr && Math.abs(c - kc) === 1) return true;
        continue;
      }
      if (type === 'N') {
        const dr = Math.abs(r - kr), dc = Math.abs(c - kc);
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) return true;
        continue;
      }
      if (type === 'K') {
        if (Math.abs(r - kr) <= 1 && Math.abs(c - kc) <= 1) return true;
        continue;
      }
      const isDiag = (kr - r) !== 0 && Math.abs(kr - r) === Math.abs(kc - c);
      const isStraight = (r === kr) || (c === kc);

      if ((type === 'B' || type === 'Q') && isDiag) {
        const dr = Math.sign(kr - r), dc = Math.sign(kc - c);
        let nr = r + dr, nc = c + dc;
        while (vIB(nr, nc) && !(nr === kr && nc === kc)) {
          if (b2[nr][nc]) { nr = -1; break; }
          nr += dr; nc += dc;
        }
        if (nr === kr) return true;
      }
      if ((type === 'R' || type === 'Q') && isStraight) {
        const dr = Math.sign(kr - r), dc = Math.sign(kc - c);
        let nr = r + dr, nc = c + dc;
        while (vIB(nr, nc) && !(nr === kr && nc === kc)) {
          if (b2[nr][nc]) { nr = -1; break; }
          nr += dr; nc += dc;
        }
        if (nr === kr) return true;
      }
    }
  }
  return false;
}

function vApplyMove(fr, fc, tr, tc, promo) {
  const p = vBoard[fr][fc];
  if (!p) return;
  const t = vColor(p);
  const type = vPT(p);

  if (type === 'P' && vEnPassant &&
      tr === vEnPassant[0] && tc === vEnPassant[1] && !vBoard[tr][tc]) {
    const capRow = t === 'w' ? tr + 1 : tr - 1;
    vBoard[capRow][tc] = null;
  }

  vBoard[tr][tc] = p;
  vBoard[fr][fc] = null;

  if (type === 'P' && Math.abs(tr - fr) === 2) {
    vEnPassant = [(fr + tr) / 2, tc];
  } else {
    vEnPassant = null;
  }

  if (type === 'K') {
    vCastling[t].k = false;
    vCastling[t].q = false;
    const row = t === 'w' ? 7 : 0;
    if (tc === 6 && fc === 4) { vBoard[row][5] = vBoard[row][7]; vBoard[row][7] = null; }
    if (tc === 2 && fc === 4) { vBoard[row][3] = vBoard[row][0]; vBoard[row][0] = null; }
  }

  if (type === 'R') {
    if (fc === 0) vCastling[t].q = false;
    if (fc === 7) vCastling[t].k = false;
  }
  const opp = t === 'w' ? 'b' : 'w';
  const oppRow = opp === 'w' ? 7 : 0;
  if (tr === oppRow && tc === 0) vCastling[opp].q = false;
  if (tr === oppRow && tc === 7) vCastling[opp].k = false;

  if (type === 'P' && (tr === 0 || tr === 7)) {
    vBoard[tr][tc] = promo || (t + 'Q');
  }

  vLastMove = [[fr, fc], [tr, tc]];
  vTurn = t === 'w' ? 'b' : 'w';
}
