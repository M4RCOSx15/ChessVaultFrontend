// js/pgn-parser-adapter.js
// Adaptador em JS puro para a lib @mliebelt/pgn-parser.
//
// Por que isso existe: o arquivo original pgn-parser.ts usa sintaxe de
// import/export do TypeScript e depende do pacote @mliebelt/pgn-types
// (só tipos, não existe em runtime puro). Como o Chess Vault não tem
// build step (webpack/vite/tsc) — só <script> soltos — não dá pra usar
// o .ts direto no navegador. Este arquivo reimplementa em JS puro a
// MESMA lógica de pós-processamento que pgn-parser.ts fazia (a função
// postParseGame/handleGameResult), usando o parser compilado que já
// expusemos em window.PgnParserEngine.

/**
 * Faz o parse de UM PGN (com ou sem tags [Event ...]) e devolve a
 * lista de lances em notação SAN, na ordem em que ocorrem na linha
 * principal (variações entre parênteses são ignoradas de propósito —
 * o visualizador do Chess Vault não navega por variações ainda).
 *
 * @param {string} pgnText
 * @returns {string[]} ex: ["e4", "e5", "Nf3", "Nc6", ...]
 */
function parsePGNWithLibrary(pgnText) {
  if (!window.PgnParserEngine) {
    console.error('PgnParserEngine não carregado — confira a ordem dos <script> no index.html');
    return [];
  }

  try {
    const input = pgnText.trim();
    const tree = window.PgnParserEngine.parse(input, { startRule: 'game' });

    let moves = tree.moves || [];

    // Equivalente a handleGameResult() do pgn-parser.ts original:
    // o último "lance" pode na verdade ser o resultado da partida
    // (ex: "1-0", "1/2-1/2"), que a gramática devolve como uma STRING
    // solta em vez de um objeto de lance. Isso precisa ser removido
    // da lista antes de extrairmos a notação.
    if (moves.length > 0 && typeof moves[moves.length - 1] === 'string') {
      moves = moves.slice(0, -1);
    }

    // Cada lance real é um objeto { moveNumber, notation: { notation: "e4", ... }, ... }
    // (ver pgn-rules.pegjs, regra "pgn" e "halfMove"). Extraímos só o
    // texto SAN de cada um.
    return moves
      .filter(m => m && m.notation && typeof m.notation.notation === 'string')
      .map(m => m.notation.notation);

  } catch (err) {
    console.error('Erro ao fazer parse do PGN (biblioteca mliebelt/pgn-parser):', err);
    if (err.errorHint) console.error(err.errorHint);
    return [];
  }
}

/**
 * Igual a parsePGNWithLibrary, mas também devolve as TAGS do PGN
 * (ex: { Event, Site, FEN, SetUp, White, Black, Result, ... }).
 *
 * Usado pelos puzzles: o PGN que o Chess.com devolve pra um puzzle
 * traz a posição inicial na tag [FEN "..."] (com [SetUp "1"]) e o
 * texto do lance já é a PRÓPRIA solução. Ler a posição a partir daí
 * é mais confiável do que depender de um campo `fen` solto que o
 * backend pode não estar repassando direito.
 *
 * @param {string} pgnText
 * @returns {{ tags: Object, moves: string[] }}
 */
function parsePGNFull(pgnText) {
  const vazio = { tags: {}, moves: [] };
  if (!window.PgnParserEngine || !pgnText) return vazio;

  try {
    const input = pgnText.trim();
    const tree = window.PgnParserEngine.parse(input, { startRule: 'game' });

    let moves = tree.moves || [];
    if (moves.length > 0 && typeof moves[moves.length - 1] === 'string') {
      moves = moves.slice(0, -1);
    }

    const sanList = moves
      .filter(m => m && m.notation && typeof m.notation.notation === 'string')
      .map(m => m.notation.notation);

    return { tags: tree.tags || {}, moves: sanList };

  } catch (err) {
    console.error('Erro ao fazer parse completo do PGN:', err);
    if (err.errorHint) console.error(err.errorHint);
    return vazio;
  }
}
