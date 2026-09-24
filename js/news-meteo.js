// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/news-meteo.js (VERSIONE 70.0 - EXPANDED MODAL, THUMBNAILS & ZERO-DUMMY)
// DESCRIZIONE: Componente News & Meteo Viareggio integrato con Modulo_NewsMeteo.gs:
//              - Modale espansa verticale a 86dvh ad alta leggibilità
//              - Anteprima fotografica dell'articolo accanto al titolo
//              - Zero dati dummy di fallback: solo dati reali sincronizzati
//              - Capsula Meteo (Viareggio Min/Max) + Ticker continuo a 60fps
// ============================================================================

const NewsMeteoEngine = (function() {
  'use strict';

  const CACHE_KEY = "estiqatsy_news_meteo_cache";
  const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

  let currentData = null;
  let activeModalTab = "meteo";
  let activeNewsFilter = "tutte";

  // Converte entità come &#8217; e &#8211; in caratteri puliti
  function decodeEntities(str) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 1. SINCRONIZZAZIONE DATI BACKEND GAS
  // --------------------------------------------------------------------------
  async function fetchRemoteData(forceRefresh = false) {
    try {
      if (typeof apiCall === "function") {
        const rawRes = await apiCall("news_meteo", { refresh: forceRefresh });
        const res = (rawRes && rawRes.meteo) ? rawRes : (rawRes && rawRes.data ? rawRes.data : null);

        if (res && res.meteo && res.news) {
          res.news.forEach(n => {
            n.titolo = decodeEntities(n.titolo);
            n.descrizione = decodeEntities(n.descrizione);
          });
          currentData = res;
          saveLocalCache(res);
          renderMiniWidget();
          renderModalContent();
        }
      }
    } catch (err) {
      console.warn("[NewsMeteo] Connessione in corso...", err);
    }
  }

  // --------------------------------------------------------------------------
  // 2. INIEZIONE MODALE ESPANSA VERTICALMENTE (86dvh)
  // --------------------------------------------------------------------------
  function injectExpandedModal() {
    let modal = document.getElementById("modal-news-meteo");
    if (!modal) {
      modal = document.createElement("dialog");
      modal.id = "modal-news-meteo";
      modal.className = "modal modal-middle";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box news-meteo-expanded-box p-4 bg-[#070A12] border border-sky-400/40 rounded-2xl space-y-3 relative shadow-2xl flex flex-col justify-between">
        <button onclick="document.getElementById('modal-news-meteo').close()" class="modal-close-btn absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white z-50 text-xs font-black">✕</button>

        <!-- Intestazione Fissa -->
        <div class="flex items-center justify-between pr-8 border-b border-white/10 pb-2 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">🌊</span>
            <div>
              <h3 class="font-black text-xs text-white uppercase tracking-wider">Dispacci della Costa</h3>
              <span class="text-[9.5px] font-mono text-sky-400">Viareggio & Versilia Live</span>
            </div>
          </div>
          <button onclick="NewsMeteoEngine.refreshData()" class="btn btn-ghost btn-xs text-sky-400 font-mono text-[9px] h-6 min-h-0 px-2">Aggiorna 🔄</button>
        </div>

        <!-- Selettore Schede Fisso -->
        <div class="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/5 shrink-0">
          <button onclick="NewsMeteoEngine.switchTab('meteo')" id="tab-btn-meteo" class="flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeModalTab === 'meteo' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}">
            ⛅ Meteo Porto (6 Giorni)
          </button>
          <button onclick="NewsMeteoEngine.switchTab('news')" id="tab-btn-news" class="flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeModalTab === 'news' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}">
            📰 Rassegna Stampa
          </button>
        </div>

        <!-- AREA SCORREVOLE TAB 1: METEO VIAREGGIO -->
        <div id="tab-content-meteo" class="${activeModalTab === 'meteo' ? '' : 'hidden'} news-meteo-scroll-body space-y-3">
          <!-- Scheda Oggi in Grande -->
          <div class="p-3.5 rounded-2xl bg-gradient-to-br from-sky-950/50 via-slate-900 to-slate-950 border border-sky-400/30 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-4xl" id="meteo-today-icon">☁️</span>
              <div>
                <h4 class="text-sm font-black text-white" id="meteo-today-city">Viareggio (Oggi)</h4>
                <div class="text-xs text-slate-300 font-medium capitalize" id="meteo-today-desc">Rilevamento in corso...</div>
                <div class="text-[9.5px] font-mono text-slate-400 mt-1" id="meteo-today-details">Pressione -- • Umidità --</div>
              </div>
            </div>
            <div class="text-right font-mono">
              <div class="text-sm font-black text-amber-300" id="meteo-today-max">--</div>
              <div class="text-xs font-bold text-sky-400" id="meteo-today-min">--</div>
            </div>
          </div>

          <!-- Previsioni 6 Giorni -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold uppercase px-1">
              <span>Previsioni Prossimi 6 Giorni</span>
              <span class="text-slate-500 font-normal">Fonte: QuiNewsVersilia</span>
            </div>
            <div class="space-y-1.5" id="meteo-forecast-list">
              <!-- Popolato dinamicamente -->
            </div>
          </div>
        </div>

        <!-- AREA SCORREVOLE TAB 2: RASSEGNA STAMPA CON ANTEPRIMA FOTO -->
        <div id="tab-content-news" class="${activeModalTab === 'news' ? '' : 'hidden'} news-meteo-scroll-body space-y-2.5">
          <!-- Filtro Testata -->
          <div class="flex gap-1.5 overflow-x-auto pb-1 shrink-0" id="news-source-filter">
            <button onclick="NewsMeteoEngine.filterNews('tutte')" class="rpg-category-chip active" id="chip-news-tutte">Tutte</button>
            <button onclick="NewsMeteoEngine.filterNews('VersiliaToday')" class="rpg-category-chip" id="chip-news-vt">VersiliaToday</button>
            <button onclick="NewsMeteoEngine.filterNews('NoiTV')" class="rpg-category-chip" id="chip-news-noitv">NoiTV</button>
          </div>

          <!-- Lista Articoli con Thumbnail Fotografica -->
          <div class="space-y-2" id="news-articles-list">
            <!-- Popolato dinamicamente -->
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 3. RENDERING MODALE ESPANSA
  // --------------------------------------------------------------------------
  function renderModalContent() {
    if (!currentData) {
      const fList = document.getElementById("meteo-forecast-list");
      const nList = document.getElementById("news-articles-list");
      const loadingHtml = `<div class="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">Sincronizzazione bollettino e notizie in corso...</div>`;
      if (fList) fList.innerHTML = loadingHtml;
      if (nList) nList.innerHTML = loadingHtml;
      return;
    }

    const m = currentData.meteo;
    const oggi = m?.oggi;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Dati Oggi
    if (oggi) {
      s("meteo-today-icon", oggi.icona || "⛅");
      s("meteo-today-city", `${m.citta || 'Viareggio'} (Oggi)`);
      s("meteo-today-desc", oggi.condizione || "In corso");
      s("meteo-today-details", `Pressione ${oggi.pressione || '--'} • Umidità ${oggi.umidita || '--'}`);
      s("meteo-today-max", `Max: ${oggi.tempMax || '--'}`);
      s("meteo-today-min", `Min: ${oggi.tempMin || '--'}`);
    }

    // Previsioni 6 Giorni
    const fList = document.getElementById("meteo-forecast-list");
    if (fList) {
      const prev = m?.previsioni || [];
      if (prev.length === 0) {
        fList.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Previsioni a medio termine in aggiornamento...</div>`;
      } else {
        fList.innerHTML = prev.map(p => `
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-xl shrink-0">${p.icona || '⛅'}</span>
              <div class="min-w-0">
                <div class="font-bold text-white text-xs">${p.giorno || p.data.split(' ')[0]}</div>
                <div class="text-[10px] text-slate-400 truncate">${p.condizione}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 font-mono text-[11px] shrink-0">
              <span class="text-sky-300 font-bold">${p.tempMin}</span>
              <span class="text-slate-600">/</span>
              <span class="text-amber-300 font-bold">${p.tempMax}</span>
            </div>
          </div>
        `).join("");
      }
    }

    renderNewsArticlesList();
  }

  function renderNewsArticlesList() {
    const nList = document.getElementById("news-articles-list");
    if (!nList) return;

    if (!currentData || !currentData.news) {
      nList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">Ricezione notizie in corso...</div>`;
      return;
    }

    let articles = currentData.news || [];
    if (activeNewsFilter !== "tutte") {
      articles = articles.filter(a => String(a.fonte || "").toLowerCase() === activeNewsFilter.toLowerCase());
    }

    if (articles.length === 0) {
      nList.innerHTML = `<div class="p-4 text-center text-xs text-slate-500 font-mono">Nessuna notizia disponibile per questo filtro.</div>`;
      return;
    }

    nList.innerHTML = articles.map(art => {
      // 🔒 ANTEPRIMA FOTOGRAFICA CON FALLBACK ICONICO
      const photoUrl = art.foto || art.img || art.mediaUrl || art.immagine || "";
      const thumbHtml = photoUrl
        ? `<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
             <img src="${photoUrl}" class="w-full h-full object-cover" alt="Foto Notizia" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-lg bg-slate-950\\'>${art.sigla === 'VT' ? '📰' : '📺'}</div>'">
           </div>`
        : `<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950 border border-white/10 flex flex-col items-center justify-center shrink-0 text-slate-400 font-mono text-[10px] font-bold">
             <span class="text-xl mb-0.5">${art.sigla === 'VT' ? '📰' : '📺'}</span>
             <span>${art.sigla}</span>
           </div>`;

      return `
        <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex gap-3 items-start hover:border-sky-400/30 transition">
          ${thumbHtml}
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center justify-between text-[9px] font-mono">
              <span class="px-1.5 py-0.5 rounded font-black text-slate-950" style="background-color: ${art.colore || '#38BDF8'};">${art.sigla || 'NEWS'}</span>
              <span class="text-slate-400">${art.ora || ''}</span>
            </div>
            <h4 class="text-xs font-bold text-white leading-snug line-clamp-2">${art.titolo}</h4>
            ${art.descrizione ? `<p class="text-[10px] text-slate-400 leading-relaxed line-clamp-2">${art.descrizione}</p>` : ''}
            ${art.link ? `
              <div class="pt-0.5 text-right">
                <a href="${art.link}" target="_blank" class="text-[10px] text-sky-400 font-mono hover:underline inline-flex items-center gap-1 font-bold">
                  Leggi su ${art.fonte} ›
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  }

  // --------------------------------------------------------------------------
  // 4. MONTAGGIO MINI-WIDGET IN HOME
  // --------------------------------------------------------------------------
  function mountMiniWidget() {
    injectExpandedModal();

    let mountEl = document.getElementById("news-meteo-mount");
    if (!mountEl) return;

    if (mountEl.querySelector(".news-meteo-mini-bar")) {
      renderMiniWidget();
      return;
    }

    mountEl.className = "w-full";
    mountEl.innerHTML = `
      <div class="news-meteo-mini-bar">
        <!-- Capsula Meteo Fissa a Sinistra -->
        <div class="meteo-capsule-anchor" onclick="NewsMeteoEngine.openModal('meteo')" title="Meteo Viareggio">
          <span class="meteo-capsule-icon" id="mini-meteo-icon">🌊</span>
          <div class="meteo-capsule-temps">
            <span class="meteo-temp-max" id="mini-meteo-max">--</span>
            <span class="meteo-temp-divider">/</span>
            <span class="meteo-temp-min" id="mini-meteo-min">--</span>
          </div>
          <span class="meteo-capsule-city">VIAREGGIO</span>
        </div>

        <!-- Ticker Scorrevole a Destra -->
        <div class="news-ticker-window" onclick="NewsMeteoEngine.openModal('news')" title="Leggi Rassegna Stampa">
          <div class="news-ticker-track" id="mini-news-track">
            <span class="ticker-item">
              <span class="ticker-badge" style="background-color: #38BDF8;">LIVE</span>
              <span class="ticker-text">Sincronizzazione bollettino e notizie in corso...</span>
              <span class="ticker-sep">⚓</span>
            </span>
          </div>
        </div>
      </div>
    `;

    renderMiniWidget();
  }

  function renderMiniWidget() {
    if (!currentData) return;

    const m = currentData.meteo;
    const oggi = m?.oggi;

    const iconEl = document.getElementById("mini-meteo-icon");
    const maxEl = document.getElementById("mini-meteo-max");
    const minEl = document.getElementById("mini-meteo-min");

    if (oggi) {
      if (iconEl) iconEl.textContent = oggi.icona || "⛅";
      if (maxEl) maxEl.textContent = oggi.tempMax ? oggi.tempMax.replace('°C', '°').trim() : "--";
      if (minEl) minEl.textContent = oggi.tempMin ? oggi.tempMin.replace('°C', '°').trim() : "--";
    }

    const trackEl = document.getElementById("mini-news-track");
    if (trackEl && currentData.news && currentData.news.length > 0) {
      const htmlBlock = currentData.news.map(art => `
        <span class="ticker-item">
          <span class="ticker-badge" style="background-color: ${art.colore || '#38BDF8'};">${art.sigla || 'NEWS'}</span>
          <span class="ticker-text">${art.titolo}</span>
          <span class="ticker-sep">⚓</span>
        </span>
      `).join("");

      trackEl.innerHTML = htmlBlock + htmlBlock;
    }
  }

  // --------------------------------------------------------------------------
  // 5. INIZIALIZZAZIONE
  // --------------------------------------------------------------------------
  function init() {
    currentData = loadLocalCache();

    mountMiniWidget();
    setTimeout(mountMiniWidget, 50);
    setTimeout(mountMiniWidget, 350);

    setTimeout(() => {
      fetchRemoteData(false);
    }, 150);

    setInterval(() => {
      if (!document.hidden) fetchRemoteData(false);
    }, REFRESH_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    openModal: function(tabName = "meteo") {
      injectExpandedModal();
      this.switchTab(tabName);
      renderModalContent();
      document.getElementById("modal-news-meteo")?.showModal();
    },

    switchTab: function(tab) {
      activeModalTab = tab;
      const btnMeteo = document.getElementById("tab-btn-meteo");
      const btnNews = document.getElementById("tab-btn-news");
      const contentMeteo = document.getElementById("tab-content-meteo");
      const contentNews = document.getElementById("tab-content-news");

      if (btnMeteo) btnMeteo.className = `flex-1 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'meteo' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`;
      if (btnNews) btnNews.className = `flex-1 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'news' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`;

      if (contentMeteo) contentMeteo.classList.toggle("hidden", tab !== "meteo");
      if (contentNews) contentNews.classList.toggle("hidden", tab !== "news");
    },

    filterNews: function(source) {
      activeNewsFilter = source;
      document.querySelectorAll("#news-source-filter .rpg-category-chip").forEach(c => {
        const isMatch = (source === "tutte" && c.id === "chip-news-tutte") ||
                        (source === "VersiliaToday" && c.id === "chip-news-vt") ||
                        (source === "NoiTV" && c.id === "chip-news-noitv");
        c.classList.toggle("active", isMatch);
      });
      renderNewsArticlesList();
    },

    refreshData: function() {
      fetchRemoteData(true);
    },

    mountWidget: mountMiniWidget
  };
})();

window.NewsMeteoEngine = NewsMeteoEngine;
