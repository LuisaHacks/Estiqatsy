// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2wizard.js (VERSIONE 2.0 - FAST VETERAN LOOP & HERO CARD STAGE)
// LAYER: WIZARD FULL-STAGE, PERSISTENT 3D VIEW, MONUMENTAL HERO CARD & GESTURES
// ============================================================================

// ----------------------------------------------------------------------------
// 1. DATA ACCESS & CLASSIFICAZIONE CONDIVISA
// ----------------------------------------------------------------------------
const RULES2_SHOP_CATEGORIES = {
  "ARMI": { key: "ARMI", label: "Armi", emoji: "🗡️" },
  "VEICOLI": { key: "VEICOLI", label: "Veicoli", emoji: "🛴" },
  "STRUMENTI": { key: "STRUMENTI", label: "Strumenti", emoji: "🔧" },
  "INFORMAZIONI": { key: "INFORMAZIONI", label: "Dossier & Prove", emoji: "📁" },
  "TALISMANI": { key: "TALISMANI", label: "Talismani", emoji: "📿" },
  "DROGHE": { key: "DROGHE", label: "Droghe & Reagenti", emoji: "💊" },
  "CURE": { key: "CURE", label: "Cure", emoji: "🍱" }
};

function Rules2_ClassifyEntity(item) {
  if (!item) return "STRUMENTI";
  const cat = String(item.categoria || "").toUpperCase().trim();
  const sub = String(item.sottocategoria || "").toUpperCase().trim();

  if (cat.includes("ARMA")) return "ARMI";
  if (cat.includes("VEICOLO")) return "VEICOLI";
  if (cat.includes("INFORMAZION") || sub.includes("PROV") || sub.includes("DOSSIER") || sub.includes("INDIZI")) return "INFORMAZIONI";
  if (cat.includes("TALISMAN") || sub.includes("VOODOO")) return "TALISMANI";
  if (cat.includes("DROGA") || cat.includes("INGREDIENTE")) return "DROGHE";
  if (cat.includes("CURA") || sub.includes("CIBO") || sub.includes("INFERMERIA")) return "CURE";
  return "STRUMENTI";
}

function Rules2_FormatHumanEffect(rawEffect, faction = "") {
  if (!rawEffect || rawEffect === "—" || rawEffect === "-") return "Nessuna proprietà speciale.";
  const tags = String(rawEffect).split(/[,|]/);
  const out = [];

  for (let t of tags) {
    const tag = t.trim();
    if (!tag || tag === "—") continue;

    if (tag === "TASTO:ZOMBI_ABILITA") out.push("🧟 <b>Necromanzia:</b> Costa 1 PV per rianimare un nemico caduto come Zombi (Danno x2).");
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Usa 1 dose di droga idonea per rianimare uno Zombi.");
    else if (tag === "CLASSE:Destra") out.push("⚖️ <b>Orientamento Destra:</b> +1 Danno fisso vs Mazzu e Ideologi.");
    else if (tag === "CLASSE:Sinistra") out.push("⚖️ <b>Orientamento Sinistra:</b> +1 Danno fisso vs Camorristi e Burocrati.");
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 a tutti i tiri D20 ed Eventi.");
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT contro la fazione ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente sull'inchiesta.");
    else if (tag.startsWith("SINTESI:")) out.push(`⚗️ <b>Laboratorio Clandestino:</b> Sintetizza sostanze (${tag.replace("SINTESI:", "")}).`);
    else if (tag.startsWith("PASSIVO:INGREDIENTE_")) out.push("🧪 <b>Materia Prima:</b> Reagente per laboratori chimici.");
    else if (tag.startsWith("PASSIVO:OGGETTO_")) out.push("🧰 <b>Strumento Speciale:</b> Sblocca varchi o bypassa controlli correlati.");
    else if (tag.startsWith("VULN:")) out.push(`💥 <b>Vulnerabilità:</b> Subisce +2 danni da colpi a ${tag.replace("VULN:", "")}.`);
    else out.push(`⚡ <b>Proprietà:</b> ${tag.replace(/_/g, " ")}`);
  }

  return out.join("<br>");
}

function Rules2_SafeAttr(str) {
  if (!str) return "";
  return String(str).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

function tgHaptic(type = "light") {
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback;
    if (!h) return;
    if (type === "selection") h.selectionChanged();
    else if (type === "success") h.notificationOccurred("success");
    else if (type === "warning") h.notificationOccurred("warning");
    else if (type === "error") h.notificationOccurred("error");
    else h.impactOccurred(type);
  } catch (e) {}
}

function tgAlert(message) {
  if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(message);
  else alert(message);
}

// ----------------------------------------------------------------------------
// 2. STORE CLIENT-SIDE (CACHE WIZARD)
// ----------------------------------------------------------------------------
const Rules2Store = {
  _cache: {},
  getCacheKey: (gameKey) => `rules2_store_${gameKey}`,
  loadCachedWizardData: function(gameKey) {
    if (this._cache[gameKey]) return this._cache[gameKey];
    try {
      const stored = localStorage.getItem(this.getCacheKey(gameKey));
      if (stored) return (this._cache[gameKey] = JSON.parse(stored));
    } catch (e) {}
    return null;
  },
  setCachedWizardData: function(gameKey, data) {
    this._cache[gameKey] = data;
    try { localStorage.setItem(this.getCacheKey(gameKey), JSON.stringify(data)); } catch (e) {}
  }
};

// ----------------------------------------------------------------------------
// 3. WIZARD PERSONAGGIO (MACCHINA A STATI CON SUPPORTO VETERANO)
// ----------------------------------------------------------------------------
const Rules2Wizard = {
  state: {
    gameKey: null,
    episodio: 1,
    step: 1,
    isVeteran: false,
    classes: [],
    abilities: [],
    shopCatalog: [],
    shopCategory: "ARMI",

    activeClassIndex: 0,
    activeAbilityIndex: 0,
    activeShopIndex: 0,

    globalViewMode: "3d",

    chosenClass: null,
    chosenAbilities: [],
    boughtItems: [],
    heroName: "",
    remainingPx: 100,
    startingGold: 40,
    currentGold: 40,

    _autoplayTimer: null,
    _touchStartX: 0
  },

  open: async function(gameKey, epNum, isVeteran = false, savedHero = null) {
    try {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("wizard");

      this.state.gameKey = gameKey;
      this.state.episodio = epNum;
      this.state.isVeteran = Boolean(isVeteran || (savedHero && epNum > 1));

      let wizData = Rules2Store.loadCachedWizardData(gameKey);
      if (!wizData) {
        wizData = await apiCall("game_wizard_data", { gameKey: gameKey });
        if (wizData) Rules2Store.setCachedWizardData(gameKey, wizData);
      }

      this.state.classes = (wizData.classes || wizData.classi || []);
      this.state.abilities = (wizData.abilities || wizData.abilita || []);
      this.state.shopCatalog = (wizData.emporioItems || wizData.equipaggiamenti || []);

      this.state.chosenAbilities = [];
      this.state.boughtItems = [];
      this.state.activeClassIndex = 0;
      this.state.activeAbilityIndex = 0;
      this.state.activeShopIndex = 0;

      // GESTIONE DISTINTA: EROE VETERANO vs NUOVO EROE
      if (this.state.isVeteran && savedHero) {
        const matchingClass = this.state.classes.find(c => c.id === savedHero.classeId || c.nome === savedHero.classe) || this.state.classes[0];
        this.state.chosenClass = matchingClass;
        this.state.heroName = savedHero.nomeEroe || AppState.user?.nome || "Veterano";
        this.state.currentGold = savedHero.oro !== undefined ? Number(savedHero.oro) : Number(matchingClass.oro || 40);
        this.state.startingGold = this.state.currentGold;
        this.state.remainingPx = Number(savedHero.px || 100);
        this.state.chosenAbilities = [...(savedHero.abilitaIds || savedHero.abilita || [])];

        // Salto immediato al Passo 2 (Talenti)
        this.renderStep2();
        this.showStep(2);
      } else {
        const firstClass = this.state.classes[0] || null;
        this.state.chosenClass = firstClass;
        this.state.remainingPx = 100;
        this.state.startingGold = firstClass ? Number(firstClass.oro || 40) : 40;
        this.state.currentGold = this.state.startingGold;
        this.state.heroName = AppState.user?.nome || "Avventuriero";

        this.renderStep1();
        this.showStep(1);
      }

      this.bindModalBackdropClose();
      AppRouter.navigate("view-wizard");
    } catch (err) {
      console.error("[Rules2Wizard] Errore apertura wizard:", err);
      tgAlert("Errore wizard: " + err.message);
    }
  },

  resumeSession: async function(gameKey, epNum, sessionData) {
    await this.open(gameKey, epNum, false, null);
    const fase = sessionData.activeFase || sessionData.fase || "";
    const hero = sessionData.statoEroe || sessionData.hero || {};

    if (hero.classeId || hero.classe) {
      const found = this.state.classes.find(c => c.id === hero.classeId || c.nome === hero.classe);
      if (found) {
        this.state.activeClassIndex = this.state.classes.indexOf(found);
        this.state.chosenClass = found;
        this.state.startingGold = Number(found.oro || 40);
        this.state.currentGold = hero.oro !== undefined ? hero.oro : this.state.startingGold;
      }
    }

    if (fase === "WIZARD_ABILITA") { this.renderStep2(); this.showStep(2); }
    else if (fase === "WIZARD_SHOP") { this.renderStep3(); this.showStep(3); }
    else if (fase === "WIZARD_NOME") { this.renderStep4(); this.showStep(4); }
    else { this.renderStep1(); this.showStep(1); }
  },

  showStep: function(stepNum) {
    this.state.step = stepNum;
    [1, 2, 3, 4].forEach(n => {
      const panel = document.getElementById(`wizard-step-${n === 1 ? 'class' : n === 2 ? 'abilities' : n === 3 ? 'shop' : 'name'}`);
      if (panel) panel.classList.toggle("hidden", n !== stepNum);
      const footer = document.getElementById(`wiz-footer-step-${n}`);
      if (footer) footer.classList.toggle("hidden", n !== stepNum);
    });

    // Se veterano allo Step 3, aggiorna il tasto per il lancio diretto
    if (stepNum === 3) {
      const nextBtn = document.getElementById("wizard-step3-next-btn");
      if (nextBtn) {
        if (this.state.isVeteran) {
          nextBtn.textContent = `Inizia Ep. ${this.state.episodio} 🚀`;
          nextBtn.onclick = () => Rules2Wizard.finalizeHero();
        } else {
          nextBtn.textContent = "Riepilogo ›";
          nextBtn.onclick = () => Rules2Wizard.nextStep(4);
        }
      }
    }

    if (stepNum <= 3 && this.state.globalViewMode === "3d") {
      this.startAutoplay();
    } else {
      this.stopAutoplay();
    }

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  startAutoplay: function() {
    this.stopAutoplay();
    this.state._autoplayTimer = setInterval(() => {
      if (this.state.step === 1) this.coverflowNext(true);
      else if (this.state.step === 2) this.cylinderAbilitiesNext(true);
      else if (this.state.step === 3) this.cylinderShopNext(true);
    }, 5000);
  },

  stopAutoplay: function() {
    if (this.state._autoplayTimer) {
      clearInterval(this.state._autoplayTimer);
      this.state._autoplayTimer = null;
    }
  },

  bindModalBackdropClose: function() {
    document.querySelectorAll("dialog.modal").forEach(dialog => {
      if (!dialog._hasBackdropClick) {
        dialog._hasBackdropClick = true;
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) dialog.close();
        });
      }
    });
  },

  setWizardViewMode: function(stepKey, mode) {
    this.state.globalViewMode = mode;
    const is3D = (mode === "3d");

    ["class", "abilities", "shop"].forEach(k => {
      const btn3D = document.getElementById(`toggle-view-btn-${k}-3d`);
      const btnList = document.getElementById(`toggle-view-btn-${k}-list`);
      if (btn3D) btn3D.classList.toggle("active", is3D);
      if (btnList) btnList.classList.toggle("active", !is3D);

      const v3D = document.getElementById(`wizard-${k}-view-3d`);
      const vList = document.getElementById(`wizard-${k}-view-list`);
      if (v3D) v3D.classList.toggle("hidden", !is3D);
      if (vList) vList.classList.toggle("hidden", is3D);
    });

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");

    if (this.state.step === 1) {
      if (is3D) { this.updateCoverflowStage(); this.startAutoplay(); }
      else { this.stopAutoplay(); this.renderClassesList(); }
    } else if (this.state.step === 2) {
      this.renderStep2();
    } else if (this.state.step === 3) {
      this.renderStep3();
    }
  },

  // --------------------------------------------------------------------------
  // STEP 1: CLASSI (FACTION GLOW & ZERO FRECCE SPURIE)
  // --------------------------------------------------------------------------
  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    const classes = this.state.classes || [];
    stage.innerHTML = classes.map((cls, idx) => {
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();
      const forVal = Number(cls.forza || 10);
      const desVal = Number(cls.destrezza || 10);
      const intVal = Number(cls.intelligenza || 10);
      const cleanQuote = String(cls.citazione || "A Viareggio se non hai il ferro giusto duri poco.").replace(/^["'“”]+|["'“”]+$/g, "");

      return `
        <div id="coverflow-card-${idx}" data-faction="${pol}" onclick="Rules2Wizard.coverflowSelectIndex(${idx})" class="coverflow-card">
          <div class="coverflow-media-frame">
            <img src="${cls.mediaUrl}" class="coverflow-img" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            
            <div class="coverflow-header-bar">
              <div class="coverflow-title-group">
                <span class="coverflow-title-icon">${cls.emoji || '🥋'}</span>
                <h4 class="coverflow-title">${cls.nome}</h4>
              </div>
              <span class="coverflow-badge-faction" data-faction="${pol}">
                ${pol.toUpperCase()}
              </span>
            </div>

            <div class="coverflow-header-divider"></div>

            <div class="watermark-cover-banner">
              <div class="quote-text">“${cleanQuote}”</div>
              <div class="quote-author">${cls.autoreCitazione || 'Darsena'}</div>
            </div>
          </div>

          <div id="coverflow-details-${idx}" class="coverflow-details-box">
            <div class="coverflow-stats-row">
              <div>🥊 FOR <b>${forVal}</b></div>
              <div>🤸 DES <b>${desVal}</b></div>
              <div>🧠 INT <b>${intVal}</b></div>
            </div>

            <p class="coverflow-lore">${cls.testo || cls.descrizione || ''}</p>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label truncate">
                🎒 <b>${cls.equipLoot || 'Pugni nudi'}</b>
              </span>
              <div class="coverflow-kpi-pill">
                <span class="pill-pv">❤️ ${cls.pv} PV</span>
                <span class="pill-gold">🟡 ${cls.oro} ORO</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = `
        <div class="coverflow-nav-cluster">
          <button onclick="event.stopPropagation(); Rules2Wizard.coverflowPrev();" class="coverflow-btn-side" aria-label="Precedente">‹</button>
          <div class="coverflow-dots">
            ${classes.map((_, i) => `
              <span onclick="Rules2Wizard.coverflowSelectIndex(${i})" class="coverflow-dot ${i === this.state.activeClassIndex ? 'active' : ''}"></span>
            `).join("")}
          </div>
          <button onclick="event.stopPropagation(); Rules2Wizard.coverflowNext();" class="coverflow-btn-side" aria-label="Successivo">›</button>
        </div>
      `;
    }

    this.bindGestures(stage, () => this.coverflowNext(), () => this.coverflowPrev());
    this.updateCoverflowStage();
  },

  bindGestures: function(stageEl, onNext, onPrev) {
    if (!stageEl || stageEl._hasGestures) return;
    stageEl._hasGestures = true;

    stageEl.addEventListener("touchstart", (e) => {
      this.stopAutoplay();
      this.state._touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    stageEl.addEventListener("touchend", (e) => {
      const diff = this.state._touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 35) {
        if (diff > 0) onNext();
        else onPrev();
      }
    }, { passive: true });

    stageEl.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > 25) {
        this.stopAutoplay();
        if (e.deltaX > 0) onNext();
        else onPrev();
      }
    }, { passive: true });

    window.addEventListener("keydown", (e) => {
      if (this.state.step > 3) return;
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    });
  },

  updateCoverflowStage: function() {
    const classes = this.state.classes || [];
    const total = classes.length;
    if (total === 0) return;

    const activeIdx = this.state.activeClassIndex;
    const spacing = window.innerWidth >= 768 ? 200 : 145;

    classes.forEach((cls, i) => {
      const el = document.getElementById(`coverflow-card-${i}`);
      if (!el) return;

      let diff = (i - activeIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const offset = diff;
      const absOffset = Math.abs(offset);

      if (absOffset > 2 && window.innerWidth < 768) {
        el.style.display = "none";
        return;
      }
      el.style.display = "flex";

      const isCenter = (offset === 0);
      const translateX = offset * spacing;
      const rotateY = offset * -18;
      const scale = isCenter ? 1.02 : Math.max(0.72, 0.88 - absOffset * 0.08);

      el.style.transform = `translateX(${translateX}px) translateZ(${isCenter ? 40 : -50}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.zIndex = 30 - Math.round(absOffset * 5);
      el.style.opacity = isCenter ? 1 : Math.max(0.2, 0.5 - absOffset * 0.15);
      el.classList.toggle("glow-active", isCenter);
    });

    this.state.chosenClass = classes[activeIdx];
    if (!this.state.isVeteran) {
      this.state.startingGold = Number(classes[activeIdx].oro || 40);
      this.state.currentGold = this.state.startingGold;
    }

    const dotsContainer = document.querySelector("#wizard-coverflow-dots .coverflow-dots");
    if (dotsContainer) {
      dotsContainer.querySelectorAll(".coverflow-dot").forEach((d, i) => d.classList.toggle("active", i === activeIdx));
    }
  },

  coverflowSelectIndex: function(idx) {
    this.stopAutoplay();
    this.state.activeClassIndex = idx;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateCoverflowStage();
  },

  coverflowNext: function(isAuto = false) {
    if (!isAuto) this.stopAutoplay();
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex + 1) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateCoverflowStage();
  },

  coverflowPrev: function() {
    this.stopAutoplay();
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex - 1 + total) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateCoverflowStage();
  },

  renderClassesList: function() {
    const container = document.getElementById("wizard-classes-list-container");
    if (!container) return;

    const classes = this.state.classes || [];
    container.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.chosenClass?.id === cls.id);
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();

      return `
        <div data-faction="${pol}" onclick="Rules2Wizard.selectClassByIndex(${idx})" class="class-list-card ${isSelected ? 'selected' : ''}">
          <div class="flex items-center space-x-3 min-w-0 flex-1">
            <div class="class-list-thumb">
              <img src="${cls.mediaUrl}" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            </div>
            <div class="class-list-info">
              <div class="class-list-name">${cls.emoji || '🥋'} ${cls.nome}</div>
              <div class="class-list-sub">
                <span class="${pol === 'destra' ? 'text-sky-400' : 'text-rose-400'} font-bold">${pol.toUpperCase()}</span> • ❤️ ${cls.pv} PV • 🟡 ${cls.oro} ORO
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-xs ${isSelected ? 'btn-success font-black' : 'btn-outline border-white/20 text-slate-300'}">
              ${isSelected ? 'Attivo ✓' : 'Seleziona'}
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  selectClassByIndex: function(idx) {
    this.state.activeClassIndex = idx;
    this.state.chosenClass = this.state.classes[idx];
    if (!this.state.isVeteran) {
      this.state.startingGold = Number(this.state.chosenClass.oro || 40);
      this.state.currentGold = this.state.startingGold;
    }
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
    this.renderClassesList();
  },

  confirmStep1: function() {
    this.stopAutoplay();
    if (!this.state.chosenClass) return tgAlert("Scegli una classe!");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("success");
    this.renderStep2();
    this.showStep(2);
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ & TALENTI
  // --------------------------------------------------------------------------
  renderStep2: function() {
    const is3D = (this.state.globalViewMode === "3d");
    const v3D = document.getElementById("wizard-abilities-view-3d");
    const vList = document.getElementById("wizard-abilities-view-list");
    if (v3D) v3D.classList.toggle("hidden", !is3D);
    if (vList) vList.classList.toggle("hidden", is3D);

    const budgetBadge = document.getElementById("wizard-px-budget");
    if (budgetBadge) budgetBadge.textContent = `✨ ${this.state.remainingPx} PX`;

    if (is3D) {
      this.renderAbilities3D();
      this.startAutoplay();
    } else {
      this.stopAutoplay();
      this.renderAbilitiesList();
    }
  },

  renderAbilities3D: function() {
    const stage = document.getElementById("wizard-abilities-stage");
    const dotsBox = document.getElementById("wizard-abilities-dots");
    if (!stage) return;

    const abilities = this.state.abilities || [];
    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    stage.innerHTML = abilities.map((abl, idx) => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);
      const perkText = Rules2_FormatHumanEffect(abl.requisitiCodificati || abl.effettoCodificato, userFaction);

      return `
        <div id="abilities-card-${idx}" data-faction="${userFaction}" onclick="Rules2Wizard.selectAbilityIndex(${idx})" class="coverflow-card">
          <div class="coverflow-media-frame">
            <img src="${abl.mediaUrl && abl.mediaUrl !== '—' ? abl.mediaUrl : 'https://image.pollinations.ai/prompt/cyberpunk-noir-skill-icon?width=800&height=450&nologo=true'}" class="coverflow-img" alt="${Rules2_SafeAttr(abl.nome)}" loading="lazy">
            
            <div class="coverflow-header-bar">
              <div class="coverflow-title-group">
                <span class="coverflow-title-icon">${abl.emoji || '⚡'}</span>
                <h4 class="coverflow-title">${abl.nome}</h4>
              </div>
              <span class="badge badge-xs coverflow-badge-faction badge-info font-mono">
                100 PX
              </span>
            </div>

            <div class="coverflow-header-divider"></div>
          </div>

          <div class="coverflow-details-box">
            <div class="text-[11px] text-slate-200 leading-relaxed overflow-y-auto max-h-[140px] pr-1">
              ${perkText}
            </div>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label">Requisito: <b>${req.includes('destra') ? 'Destra' : (req.includes('sinistra') ? 'Sinistra' : 'Comune')}</b></span>
              <button onclick="event.stopPropagation(); Rules2Wizard.toggleAbility('${abl.id}')" class="btn btn-xs ${isSelected ? 'btn-error font-black' : (isCompatible ? 'btn-primary font-black' : 'btn-disabled')}">
                ${isSelected ? 'Rimuovi' : (isCompatible ? 'Attiva' : '🔒')}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = `
        <div class="coverflow-nav-cluster">
          <button onclick="event.stopPropagation(); Rules2Wizard.cylinderAbilitiesPrev();" class="coverflow-btn-side" aria-label="Precedente">‹</button>
          <div class="coverflow-dots">
            ${abilities.map((_, i) => `
              <span onclick="Rules2Wizard.selectAbilityIndex(${i})" class="coverflow-dot ${i === this.state.activeAbilityIndex ? 'active' : ''}"></span>
            `).join("")}
          </div>
          <button onclick="event.stopPropagation(); Rules2Wizard.cylinderAbilitiesNext();" class="coverflow-btn-side" aria-label="Successivo">›</button>
        </div>
      `;
    }

    this.bindGestures(stage, () => this.cylinderAbilitiesNext(), () => this.cylinderAbilitiesPrev());
    this.updateAbilitiesCylinder();
  },

  updateAbilitiesCylinder: function() {
    const abilities = this.state.abilities || [];
    const total = abilities.length;
    if (total === 0) return;

    const activeIdx = this.state.activeAbilityIndex;
    const spacing = window.innerWidth >= 768 ? 200 : 145;

    abilities.forEach((abl, i) => {
      const el = document.getElementById(`abilities-card-${i}`);
      if (!el) return;

      let diff = (i - activeIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const offset = diff;
      const absOffset = Math.abs(offset);

      if (absOffset > 2 && window.innerWidth < 768) {
        el.style.display = "none";
        return;
      }
      el.style.display = "flex";

      const isCenter = (offset === 0);
      const translateX = offset * spacing;
      const rotateY = offset * -18;
      const scale = isCenter ? 1.02 : Math.max(0.72, 0.88 - absOffset * 0.08);

      el.style.transform = `translateX(${translateX}px) translateZ(${isCenter ? 40 : -50}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.zIndex = 30 - Math.round(absOffset * 5);
      el.style.opacity = isCenter ? 1 : Math.max(0.2, 0.5 - absOffset * 0.15);
      el.classList.toggle("glow-active", isCenter);
    });

    const dotsContainer = document.querySelector("#wizard-abilities-dots .coverflow-dots");
    if (dotsContainer) {
      dotsContainer.querySelectorAll(".coverflow-dot").forEach((d, i) => d.classList.toggle("active", i === activeIdx));
    }
  },

  selectAbilityIndex: function(idx) {
    this.stopAutoplay();
    this.state.activeAbilityIndex = idx;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateAbilitiesCylinder();
  },

  cylinderAbilitiesNext: function(isAuto = false) {
    if (!isAuto) this.stopAutoplay();
    const total = (this.state.abilities || []).length;
    if (total <= 1) return;
    this.state.activeAbilityIndex = (this.state.activeAbilityIndex + 1) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateAbilitiesCylinder();
  },

  cylinderAbilitiesPrev: function() {
    this.stopAutoplay();
    const total = (this.state.abilities || []).length;
    if (total <= 1) return;
    this.state.activeAbilityIndex = (this.state.activeAbilityIndex - 1 + total) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateAbilitiesCylinder();
  },

  renderAbilitiesList: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    if (!grid) return;

    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    grid.innerHTML = this.state.abilities.map(abl => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);

      return `
        <div onclick="Rules2Wizard.toggleAbility('${abl.id}')" class="wizard-ability-card ${isSelected ? 'selected' : (isCompatible ? 'compatible' : 'locked')}">
          <div class="ability-card-info">
            <div class="flex items-center space-x-2">
              <span class="text-xl">${abl.emoji || '⚡'}</span>
              <span class="ability-card-title">${abl.nome}</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-1">${abl.effettoCodificato || abl.descrizione || ''}</div>
          </div>
          <div>
            <span class="badge badge-sm ${isSelected ? 'badge-primary font-black' : (isCompatible ? 'badge-ghost font-mono' : 'badge-neutral')}">
              ${isSelected ? 'Appreso ✓' : (isCompatible ? '100 PX' : '🔒')}
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  toggleAbility: function(ablId) {
    const idx = this.state.chosenAbilities.indexOf(ablId);
    if (idx !== -1) {
      this.state.chosenAbilities.splice(idx, 1);
      this.state.remainingPx += 100;
      tgHaptic("light");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    } else {
      if (this.state.remainingPx >= 100) {
        this.state.chosenAbilities.push(ablId);
        this.state.remainingPx -= 100;
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("lucky");
      } else {
        tgHaptic("error");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
        return tgAlert("PX insufficienti!");
      }
    }
    this.renderStep2();
  },

  confirmStep2: function() {
    this.stopAutoplay();
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("success");
    this.renderStep3();
    this.showStep(3);
  },

  // --------------------------------------------------------------------------
  // STEP 3: MERCATO NERO DI CICCIO
  // --------------------------------------------------------------------------
  renderStep3: function() {
    this.filterShop(this.state.shopCategory || "ARMI");
  },

  filterShop: function(cat) {
    this.state.shopCategory = cat;
    const is3D = (this.state.globalViewMode === "3d");

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(cat.toUpperCase());
        btn.className = `rpg-category-chip badge ${isAct ? 'badge-info active' : 'badge-ghost'}`;
      });
    }

    const goldDisp = document.getElementById("wizard-shop-gold-display");
    if (goldDisp) goldDisp.textContent = `🟡 ${this.state.currentGold} ORO`;

    const v3D = document.getElementById("wizard-shop-view-3d");
    const vList = document.getElementById("wizard-shop-view-list");
    if (v3D) v3D.classList.toggle("hidden", !is3D);
    if (vList) vList.classList.toggle("hidden", is3D);

    if (is3D) {
      this.renderShop3D();
      this.startAutoplay();
    } else {
      this.stopAutoplay();
      this.renderShopList();
    }

    this.updateBackpackSummary();
  },

  renderShop3D: function() {
    const stage = document.getElementById("wizard-shop-stage");
    const dotsBox = document.getElementById("wizard-shop-dots");
    if (!stage) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    stage.innerHTML = filtered.map((it, idx) => {
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const canAfford = this.state.currentGold >= price;

      return `
        <div id="shop-card-${idx}" data-faction="${userFaction}" onclick="Rules2Wizard.selectShopIndex(${idx})" class="coverflow-card">
          <div class="coverflow-media-frame">
            <img src="${it.mediaUrl && it.mediaUrl !== '—' ? it.mediaUrl : 'https://image.pollinations.ai/prompt/black-market-crate?width=800&height=450&nologo=true'}" class="coverflow-img" alt="${Rules2_SafeAttr(it.nome)}" loading="lazy">
            
            <div class="coverflow-header-bar">
              <div class="coverflow-title-group">
                <span class="coverflow-title-icon">${it.emoji || '📦'}</span>
                <h4 class="coverflow-title">${it.nome}</h4>
              </div>
              <span class="badge badge-xs coverflow-badge-faction badge-warning font-mono">
                ${price} 🟡
              </span>
            </div>

            <div class="coverflow-header-divider"></div>
          </div>

          <div class="coverflow-details-box">
            <p class="coverflow-lore">${it.descrizione || it.testo || ''}</p>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label">Prezzo: <b>${price} ORO</b></span>
              <button onclick="event.stopPropagation(); Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-outline border-white/10 opacity-40'}" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Compra' : 'Oro Insuff.'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = `
        <div class="coverflow-nav-cluster">
          <button onclick="event.stopPropagation(); Rules2Wizard.cylinderShopPrev();" class="coverflow-btn-side" aria-label="Precedente">‹</button>
          <div class="coverflow-dots">
            ${filtered.map((_, i) => `
              <span onclick="Rules2Wizard.selectShopIndex(${i})" class="coverflow-dot ${i === this.state.activeShopIndex ? 'active' : ''}"></span>
            `).join("")}
          </div>
          <button onclick="event.stopPropagation(); Rules2Wizard.cylinderShopNext();" class="coverflow-btn-side" aria-label="Successivo">›</button>
        </div>
      `;
    }

    this.bindGestures(stage, () => this.cylinderShopNext(), () => this.cylinderShopPrev());
    this.updateShopCylinder();
  },

  updateShopCylinder: function() {
    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const total = filtered.length;
    if (total === 0) return;

    const activeIdx = this.state.activeShopIndex;
    const spacing = window.innerWidth >= 768 ? 200 : 145;

    filtered.forEach((it, i) => {
      const el = document.getElementById(`shop-card-${i}`);
      if (!el) return;

      let diff = (i - activeIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const offset = diff;
      const absOffset = Math.abs(offset);

      if (absOffset > 2 && window.innerWidth < 768) {
        el.style.display = "none";
        return;
      }
      el.style.display = "flex";

      const isCenter = (offset === 0);
      const translateX = offset * spacing;
      const rotateY = offset * -18;
      const scale = isCenter ? 1.02 : Math.max(0.72, 0.88 - absOffset * 0.08);

      el.style.transform = `translateX(${translateX}px) translateZ(${isCenter ? 40 : -50}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.zIndex = 30 - Math.round(absOffset * 5);
      el.style.opacity = isCenter ? 1 : Math.max(0.2, 0.5 - absOffset * 0.15);
      el.classList.toggle("glow-active", isCenter);
    });

    const dotsContainer = document.querySelector("#wizard-shop-dots .coverflow-dots");
    if (dotsContainer) {
      dotsContainer.querySelectorAll(".coverflow-dot").forEach((d, i) => d.classList.toggle("active", i === activeIdx));
    }
  },

  selectShopIndex: function(idx) {
    this.stopAutoplay();
    this.state.activeShopIndex = idx;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateShopCylinder();
  },

  cylinderShopNext: function(isAuto = false) {
    if (!isAuto) this.stopAutoplay();
    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const total = filtered.length;
    if (total <= 1) return;
    this.state.activeShopIndex = (this.state.activeShopIndex + 1) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateShopCylinder();
  },

  cylinderShopPrev: function() {
    this.stopAutoplay();
    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const total = filtered.length;
    if (total <= 1) return;
    this.state.activeShopIndex = (this.state.activeShopIndex - 1 + total) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");
    this.updateShopCylinder();
  },

  renderShopList: function() {
    const container = document.getElementById("wizard-shop-grid");
    if (!container) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    container.innerHTML = filtered.map(it => {
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const canAfford = this.state.currentGold >= price;

      return `
        <div class="wizard-shop-card">
          <div onclick="Rules2Wizard.inspectItemDetail('${it.id}')" class="shop-card-clickable">
            <div class="shop-card-head">
              <span class="text-lg">${it.emoji || '📦'}</span>
              <span class="shop-card-price">${price} 🟡</span>
            </div>
            <div class="shop-card-title">${it.nome}</div>
            <div class="shop-card-desc">${it.descrizione || it.testo || ''}</div>
          </div>
          <div class="shop-card-actions">
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-outline border-white/10 opacity-40'}" ${!canAfford ? 'disabled' : ''}>
              ${canAfford ? 'Compra' : 'Oro Insuff.'}
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  inspectItemDetail: function(itemId) {
    const it = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!it) return;
    const price = Math.abs(Number(it.costoOro || it.costo || 15));
    const canAfford = this.state.currentGold >= price;

    document.getElementById("uni-detail-icon").textContent = it.emoji || "📦";
    document.getElementById("uni-detail-title").textContent = it.nome;
    document.getElementById("uni-detail-lore").textContent = it.descrizione || it.testo || "";

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      btn.textContent = canAfford ? `Compra (${price} ORO)` : "Oro Insufficiente";
      btn.className = canAfford ? "btn btn-sm btn-primary font-black w-full" : "btn btn-sm btn-disabled w-full";
      btn.onclick = canAfford ? () => this.buyItem(it.id, price) : null;
    }

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-universal-detail")?.showModal();
  },

  buyItem: function(itemId, price) {
    if (this.state.currentGold < price) {
      tgHaptic("error");
      return tgAlert("Oro insufficiente!");
    }

    const item = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    if (Rules2_ClassifyEntity(item) === "VEICOLI") {
      const alreadyHasVehicle = this.state.boughtItems.some(x => Rules2_ClassifyEntity(x) === "VEICOLI");
      if (alreadyHasVehicle) {
        tgHaptic("warning");
        return tgAlert("Massimo 1 Veicolo consentito!");
      }
    }

    this.state.currentGold -= price;
    this.state.boughtItems.push(item);
    tgHaptic("success");

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
    document.getElementById("modal-universal-detail")?.close();
    this.filterShop(this.state.shopCategory);
  },

  resetShop: function() {
    this.state.currentGold = this.state.startingGold;
    this.state.boughtItems = [];
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.filterShop(this.state.shopCategory);
  },

  updateBackpackSummary: function() {
    const countEl = document.getElementById("wizard-shop-backpack-count");
    if (!countEl) return;
    const startingItem = this.state.chosenClass?.equipLoot;
    const hasStarting = (startingItem && startingItem !== "—" && startingItem !== "-");
    const total = (hasStarting ? 1 : 0) + this.state.boughtItems.length;
    countEl.innerHTML = `${total} ogg.`;
  },

  // --------------------------------------------------------------------------
  // STEP 4: LANCIO EROE (SCHEDA MONUMENTALE DINAMICA CON IDENTICO SHELL 3D)
  // --------------------------------------------------------------------------
  renderStep4: function() {
    this.stopAutoplay();
    const cls = this.state.chosenClass;
    if (!cls) return;

    const pol = String(cls.sottocategoria || 'Destra').toLowerCase();
    const heroName = this.state.heroName || AppState.user?.nome || "Avventuriero";
    const startingGear = cls.equipLoot || "Pugni nudi";

    const ablNames = (this.state.chosenAbilities || []).map(id => {
      const a = (this.state.abilities || []).find(x => x.id === id);
      return a ? a.nome : id;
    });

    const gearNames = [startingGear, ...this.state.boughtItems.map(i => i.nome)].filter(Boolean);
    const dynamicBio = `Antieroe cresciuto tra i canali della Darsena, fedele alla causa di ${pol.toUpperCase()}. ` +
      (ablNames.length > 0 ? `Abilità: ${ablNames.join(', ')}. ` : 'Nessun talento clandestino. ') +
      (gearNames.length > 0 ? `Equipaggiamento: ${gearNames.join(', ')}.` : '');

    const container = document.getElementById("wizard-step-name");
    if (!container) return;

    container.innerHTML = `
      <div class="hero-launch-stage">
        <div data-faction="${pol}" class="hero-launch-card">
          <div class="coverflow-media-frame">
            <img src="${cls.mediaUrl}" class="coverflow-img" alt="${heroName}">
            
            <div class="coverflow-header-bar">
              <div onclick="Rules2Wizard.openNameEditModal()" class="coverflow-title-group cursor-pointer">
                <span class="coverflow-title-icon">${cls.emoji || '🥋'}</span>
                <h4 id="hero-display-name" class="coverflow-title">${heroName} ✏️</h4>
              </div>
              <span class="coverflow-badge-faction" data-faction="${pol}">
                ${pol.toUpperCase()}
              </span>
            </div>

            <div class="coverflow-header-divider"></div>

            <div class="watermark-cover-banner">
              <div class="quote-text">Classe: <b>${cls.nome}</b></div>
            </div>
          </div>

          <div class="coverflow-details-box">
            <div class="coverflow-stats-row">
              <div>🥊 FOR <b>${cls.forza || 10}</b></div>
              <div>🤸 DES <b>${cls.destrezza || 10}</b></div>
              <div>🧠 INT <b>${cls.intelligenza || 10}</b></div>
            </div>

            <div class="coverflow-lore">
              <p>${dynamicBio}</p>
            </div>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label">Status: <b>Pronto al Duello</b></span>
              <div class="coverflow-kpi-pill">
                <span class="pill-pv">❤️ ${cls.pv || 25} PV</span>
                <span class="pill-gold">🟡 ${this.state.currentGold} ORO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODALE MODIFICA NOME EROE -->
      <dialog id="modal-hero-name" class="modal modal-middle">
        <div class="modal-hero-name-box">
          <h3 class="text-sm font-black text-white uppercase">Nome dell'Eroe</h3>
          <input id="input-hero-name" type="text" class="input input-sm input-bordered w-full my-3 text-center font-bold text-white bg-slate-900" value="${heroName}">
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Rules2Wizard.saveHeroName()" class="btn btn-sm btn-primary font-black uppercase">Salva</button>
            <button onclick="document.getElementById('modal-hero-name').close()" class="btn btn-sm btn-ghost text-slate-400 font-bold uppercase">Annulla</button>
          </div>
        </div>
      </dialog>
    `;

    this.bindModalBackdropClose();
  },

  openNameEditModal: function() {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-hero-name")?.showModal();
  },

  saveHeroName: function() {
    const input = document.getElementById("input-hero-name");
    if (input && input.value.trim()) {
      this.state.heroName = input.value.trim();
      const disp = document.getElementById("hero-display-name");
      if (disp) disp.textContent = `${this.state.heroName} ✏️`;
    }
    document.getElementById("modal-hero-name")?.close();
  },

  finalizeHero: function() {
    const heroName = this.state.heroName || AppState.user?.nome || "Avventuriero";
    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass?.id || "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      heroName: heroName,
      avatarUrl: this.state.chosenClass?.mediaUrl || "",
      isVeteran: this.state.isVeteran
    };

    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.executeStartGame === "function") {
      Rules2Engine.executeStartGame(payload, payload.avatarUrl);
    }
  },

  nextStep: function(s) {
    if (s === 4) this.renderStep4();
    this.showStep(s);
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
  },

  prevStep: function(s) {
    this.showStep(s);
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
  }
};

// ----------------------------------------------------------------------------
// 4. ESPOSIZIONE GLOBALE & PROXY
// ----------------------------------------------------------------------------
window.Rules2Wizard = Rules2Wizard;

if (typeof window.GameEngine === "undefined") window.GameEngine = {};
Object.assign(window.GameEngine, {
  setWizardViewMode: (step, mode) => Rules2Wizard.setWizardViewMode(step, mode),
  coverflowPrev: () => Rules2Wizard.coverflowPrev(),
  coverflowNext: () => Rules2Wizard.coverflowNext(),
  cylinderAbilitiesPrev: () => Rules2Wizard.cylinderAbilitiesPrev(),
  cylinderAbilitiesNext: () => Rules2Wizard.cylinderAbilitiesNext(),
  cylinderShopPrev: () => Rules2Wizard.cylinderShopPrev(),
  cylinderShopNext: () => Rules2Wizard.cylinderShopNext(),

  wizardConfirmStep1: () => Rules2Wizard.confirmStep1(),
  wizardPrevStep: (s) => Rules2Wizard.prevStep(s),
  wizardConfirmStep2: () => Rules2Wizard.confirmStep2(),
  filterWizardShop: (c) => Rules2Wizard.filterShop(c),
  resetWizardShop: () => Rules2Wizard.resetShop(),
  wizardNextStep: (s) => Rules2Wizard.nextStep(s),
  wizardFinalizeHero: () => Rules2Wizard.finalizeHero()
});
