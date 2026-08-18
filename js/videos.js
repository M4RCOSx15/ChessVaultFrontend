// js/videos.js - Vídeos (busca no YouTube via backend + salvar/deletar)
//
// ATENÇÃO — inconsistência de nomes entre os dois DTOs do backend:
// a busca (VideoSearchResultDTO) usa "thumbnail" (com H), mas o DTO
// de salvar (VideoRequestDTO) usa "tumbnail" (sem H). Isso NÃO é erro
// nosso — é assim que o backend está hoje. Mandamos "tumbnail" (sem H)
// no payload de salvar porque é isso que o @RequestBody espera. Vale
// padronizar isso no backend num momento de organização futura.

let videosCarregados = [];
let ultimosResultadosVideos = [];

async function loadVideosList() {
  const container = document.getElementById('videos-list');
  const statEl = document.getElementById('stat-total-videos');

  container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Carregando vídeos...</p>`;
  if (statEl) statEl.textContent = '—';

  try {
    videosCarregados = await api.get('/videos/buscartodosvideos');

    if (statEl) statEl.textContent = videosCarregados.length;

    if (!videosCarregados || videosCarregados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <div class="empty-state-title">Nenhum vídeo ainda</div>
          <p>Clique em "+ Adicionar Vídeo" para buscar e salvar o primeiro.</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="videos-grid">${videosCarregados.map((v, i) => `
      <div class="video-tile" onclick="openVideoPlayerModal(${i})">
        <button class="video-tile-delete" title="Remover" onclick="event.stopPropagation(); handleDeleteVideo(${v.id})">🗑</button>
        <div class="video-tile-thumb">
          ${(v.thumbnail || v.tumbnail || v.Thumbnail) ? `<img src="${v.thumbnail || v.tumbnail || v.Thumbnail}" alt="${v.titulo}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"><span style="display:none;font-size:32px;">🎬</span>` : '<span style="font-size:32px;">🎬</span>'}
        </div>
        <div class="video-tile-info">
          <div class="video-tile-title">${v.titulo || 'Sem título'}</div>
          <div class="video-tile-canal">${v.canal || ''}</div>
        </div>
      </div>
    `).join('')}</div>`;

  } catch (err) {
    error('Erro ao carregar vídeos', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Não foi possível carregar</div>
        <p>${err.message}</p>
      </div>`;
  }
}

// ============================================================
// BUSCA NO YOUTUBE (via backend — a chave da API fica só no servidor)
// ============================================================

function openVideoSearchModal() {
  document.getElementById('video-search-form').reset();
  document.getElementById('video-search-results').innerHTML = '';
  document.getElementById('video-search-overlay').classList.add('visible');
}

function closeVideoSearchModal() {
  document.getElementById('video-search-overlay').classList.remove('visible');
}

async function handleVideoSearchSubmit(termo) {
  const container = document.getElementById('video-search-results');
  container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Buscando no YouTube...</p>`;

  try {
    ultimosResultadosVideos = await api.get(`/videos/buscar?termo=${encodeURIComponent(termo)}`);
    renderVideoSearchResults(ultimosResultadosVideos);
  } catch (err) {
    error('Erro ao buscar vídeos', err);
    showToast(err.message, 'error');
    container.innerHTML = '';
  }
}


function renderVideoSearchResults(videos) {
  const container = document.getElementById('video-search-results');

  if (!videos || videos.length === 0) {
    container.innerHTML = `<p style="color: var(--ink-muted); font-size: 13px;">Nenhum resultado encontrado.</p>`;
    return;
  }

  container.innerHTML = videos.map((v, i) => `
    <div class="video-result-card" onclick="handlePickVideo(${i})">
      ${v.thumbnail
        ? `<img class="video-result-thumb" src="${v.thumbnail}" alt="${v.titulo}">`
        : `<div class="video-result-thumb"></div>`}
      <div class="video-result-info">
        <div class="video-result-title">${v.titulo}</div>
        <div class="video-result-canal">${v.canal || ''}</div>
      </div>
    </div>
  `).join('');
}

async function handlePickVideo(index) {
  const v = ultimosResultadosVideos[index];
  if (!v) return;

  try {
    // Note o "tumbnail" sem H aqui — é o nome que o VideoRequestDTO
    // do backend realmente espera (ver aviso no topo do arquivo).
    // O VideoRequestDTO usa @JsonProperty("Thumbnail") com T maiúsculo
    // É isso que o Jackson lê no @RequestBody — qualquer outro nome vira null no banco
    await api.post('/videos/salvarvideo', {
      url:       v.url,
      titulo:    v.titulo,
      Thumbnail: v.thumbnail,   // ← T MAIÚSCULO: casa com @JsonProperty("Thumbnail")
      canal:     v.canal,
      idVideo:   v.videoId,
    });
    showToast('Vídeo salvo com sucesso!', 'success');
    closeVideoSearchModal();
    await loadVideosList();
  } catch (err) {
    error('Erro ao salvar vídeo', err);
    showToast('Erro ao salvar no servidor', 'error');
  }
}

async function handleDeleteVideo(id) {
  const confirmado = confirm('Remover este vídeo da sua coleção?');
  if (!confirmado) return;

  try {
    await api.delete(`/videos/deletarvideo/${id}`);
    showToast('Vídeo removido.', 'success');
    await loadVideosList();
  } catch (err) {
    error('Erro ao remover vídeo', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// PLAYER (modal com <iframe> — assiste dentro do Chess Vault,
// sem window.open/redirect para o YouTube)
// ============================================================

// O id do vídeo pode vir com nomes diferentes dependendo de onde o
// registro foi criado (mesma inconsistência de "thumbnail"/"tumbnail"
// documentada no topo do arquivo), então tentamos todas as variações
// antes de cair para extrair o id direto da URL salva.
function _extrairYoutubeId(v) {
  const direto = v.idVideo || v.IdVideo || v.videoId || v.VideoId;
  if (direto) return direto;

  const url = v.url || '';
  const padroes = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of padroes) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function openVideoPlayerModal(index) {
  const v = videosCarregados[index];
  if (!v) return;

  const id = _extrairYoutubeId(v);
  const iframe = document.getElementById('video-player-iframe');
  const titleEl = document.getElementById('video-player-title');

  if (!id) {
    showToast('Não foi possível identificar o vídeo do YouTube.', 'error');
    return;
  }

  titleEl.textContent = v.titulo || 'Vídeo';
  // autoplay=1 pra já começar a tocar ao abrir o modal
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  document.getElementById('video-player-overlay').classList.add('visible');
}

function closeVideoPlayerModal() {
  // Zera o src (não só esconde o modal) pra parar o vídeo/áudio ao fechar
  document.getElementById('video-player-iframe').src = '';
  document.getElementById('video-player-overlay').classList.remove('visible');
}
