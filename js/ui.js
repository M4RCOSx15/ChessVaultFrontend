// js/ui.js - Manipulação de DOM (versão mínima)

function showScreen(screen) {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  if (screen === 'auth') {
    authScreen.classList.remove('hidden');
    appScreen.classList.remove('visible');
  } else if (screen === 'app') {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    appScreen.classList.add('visible');
  }
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  const activeTab = document.querySelector(`[data-tab="${tab}"]`);
  const activeForm = document.getElementById(`${tab}-form`);

  if (activeTab) activeTab.classList.add('active');
  if (activeForm) activeForm.classList.add('active');
}

function showSection(section) {
  document.querySelectorAll('[data-section-content]').forEach(s => s.style.display = 'none');
  const active = document.getElementById(`${section}-section`);
  if (active) active.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeNav = document.querySelector(`[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = { jogadores: 'Jogadores', 'player-detail': 'Detalhes do Jogador', games: 'Minhas Partidas', viewer: 'Visualizador', books: 'Livros', puzzles: 'Puzzles', videos: 'Vídeos', profile: 'Meu Perfil' };
  document.getElementById('topbar-title').textContent = titles[section] || '';
}

function openSidebar() {
  document.querySelector('.sidebar').classList.add('sidebar-open');
  document.getElementById('sidebar-backdrop').classList.add('visible');
  document.getElementById('sidebar-toggle-btn').classList.add('is-hidden');
  document.getElementById('sidebar-toggle-btn').setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('sidebar-open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
  document.getElementById('sidebar-toggle-btn').classList.remove('is-hidden');
  document.getElementById('sidebar-toggle-btn').setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
  const isOpen = document.querySelector('.sidebar').classList.contains('sidebar-open');
  if (isOpen) closeSidebar(); else openSidebar();
}

function showToast(message, type = 'info', duration = CONFIG.TIMEOUTS.TOAST_DURATION) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.classList.remove('toast-success', 'toast-error', 'toast-info');
  if (type !== 'info') toast.classList.add(`toast-${type}`);

  toast.textContent = message;
  toast.classList.add('visible');

  setTimeout(() => toast.classList.remove('visible'), duration);
}
