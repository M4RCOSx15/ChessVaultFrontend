// js/utils.js - Funções utilitárias (só o necessário para auth)

function log(message, data = null) {
  if (CONFIG.DEBUG) console.log(`[Chess Vault] ${message}`, data);
}

function error(message, err = null) {
  console.error(`[Chess Vault ERROR] ${message}`, err);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return password.length >= 8;
}
