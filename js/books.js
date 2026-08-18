// js/books.js - Busca de livros na Google Books API + salvar no Chess Vault

// ============================================================
// GOOGLE BOOKS API (busca externa)
// ============================================================
const GOOGLE_BOOKS_API_KEY = "AIzaSyAFkK_m0XcOVLMDEnEDu1YiMeuy5OT86Ww";

/**
 * Busca livros na API pública do Google Books e devolve só os campos
 * que o Chess Vault usa, já tratando os casos em que a API não retorna
 * descrição ou capa (isso acontece com frequência, principalmente em
 * livros mais antigos ou de editoras pequenas).
 *
 * @param {string} query
 * @returns {Promise<Array<{nome: string, descricao: string, imagem: string}>>}
 */
async function buscarLivroGoogle(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${GOOGLE_BOOKS_API_KEY}`;

  const response = await fetch(url);

  if (response.status === 429) {
    throw new Error('Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.');
  }
  if (!response.ok) {
    throw new Error('Erro ao buscar livros no Google Books');
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map(item => {
    const info = item.volumeInfo || {};
    const imagens = info.imageLinks || {};

    return {
      nome: info.title || 'Sem título',
      descricao: info.description || 'Sem descrição disponível.',
      // fallback: thumbnail -> smallThumbnail -> string vazia (nunca undefined,
      // pra não quebrar o <img src="undefined"> no DOM depois)
      imagem: imagens.thumbnail || imagens.smallThumbnail || '',
    };
  });
}

// ============================================================
// INTEGRAÇÃO COM O BACKEND (Chess Vault)
// ============================================================

/**
 * Salva um livro (já no formato do Chess Vault) no backend.
 * Espera exatamente os campos que o LivroModel usa: nome, descricao,
 * imagemLivro — os nomes precisam bater com o @RequestBody do
 * LivroController.
 */
async function salvarLivroVault(livro) {
  return api.put('/livro/criarlivro', {
    nome: livro.nome,
    descricao: livro.descricao,
    imagemLivro: livro.imagem,
  });
}

// Ícones de xadrez pra variar visualmente os cards (mesmo princípio
// do design de referência), e uma paleta de 6 cores cíclicas.
const ICONES_LIVRO = ['♟', '♜', '♛', '♞', '♝', '♚'];

/**
 * Escolhe cor/ícone de forma DETERMINÍSTICA a partir do nome do livro
 * — ou seja, o mesmo livro sempre cai na mesma cor/ícone, em vez de
 * mudar aleatoriamente a cada vez que a lista é recarregada.
 */
function paletaDoLivro(nome) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  const indice = soma % 6;
  return { classe: `palette-${indice}`, icone: ICONES_LIVRO[indice] };
}

// Guarda os livros carregados em memória, pra abrir os detalhes sem
// precisar buscar de novo no backend.
let livrosCarregados = [];

async function loadBooksList() {
  const container = document.getElementById('books-list');
  const statEl = document.getElementById('stat-total-books');

  // IMPORTANTE: limpar a tela ANTES do await, seguindo o mesmo padrão do loadGamesList
  container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Carregando livros...</p>`;
  if (statEl) statEl.textContent = '—';

  try {
    livrosCarregados = await api.get('/livro/buscartodoslivros');

    if (statEl) statEl.textContent = livrosCarregados.length;

    if (!livrosCarregados || livrosCarregados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">Nenhum livro ainda</div>
          <p>Clique em "+ Adicionar Livro" para buscar e salvar o primeiro.</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="books-grid">${livrosCarregados.map((l, i) => {
      const { classe, icone } = paletaDoLivro(l.nome || '');
      return `
        <div class="book-tile" onclick="openBookDetail(${i})">
          <div class="book-tile-cover ${l.imagemLivro ? '' : 'no-cover ' + classe}">
            ${l.imagemLivro ? `<img src="${l.imagemLivro}" alt="${l.nome}">` : icone}
          </div>
          <div class="book-tile-info">
            <div class="book-tile-title">${l.nome}</div>
            <div class="book-tile-desc">${(l.descricao || '').slice(0, 60)}</div>
          </div>
        </div>
      `;
    }).join('')}</div>`;

  } catch (err) {
    error('Erro ao carregar livros', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Não foi possível carregar</div>
        <p>${err.message}</p>
      </div>`;
  }
}

// ============================================================
// MODAL DE DETALHES DO LIVRO
// ============================================================

function openBookDetail(index) {
  const livro = livrosCarregados[index];
  if (!livro) return;

  const { classe, icone } = paletaDoLivro(livro.nome || '');

  document.getElementById('book-detail-title').textContent = livro.nome;
  document.getElementById('book-detail-content').innerHTML = `
    <div class="book-detail-layout">
      <div class="book-detail-cover-wrap ${livro.imagemLivro ? '' : classe}">
        ${livro.imagemLivro ? `<img src="${livro.imagemLivro}" alt="${livro.nome}">` : icone}
      </div>
      <div>
        <p class="book-detail-desc">${livro.descricao || 'Sem descrição disponível.'}</p>
      </div>
    </div>
    <div class="book-detail-actions">
      <button class="btn-danger" onclick="handleDeleteBook(${livro.id})">🗑 Remover da coleção</button>
    </div>
  `;

  document.getElementById('book-detail-overlay').classList.add('visible');
}

function closeBookDetailModal() {
  document.getElementById('book-detail-overlay').classList.remove('visible');
}

async function handleDeleteBook(id) {
  const confirmado = confirm('Remover este livro da sua coleção? Essa ação não pode ser desfeita.');
  if (!confirmado) return;

  try {
    await api.delete(`/livro/deletarlivro/${id}`);
    showToast('Livro removido.', 'success');
    closeBookDetailModal();
    await loadBooksList();
  } catch (err) {
    error('Erro ao remover livro', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// FLUXO DE UI (modal de busca)
// ============================================================

function openBookSearchModal() {
  document.getElementById('book-search-form').reset();
  document.getElementById('book-search-results').innerHTML = '';
  document.getElementById('book-search-overlay').classList.add('visible');
}

function closeBookSearchModal() {
  document.getElementById('book-search-overlay').classList.remove('visible');
}

function renderBookSearchResults(livros) {
  const container = document.getElementById('book-search-results');

  if (!livros || livros.length === 0) {
    container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Nenhum resultado encontrado.</p>`;
    return;
  }

  container.innerHTML = livros.map((livro, i) => `
    <div class="book-result-card" onclick="handlePickBook(${i})">
      ${livro.imagem
        ? `<img class="book-result-cover" src="${livro.imagem}" alt="${livro.nome}">`
        : `<div class="book-result-cover"></div>`}
      <div class="book-result-info">
        <div class="book-result-title">${livro.nome}</div>
        <div class="book-result-desc">${livro.descricao}</div>
      </div>
    </div>
  `).join('');
}

// Guarda os últimos resultados em memória pra não precisar re-buscar
// na API externa só porque o usuário clicou num item já mostrado.
let ultimosResultadosBusca = [];

async function handleBookSearchSubmit(query) {
  const container = document.getElementById('book-search-results');
  container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Buscando...</p>`;

  try {
    ultimosResultadosBusca = await buscarLivroGoogle(query);
    renderBookSearchResults(ultimosResultadosBusca);
  } catch (err) {
    error('Erro ao buscar livros', err);
    showToast(err.message, 'error');
    container.innerHTML = '';
  }
}

async function handlePickBook(index) {
  const livro = ultimosResultadosBusca[index];
  if (!livro) return;

  try {
    await salvarLivroVault(livro);
    showToast('Livro salvo com sucesso!', 'success');
    closeBookSearchModal();
    await loadBooksList();
  } catch (err) {
    error('Erro ao salvar livro', err);
    showToast('Erro ao salvar no servidor', 'error');
  }
}
