// js/api.js - Cliente HTTP mínimo (sem refresh token: overengineering para o MVP)

class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
    this.timeout = CONFIG.TIMEOUTS.API_REQUEST;
  }

  getAccessToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  }

  setAccessToken(token) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  clearTokens() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async request(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await Promise.race([
        fetch(url, {
          method,
          headers: this.getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), this.timeout)),
      ]);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = data.message || CONFIG.MESSAGES.ERROR.SERVER_ERROR;

        if (response.status === 401) {
          this.clearTokens();
          showToast(CONFIG.MESSAGES.ERROR.TOKEN_EXPIRED, 'error');
          showScreen('auth');
        }

        throw new ApiError(msg, response.status, data);
      }

      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.message === 'Timeout' || err instanceof TypeError) {
        throw new ApiError(CONFIG.MESSAGES.ERROR.NETWORK, 0);
      }
      throw new ApiError(err.message, 0);
    }
  }

  get(endpoint) { return this.request('GET', endpoint); }
  post(endpoint, data) { return this.request('POST', endpoint, data); }
  put(endpoint, data) { return this.request('PUT', endpoint, data); }
  delete(endpoint) { return this.request('DELETE', endpoint); }
}

const api = new ApiClient();
