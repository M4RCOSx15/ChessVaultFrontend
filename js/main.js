// js/main.js - Inicialização (versão mínima: só auth)

document.addEventListener('DOMContentLoaded', () => {
  log('Inicializando Chess Vault...');

  // Tabs de login/registro
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });

  // Form de login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await handleLoginSubmit(email, password);
  });

  // Form de registro
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    await handleRegisterSubmit(name, email, password, confirmPassword);
  });

  // Navegação da sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section === 'logout') {
        handleLogout();
        return;
      }
      showSection(section);
      if (section === 'jogadores') loadJogadoresList();
      if (section === 'games') loadGamesList();
      if (section === 'books')   loadBooksList();
      if (section === 'videos')  loadVideosList();
      if (section === 'puzzles') loadPuzzlesSection();
    });
  });

  // Jogadores
  document.getElementById('add-player-btn').addEventListener('click', openNewPlayerModal);
  document.getElementById('buscar-chesscom-btn').addEventListener('click', () => {
    const username = document.getElementById('new-player-chesscom-username').value.trim();
    if (!username) {
      showToast('Digite um usuário do Chess.com primeiro.', 'error');
      return;
    }
    buscarDadosChessCom(username);
  });
  document.getElementById('new-player-close').addEventListener('click', closeNewPlayerModal);
  document.getElementById('new-player-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'new-player-overlay') closeNewPlayerModal();
  });
  document.getElementById('new-player-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleNewPlayerSubmit({
      nome:      document.getElementById('new-player-nome').value,
      rating:    document.getElementById('new-player-rating').value,
      descricao: document.getElementById('new-player-descricao').value,
      aberturas: document.getElementById('new-player-aberturas').value,
      imagemUrl: document.getElementById('new-player-imagem-url').value || null,
    });
  });
  document.getElementById('player-detail-back-btn').addEventListener('click', closePlayerDetail);

  // Perfil do usuário
  document.getElementById('user-pill').addEventListener('click', openProfileSection);
  document.getElementById('profile-back-btn').addEventListener('click', () => showSection('jogadores'));

  // Nova Partida
  document.getElementById('new-game-btn').addEventListener('click', openNewGameModal);
  document.getElementById('new-game-close').addEventListener('click', closeNewGameModal);
  document.getElementById('new-game-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'new-game-overlay') closeNewGameModal();
  });
  document.getElementById('new-game-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('new-game-nome').value;
    const pgn = document.getElementById('new-game-pgn').value;
    await salvarNovaPartida(nome, pgn);
  });
  document.querySelectorAll('#new-game-overlay .modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchNewGameTab(tab.dataset.newgameTab));
  });
  document.getElementById('new-game-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const j1  = document.getElementById('new-game-search-jogador1').value;
    const j2  = document.getElementById('new-game-search-jogador2').value;
    const ano = document.getElementById('new-game-search-ano').value;
    await handleGameSearchSubmit(j1, j2, ano);
  });

  // Visualizador de partida
  document.getElementById('viewer-back-btn').addEventListener('click', closeGameViewer);
  document.getElementById('btn-start').addEventListener('click', () => goToMove(0));
  document.getElementById('btn-prev').addEventListener('click', prevMove);
  document.getElementById('btn-next').addEventListener('click', nextMove);
  document.getElementById('btn-end').addEventListener('click', () => goToMove(-1));

  // Livros
  document.getElementById('add-book-btn').addEventListener('click', openBookSearchModal);
  document.getElementById('book-search-close').addEventListener('click', closeBookSearchModal);
  document.getElementById('book-search-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'book-search-overlay') closeBookSearchModal();
  });
  document.getElementById('book-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('book-search-input').value;
    await handleBookSearchSubmit(query);
  });

  // Vídeos
  document.getElementById('add-video-btn').addEventListener('click', openVideoSearchModal);
  document.getElementById('video-search-close').addEventListener('click', closeVideoSearchModal);
  document.getElementById('video-search-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'video-search-overlay') closeVideoSearchModal();
  });
  document.getElementById('video-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const termo = document.getElementById('video-search-input').value;
    await handleVideoSearchSubmit(termo);
  });
  document.getElementById('video-player-close').addEventListener('click', closeVideoPlayerModal);
  document.getElementById('video-player-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'video-player-overlay') closeVideoPlayerModal();
  });
  document.getElementById('book-detail-close').addEventListener('click', closeBookDetailModal);
  document.getElementById('book-detail-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'book-detail-overlay') closeBookDetailModal();
  });

  // Se já existe token salvo, pula direto pra home (sem validar contra o backend
  // ainda - isso é uma simplificação, não uma solução definitiva. Ver nota abaixo.)
  if (auth.isLoggedIn()) {
    showScreen('app');
    showSection('jogadores');
    loadJogadoresList();
  } else {
    showScreen('auth');
  }

  log('Chess Vault inicializado.');
});
