// js/auth.js - Autenticação: login, registro, logout

class AuthManager {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  async register(name, email, senha) {
    return api.post(CONFIG.ENDPOINTS.AUTH.REGISTER, { nome: name, email, senha: senha });
  }

  async login(email, senha) {
    const data = await api.post(CONFIG.ENDPOINTS.AUTH.LOGIN, { email, senha: senha });
    api.setAccessToken(data.token);
    this.isAuthenticated = true;
    this.currentUser = { nome: data.nome, email: data.email };
    return data;
  }

  logout() {
    api.clearTokens();
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  isLoggedIn() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  }
}

const auth = new AuthManager();

// ========== HANDLERS DE FORMULÁRIO ==========

async function handleLoginSubmit(email, senha) {
  if (!isValidEmail(email)) {
    showToast('Email inválido', 'error');
    return;
  }

  try {
    const data = await auth.login(email, senha);
    showToast(CONFIG.MESSAGES.SUCCESS.LOGIN, 'success');

    const nome = data.nome || email;
    document.getElementById('user-name').textContent = nome;
    document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();

    showScreen('app');
    showSection('jogadores');
    loadJogadoresList();
  } catch (err) {
    error('Erro no login', err);
    showToast(err.message, 'error');
  }
}

async function handleRegisterSubmit(name, email, senha, confirmSenha) {
  if (!isValidEmail(email)) {
    showToast('Email inválido', 'error');
    return;
  }
  if (!isValidPassword(senha)) {
    showToast('Senha deve ter pelo menos 8 caracteres', 'error');
    return;
  }
  if (senha !== confirmSenha) {
    showToast('Senhas não coincidem', 'error');
    return;
  }

  try {
    await auth.register(name, email, senha);
    showToast(CONFIG.MESSAGES.SUCCESS.REGISTER, 'success');
    switchAuthTab('login');
  } catch (err) {
    error('Erro no registro', err);
    showToast(err.message, 'error');
  }
}

function handleLogout() {
  auth.logout();
  // Limpa qualquer dado em memória do usuário anterior (não só o
  // localStorage). Sem isso, se algum código ler essas variáveis antes
  // da próxima lista carregar, ainda veria o usuário errado.
  if (typeof livrosCarregados !== 'undefined') livrosCarregados = [];
  if (typeof ultimosResultadosBusca !== 'undefined') ultimosResultadosBusca = [];
  if (typeof jogadoresCarregados !== 'undefined') jogadoresCarregados = [];
  document.getElementById('games-list').innerHTML = '';
  document.getElementById('books-list').innerHTML = '';
  document.getElementById('jogadores-list').innerHTML = '';
  showScreen('auth');
}

// ========== PERFIL DO USUÁRIO ==========

/**
 * Mostra a seção "Meu Perfil" com os dados de quem está logado (nome
 * cadastrado no registro e email). Usa auth.currentUser quando disponível
 * (setado no login); se a página foi recarregada e esse dado em memória
 * não existe mais, cai pro nome que já está exibido no rodapé da sidebar.
 */
function openProfileSection() {
  const nomeAtual  = (auth.currentUser && auth.currentUser.nome)
    || document.getElementById('user-name').textContent
    || 'Usuário';
  const emailAtual = (auth.currentUser && auth.currentUser.email) || '—';

  document.getElementById('profile-nome').textContent   = nomeAtual;
  document.getElementById('profile-email').textContent  = emailAtual;
  document.getElementById('profile-avatar').textContent = nomeAtual.charAt(0).toUpperCase();

  showSection('profile');
}
