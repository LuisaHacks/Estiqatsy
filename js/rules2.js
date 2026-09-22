// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2.js (VERSIONE 10.1 - FULL AUDIO INTEGRATION & EPISODE BGM)
// LAYER 3: ENGINE RULES2, WIZARD FULL-STAGE, COCKPIT & CASSETTI TATTICI
// ============================================================================

// ----------------------------------------------------------------------------
// 1. DATA ACCESS LAYER & UTILITIES GLOBALI
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
  if (cat.includes("INFORMAZION") || sub.includes("PROV") || sub.includes("DOSSIER") || sub.includes("INDIZI") || sub.includes("SOSPETT")) return "INFORMAZIONI";
  if (cat.includes("TALISMAN") || sub.includes("VOODOO") || sub.includes("STATUS")) return "TALISMANI";
  if (cat.includes("DROGA") || cat.includes("INGREDIENTE")) return "DROGHE";
  if (cat.includes("CURA") || sub.includes("CIBO") || sub.includes("INFERMERIA") || sub.includes("SESSO")) return "CURE";
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
    else if (tag.startsWith("PASSIVO:INGREDIENTE_")) out.push(`🧪 <b>Materia Prima:</b> Reagente per laboratori chimici.`);
    else if (tag.startsWith("PASSIVO:OGGETTO_")) out.push(`🧰 <b>Strumento Speciale:</b> Sblocca varchi o bypassa controlli correlati.`);
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

function tgConfirm(message, onConfirm, onCancel = null) {
  if (window.Telegram?.WebApp?.showConfirm) {
    window.Telegram.WebApp.showConfirm(message, (ok) => {
      if (ok && onConfirm) onConfirm();
      else if (!ok && onCancel) onCancel();
    });
  } else {
    if (confirm(message)) {
      if (onConfirm) onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  }
}

function tgAlert(message) {
  if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
  }
}

// ----------------------------------------------------------------------------
// 2. STORE CLIENT-SIDE (CACHE STATICA WIZARD)
// ----------------------------------------------------------------------------
const Rules2Store = {
  _cache: {},

  getCacheKey: function(gameKey) {
    return `rules2_store_${gameKey}`;
  },

  loadCachedWizardData: function(gameKey) {
    if (this._cache[gameKey]) return this._cache[gameKey];
    try {
      const stored = localStorage.getItem(this.getCacheKey(gameKey));
      if (stored) {
        this._cache[gameKey] = JSON.parse(stored);
        return this._cache[gameKey];
      }
    } catch (e) {}
    return null;
  },

  setCachedWizardData: function(gameKey, data) {
    this._cache[gameKey] = data;
    try {
      localStorage.setItem(this.getCacheKey(gameKey), JSON.stringify(data));
    } catch (e) {}
  },

  clearCache: function(gameKey) {
    delete this._cache[gameKey];
    try {
      localStorage.removeItem(this.getCacheKey(gameKey));
    } catch (e) {}
  }
};

// ----------------------------------------------------------------------------
// 3. WIZARD CREAZIONE PERSONAGGIO (MACCHINA A STATI, GESTURES 360° & CARD MONUMENTALE)
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

    viewModes: { class: "3d", abilities: "list", shop: "list" },

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
      this.state.isVeteran = isVeteran;
      this.state.step = 1;

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

      const firstClass = this.state.classes[0] || null;
      this.state.chosenClass = firstClass;
      this.state.remainingPx = 100;
      this.state.startingGold = firstClass ? Number(firstClass.oro || 40) : 40;
      this.state.currentGold = this.state.startingGold;
      this.state.heroName = AppState.user?.nome || "Avventuriero";

      this.renderStep1();
      this.showStep(1);

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

    if (stepNum === 1 && this.state.viewModes.class === "3d") this.startAutoplay();
    else this.stopAutoplay();

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  startAutoplay: function() {
    this.stopAutoplay();
    this.state._autoplayTimer = setInterval(() => {
      this.coverflowNext(true);
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
    if (!this.state.viewModes) {
      this.state.viewModes = { class: "3d", abilities: "list", shop: "list" };
    }
    this.state.viewModes[stepKey] = mode;
    const is3D = (mode === "3d");

    const btn3D = document.getElementById(`toggle-view-btn-${stepKey}-3d`);
    const btnList = document.getElementById(`toggle-view-btn-${stepKey}-list`);
    if (btn3D) btn3D.classList.toggle("active", is3D);
    if (btnList) btnList.classList.toggle("active", !is3D);

    const v3D = document.getElementById(`wizard-${stepKey}-view-3d`);
    const vList = document.getElementById(`wizard-${stepKey}-view-list`);
    if (v3D) v3D.classList.toggle("hidden", !is3D);
    if (vList) vList.classList.toggle("hidden", is3D);

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");

    if (stepKey === "class") {
      if (is3D) {
        this.updateCoverflowStage();
        this.startAutoplay();
      } else {
        this.stopAutoplay();
        this.renderClassesList();
      }
    } else if (stepKey === "abilities") {
      this.renderStep2();
    } else if (stepKey === "shop") {
      this.renderStep3();
    }
  },

  // --------------------------------------------------------------------------
  // STEP 1: CLASSI (NON ARCHETIPO)
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
        <div id="coverflow-card-${idx}" onclick="Rules2Wizard.coverflowSelectIndex(${idx})" class="coverflow-card">
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

            <!-- RIGA BIANCA SPECULARE AL FOOTER -->
            <div class="coverflow-header-divider"></div>

            <div class="watermark-cover-banner">
              <div class="quote-text">“${cleanQuote}”</div>
              <div class="quote-author">${cls.autoreCitazione || 'Darsena'}</div>
            </div>
          </div>

          <div id="coverflow-details-${idx}" class="coverflow-details-box">
            <!-- TRITTICO KPI UNIFORMI (11px MONO) -->
            <div class="coverflow-stats-row">
              <div>🥊 FOR <b>${forVal}</b></div>
              <div>🤸 DES <b>${desVal}</b></div>
              <div>🧠 INT <b>${intVal}</b></div>
            </div>

            <p class="coverflow-lore">${cls.testo || cls.descrizione || ''}</p>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label truncate">
                🎒 Dotazione: <b>${cls.equipLoot || 'Pugni nudi'}</b>
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

    this.bindGestures(stage);
    this.updateCoverflowStage();
  },

  bindGestures: function(stageEl) {
    if (!stageEl || stageEl._hasGestures) return;
    stageEl._hasGestures = true;

    // 1. Swipe Touch Smartphone
    stageEl.addEventListener("touchstart", (e) => {
      this.stopAutoplay();
      this.state._touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    stageEl.addEventListener("touchend", (e) => {
      const diff = this.state._touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 35) {
        if (diff > 0) this.coverflowNext();
        else this.coverflowPrev();
      }
    }, { passive: true });

    // 2. Trackpad / Mouse Wheel Orizzontale (Laptop)
    stageEl.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > 25) {
        this.stopAutoplay();
        if (e.deltaX > 0) this.coverflowNext();
        else this.coverflowPrev();
      }
    }, { passive: true });

    // 3. Frecce Tastiera Desktop
    window.addEventListener("keydown", (e) => {
      if (this.state.step !== 1) return;
      if (e.key === "ArrowRight") this.coverflowNext();
      else if (e.key === "ArrowLeft") this.coverflowPrev();
    });
  },

  updateCoverflowStage: function() {
    const classes = this.state.classes || [];
    const total = classes.length;
    if (total === 0) return;

    const activeIdx = this.state.activeClassIndex;
    const spacing = window.innerWidth >= 768 ? 210 : 155;

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
    this.state.startingGold = Number(classes[activeIdx].oro || 40);
    this.state.currentGold = this.state.startingGold;

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

  confirmStep1: function() {
    this.stopAutoplay();
    if (!this.state.chosenClass) return tgAlert("Scegli una classe!");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("success");
    this.renderStep2();
    this.showStep(2);
  },

  renderClassesList: function() {
    const container = document.getElementById("wizard-classes-list-container");
    if (!container) return;

    const classes = this.state.classes || [];
    container.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.chosenClass?.id === cls.id);
      const pol = String(cls.sottocategoria || "Destra").toUpperCase();

      return `
        <div onclick="Rules2Wizard.selectClassByIndex(${idx})" class="class-list-card ${isSelected ? 'selected' : ''}">
          <div class="flex items-center space-x-3 min-w-0 flex-1">
            <div class="class-list-thumb">
              <img src="${cls.mediaUrl}" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            </div>
            <div class="class-list-info">
              <div class="class-list-name">${cls.emoji || '🥋'} ${cls.nome}</div>
              <div class="class-list-sub">
                <span class="${pol === 'DESTRA' ? 'text-sky-400' : 'text-rose-400'} font-bold">${pol}</span> • ❤️ ${cls.pv} PV • 🟡 ${cls.oro} ORO
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-xs ${isSelected ? 'btn-success font-black' : 'btn-outline border-white/20 text-slate-300'}">
              ${isSelected ? 'Scelto' : 'Scegli'}
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  selectClassByIndex: function(idx) {
    this.state.activeClassIndex = idx;
    this.state.chosenClass = this.state.classes[idx];
    this.state.startingGold = Number(this.state.chosenClass.oro || 40);
    this.state.currentGold = this.state.startingGold;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
    this.renderClassesList();
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ (NESSUN FASCICOLO, PERK DIRETTI E CHIARI)
  // --------------------------------------------------------------------------
  renderStep2: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    const budgetBadge = document.getElementById("wizard-px-budget");
    if (!grid) return;

    if (budgetBadge) budgetBadge.textContent = `✨ ${this.state.remainingPx} PX`;
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
            <span class="badge badge-sm ${isSelected ? 'badge-primary font-black' : (isCompatible ? 'badge-ghost' : 'badge-neutral')}">
              ${isSelected ? 'ATTIVO ✓' : (isCompatible ? '100 PX' : '🔒')}
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
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("success");
    this.renderStep3();
    this.showStep(3);
  },

  // --------------------------------------------------------------------------
  // STEP 3: CICCIO & CO. (CHIUSURA AUTOMATICA SCHEDA SU ACQUISTO)
  // --------------------------------------------------------------------------
  renderStep3: function() {
    this.filterShop(this.state.shopCategory || "ARMI");
  },

  filterShop: function(cat) {
    this.state.shopCategory = cat;
    const goldDisp = document.getElementById("wizard-shop-gold-display");
    if (goldDisp) goldDisp.textContent = `🟡 ${this.state.currentGold} ORO`;

    const container = document.getElementById("wizard-shop-grid");
    if (!container) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === cat);
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

    // CHIUSURA AUTOMATICA DELLA SCHEDA ALL'ACQUISTO
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
  // STEP 4: LANCIA IL TUO EROE (CARD MONUMENTALE & MODALE NOME)
  // --------------------------------------------------------------------------
  renderStep4: function() {
    const cls = this.state.chosenClass;
    if (!cls) return;

    const pol = String(cls.sottocategoria || 'Destra').toLowerCase();
    const heroName = this.state.heroName || AppState.user?.nome || "Avventuriero";
    const startingGear = cls.equipLoot || "Pugni nudi";
    const bought = this.state.boughtItems.map(i => i.nome).join(", ");
    const fullInv = [startingGear, bought].filter(Boolean).join(", ");

    const container = document.getElementById("wizard-step-name");
    if (!container) return;

    container.innerHTML = `
      <div class="hero-launch-stage">
        <div class="hero-launch-card">
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
              <p>⚡ <b>Abilità:</b> ${this.state.chosenAbilities.length > 0 ? this.state.chosenAbilities.join(', ') : 'Nessuna'}</p>
              <p class="mt-1">🎒 <b>Dotazione:</b> ${fullInv}</p>
            </div>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label">Status: <b>Pronto</b></span>
              <div class="coverflow-kpi-pill">
                <span class="pill-pv">❤️ ${cls.pv || 25} PV</span>
                <span class="pill-gold">🟡 ${this.state.currentGold} ORO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODALE MODIFICA NOME EROE -->
      <dialog id="modal-hero-name" class="modal">
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
      avatarUrl: this.state.chosenClass?.mediaUrl || ""
    };

    Rules2Engine.executeStartGame(payload, payload.avatarUrl);
  },

  nextStep: function(s) {
    if (s === 4) this.renderStep4();
    this.showStep(s);
  },
  prevStep: function(s) {
    this.showStep(s);
  }
};

// ----------------------------------------------------------------------------
// 4. ENGINE RULES2: COCKPIT GAMEPLAY, ANTI-SPAM LOCK & CASSETTI TATTICI
// ----------------------------------------------------------------------------
const Rules2Engine = {
  _isBusy: false,

  _setBusy: function(flag) {
    this._isBusy = flag;
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;
    const btns = actBox.querySelectorAll("button");
    btns.forEach(b => {
      if (flag) {
        b.setAttribute("disabled", "true");
        b.classList.add("opacity-50", "pointer-events-none");
      } else {
        b.removeAttribute("disabled");
        b.classList.remove("opacity-50", "pointer-events-none");
      }
    });
  },

  // Flusso Cabinato: Modal "INSERT MEGOIN 🪙" & Gestione Partita Attiva
  launchSession: function(gameKey, epNum, canContinueFree, savedHero) {
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === gameKey);
    const modal = document.getElementById("modal-insert-megoin");
    if (!modal) return Rules2Wizard.open(gameKey, epNum, canContinueFree, savedHero);

    const activeBox = document.getElementById("arcade-active-game-box");
    const insertBox = document.getElementById("arcade-insert-coin-box");

    // MODALE AVVIO PARTITA: TASTI AFFIANCATI 50/50 [ NUOVA ] [ RIPRENDI ]
    if (saga && saga.hasActiveGame && saga.activePartitaId) {
      if (activeBox) activeBox.classList.remove("hidden");
      if (insertBox) insertBox.classList.add("hidden");

      activeBox.innerHTML = `
        <h3 class="arcade-title">${saga.serie || 'AVVENTURA'}</h3>
        <p class="arcade-subtitle">Partita attiva in corso (ID: ${saga.activePartitaId})</p>
        <div class="arcade-actions-50-50">
          <button id="btn-arcade-new" class="btn btn-outline border-amber-500/40 text-amber-300">🪙 Nuova</button>
          <button id="btn-arcade-resume" class="btn btn-success text-slate-950 font-black">▶️ Riprendi</button>
        </div>
      `;

      document.getElementById("btn-arcade-resume").onclick = () => {
        modal.close();
        const activeFase = saga.activeFase || saga.fase || "IN_GIOCO";
        if (activeFase.startsWith("WIZARD_")) {
          Rules2Wizard.resumeSession(gameKey, saga.activeEpisodio || epNum, saga);
        } else {
          AppState.activeSession.engineKey = "Rules2";
          AppState.activeSession.gameKey = gameKey;
          AppState.activeSession.episodio = saga.activeEpisodio || epNum;
          AppState.activeSession.partitaId = saga.activePartitaId;
          AppRouter.navigate("view-gameplay");
          this.advanceToNode(saga.activeNode || `SND_0001_S1_E${epNum}`);
        }
      };

      document.getElementById("btn-arcade-new").onclick = () => {
        if (activeBox) activeBox.classList.add("hidden");
        if (insertBox) insertBox.classList.remove("hidden");
        this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
      };
    } else {
      if (activeBox) activeBox.classList.add("hidden");
      if (insertBox) insertBox.classList.remove("hidden");
      this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
    }

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    modal.showModal();
  },

  _setupArcadeCoinScreen: function(gameKey, epNum, canContinueFree, savedHero, modal) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const userBalance = Wallet.getMegoin();

    s("arcade-user-balance", userBalance);

    if (canContinueFree || (savedHero && epNum > 1)) {
      s("arcade-coin-title", "VETERANO");
      s("arcade-coin-desc", `Prosegui con l'Eroe veterano "${savedHero ? (savedHero.nomeEroe || savedHero.classe) : 'In Memoria'}".`);
      s("arcade-cost-badge", "GRATIS");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "🎖️ Continua";
        btnLaunch.onclick = () => {
          modal.close();
          Rules2Wizard.open(gameKey, epNum, true, savedHero);
        };
      }
    } else {
      s("arcade-coin-title", "INSERT MEGOIN");
      s("arcade-coin-desc", "1 Megoin per creare un nuovo eroe.");
      s("arcade-cost-badge", "1 🪙");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "🕹️ Inizia";
        btnLaunch.onclick = () => {
          if (userBalance < 1) {
            tgHaptic("error");
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
            return tgAlert("⚠️ Megoin insufficienti!");
          }
          modal.close();
          Rules2Wizard.open(gameKey, epNum, false, null);
        };
      }
    }
  },

  executeStartGame: async function(payloadParams, avatarUrl = "") {
    try {
      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playSfx("insert_coin");
        SoundEngine.playEpisodeBgm(payloadParams.gameKey, payloadParams.episodio, "explore");
      }

      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        const wizardCatalog = (Rules2Wizard.state.shopCatalog || []);
        const allGameItems = typeof deduplicateEntities === "function" ? deduplicateEntities([
          ...(res.emporioItems || []),
          ...(res.equipaggiamenti || []),
          ...wizardCatalog
        ]) : (res.emporioItems || []);

        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = payloadParams.gameKey;
        AppState.activeSession.episodio = payloadParams.episodio;
        AppState.activeSession.partitaId = res.partitaId;

        AppState.activeSession.hero = {
          ...res.statoEroe,
          mediaUrl: avatarUrl || res.statoEroe?.mediaUrl || ""
        };

        AppState.activeSession.currentNode = res.nodoIniziale;
        AppState.activeSession.shopCatalog = allGameItems;
        AppState.activeSession.combatRound = 1;
        AppState.activeSession.combatEnemyId = null;
        AppState.activeSession.engineState = {
          pendingVictory: null,
          backpackFilter: "ALL",
          emporioMode: "buy"
        };

        if (res.nuovoSaldoMegoin !== undefined) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
        }
        if (typeof AppModules !== "undefined") {
          AppModules.renderProfile(AppState.user);
        }

        this.renderNode(res.nodoIniziale, AppState.activeSession.hero);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      console.error("[Rules2Engine] Errore avvio partita:", err);
      tgAlert("Errore avvio: " + err.message);
    }
  },

  renderNode: function(node, hero) {
    this._setBusy(false);

    if (node) AppState.activeSession.currentNode = node;
    if (hero) {
      AppState.activeSession.hero = { ...AppState.activeSession.hero, ...hero };
      Wallet.setGold(hero.oro || 0);
    }

    const currentNode = AppState.activeSession.currentNode;
    const currentHero = AppState.activeSession.hero;
    if (!currentNode) return;

    // MONITOR BATTITO CARDIACO IN CASO DI BASSA SALUTE (PV <= 25%)
    if (currentHero && currentHero.pvMax) {
      const pvRatio = (currentHero.pv || 0) / currentHero.pvMax;
      if (pvRatio <= 0.25 && currentHero.pv > 0) {
        if (typeof SoundEngine !== "undefined") SoundEngine.startHeartbeat();
      } else {
        if (typeof SoundEngine !== "undefined") SoundEngine.stopHeartbeat();
      }
    }

    const isDefeat = (currentHero && currentHero.pv <= 0) || (currentNode.categoria === "Fine" && currentNode.sottocategoria === "morte");
    const isVictory = (String(currentNode.id).includes("SND_END") || currentNode.sottocategoria === "gancio");
    const actBox = document.getElementById("scene-actions-container");

    // 1. CASO MORTE: 2 TASTI AFFIANCATI 50/50 [ RETRY ] [ ESCI ]
    if (isDefeat) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.stopHeartbeat();
        SoundEngine.playSfx("zelda_death");
        SoundEngine.playBgm("defeat");
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="arcade-actions-50-50">
            <button onclick="Rules2Engine.launchSession('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="btn btn-warning font-black">
              🔄 Retry
            </button>
            <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-outline border-white/20 text-white font-bold">
              🚪 Esci
            </button>
          </div>
        `;
      }
      return;
    }

    // 2. CASO VITTORIA: 2 TASTI AFFIANCATI 50/50 [ RETRY GRATIS ] [ AVANZA ]
    if (isVictory) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.stopHeartbeat();
        SoundEngine.playSfx("lucky");
        SoundEngine.playBgm("victory");
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="arcade-actions-50-50">
            <button onclick="Rules2Wizard.open('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="btn btn-outline border-emerald-400 text-emerald-300 font-bold">
              🔄 Rigioca
            </button>
            <button onclick="Rules2Wizard.open('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio + 1}, true, AppState.activeSession.hero)" class="btn btn-success text-slate-950 font-black">
              ➡️ Avanza
            </button>
          </div>
        `;
      }
      return;
    }

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === AppState.activeSession.gameKey);
    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    if (currentHero) {
      const avatarImg = document.getElementById("kpi-hero-avatar-img");
      const avatarFallback = document.getElementById("kpi-hero-avatar-fallback");
      const media = currentHero.mediaUrl;

      if (avatarImg && avatarFallback) {
        if (media && media !== "—" && media.startsWith("http")) {
          avatarImg.src = media;
          avatarImg.classList.remove("hidden");
          avatarFallback.classList.add("hidden");
        } else {
          avatarImg.classList.add("hidden");
          avatarFallback.classList.remove("hidden");
        }
      }

      s("kpi-hero-name", currentHero.nomeEroe || "Avventuriero");
      s("kpi-hero-gold", currentHero.oro || 0);

      s("kpi-hero-pv-text", `${currentHero.pv || 0}/${currentHero.pvMax || 25}`);
      const pvBar = document.getElementById("kpi-hero-pv-bar");
      if (pvBar) {
        pvBar.value = currentHero.pv || 0;
        pvBar.max = currentHero.pvMax || 25;
      }

      if (currentHero.modificatori) {
        s("kpi-mod-for", (currentHero.modificatori.FORZA >= 0 ? "+" : "") + currentHero.modificatori.FORZA);
        s("kpi-mod-des", (currentHero.modificatori.DESTREZZA >= 0 ? "+" : "") + currentHero.modificatori.DESTREZZA);
        s("kpi-mod-int", (currentHero.modificatori.INTELLIGENZA >= 0 ? "+" : "") + currentHero.modificatori.INTELLIGENZA);
      }
    }

    const img = document.getElementById("scene-image");
    if (img) {
      img.src = currentNode.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=450&nologo=true";
    }

    s("scene-type-badge", currentNode.tipo || "SNODO");
    s("scene-title", currentNode.nome || "Avventura");

    let cleanText = (currentNode.testo || "").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
    s("scene-text", cleanText);

    const wBanner = document.getElementById("scene-watermark-banner");
    if (currentNode.citazione && currentNode.citazione !== "—" && currentNode.citazione !== "-") {
      s("scene-quote", `“${currentNode.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”`);
      s("scene-author", currentNode.autoreCitazione || "");
      if (wBanner) wBanner.classList.remove("hidden");
    } else {
      if (wBanner) wBanner.classList.add("hidden");
    }

    if (!actBox) return;

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));
    const isBoss = isCombat && (String(currentNode.id).includes("BOSS") || String(currentNode.sottocategoria || "").toUpperCase().includes("BOSS"));
    const isEvento = (currentNode.tipo === "EVENTO" || (currentNode.id && currentNode.id.includes("EVT_")));

    // CASO COMBATTIMENTO
    if (isCombat) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playEpisodeBgm(AppState.activeSession.gameKey, AppState.activeSession.episodio, isBoss ? "boss" : "combat");
      }

      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(isBoss ? "shock" : "hit");
      }

      let bribeHtml = "";
      if (currentNode.corruption?.canCorrupt && currentNode.corruption.validDrugs?.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${Rules2_SafeAttr(d.nome)}')" class="btn btn-sm btn-block btn-warning font-black uppercase">
            💊 Cedi ${Rules2_SafeAttr(d.nome.split(" ")[0])}
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="combat-actions-grid">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="btn btn-sm btn-error font-black btn-combat-attack">
            ⚔️ Attacca
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 btn-combat-flee">
            🏃 Fuggi
          </button>
        </div>
        ${bribeHtml}
        <div class="pt-0.5">
          <button onclick="Rules2Engine.inspectCurrentEnemyDetail()" class="btn btn-xs btn-block btn-ghost btn-inspect-enemy font-black">
            🔍 Fascicolo
          </button>
        </div>
      `;
      return;
    }

    // GESTIONE BGM ESPLORAZIONE
    if (typeof SoundEngine !== "undefined") {
      SoundEngine.playEpisodeBgm(AppState.activeSession.gameKey, AppState.activeSession.episodio, "explore");
    }

    // CASO EVENTO D20
    if (isEvento) {
      const statReq = currentNode.statRichiesta || "DESTREZZA";
      const shortStat = statReq.substring(0, 3).toUpperCase();
      const cdVal = currentNode.difficolta || 11;
      const bypassTool = currentNode.equipLoot || currentNode.requisitoBypass;
      const hasTool = bypassTool && (currentHero?.inventario || []).some(it => it.toLowerCase().includes(bypassTool.toLowerCase()));

      if (hasTool) {
        actBox.innerHTML = `
          <div class="tactical-advantage-box">
            <div class="text-[10px] font-bold text-emerald-300">🛡️ Vantaggio Tattico: possiedi ${bypassTool}!</div>
          </div>
          <button onclick="Rules2Engine.advanceToNode('${currentNode.destSuccesso}')" class="btn btn-sm btn-block btn-success font-black h-11 uppercase">
            ⚡ Oltrepassa
          </button>
        `;
      } else {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="btn btn-sm btn-primary font-black h-11 uppercase">
              🎲 Prova ${shortStat}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="btn btn-sm btn-outline border-white/20 h-11 font-black uppercase">
              🏃 Evita
            </button>
          </div>
        `;
      }
      return;
    }

    // CASO ENIGMA
    if (currentNode.quiz) {
      actBox.innerHTML = `
        <div class="quiz-box">
          <div class="quiz-question">
            <span>🔐</span> <span>${currentNode.quiz.domanda}</span>
          </div>
          <div class="quiz-options-grid">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${Rules2_SafeAttr(opz)}')" class="btn btn-sm btn-outline border-white/20 text-[11px] font-bold truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // CASO BIVIO STANDARD
    const choices = (currentNode.choices || currentNode.parsedBivio || []).map(c => ({
      testo: c.testo || c.text || c.nome || "Avanza",
      target: c.target || c.id || c.nodo || ""
    })).filter(c => c.target !== "");

    if (choices.length > 0) {
      if (choices.length === 2) {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.advanceToNode('${choices[0].target}')" class="btn btn-sm btn-primary font-black truncate h-11 uppercase">
              ${choices[0].testo}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${choices[1].target}')" class="btn btn-sm btn-primary font-black truncate h-11 uppercase">
              ${choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = choices.map(c => `
          <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary font-black mb-1.5 truncate h-11 uppercase">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-sm btn-block btn-outline border-white/20 font-black h-11 uppercase">
          🏁 Esci
        </button>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");

    try {
      const res = await apiCall("game_node", {
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio,
        nodeId: targetId,
        partitaId: AppState.activeSession.partitaId
      });
      if (res?.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      } else {
        this._setBusy(false);
      }
    } catch (e) {
      this._setBusy(false);
      console.error("[Rules2Engine] Errore advanceToNode:", e);
      tgAlert("Errore avanzamento: " + e.message);
    }
  },

  showDiceRollSuspense: function(title, desc, durationMs, onComplete) {
    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("dice-roll-title", title || "Lancio D20...");
    s("dice-roll-result", "--");
    s("dice-roll-desc", desc || "Il fato decide...");

    if (diceCube) diceCube.classList.add("dice-rolling");
    if (diceModal) diceModal.showModal();

    if (typeof SoundEngine !== "undefined") {
      SoundEngine.duck(0.08, (durationMs || 700) + 400);
      SoundEngine.playSfx("dice");
    }

    setTimeout(() => {
      if (diceCube) diceCube.classList.remove("dice-rolling");
      if (typeof onComplete === "function") {
        onComplete(diceModal, s);
      } else {
        if (diceModal) diceModal.close();
      }
    }, durationMs || 700);
  },

  executeEventRoll: async function(nodeId, statName, cdVal) {
    if (this._isBusy) return;
    this._setBusy(true);

    const hero = AppState.activeSession.hero;
    const statMod = hero?.modificatori ? (hero.modificatori[statName] || 0) : 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + statMod;
    const isSuccess = (d20 === 20) || (d20 !== 1 && total >= cdVal);

    this.showDiceRollSuspense(`Prova ${statName} vs CD ${cdVal}`, `D20 (${d20}) ${statMod >= 0 ? '+' : ''}${statMod} = ${total}`, 750, (modal, s) => {
      s("dice-roll-result", `${total} • ${isSuccess ? 'SUPERATO!' : 'FALLITO!'}`);
      s("dice-roll-desc", isSuccess ? 'Ostacolo superato!' : 'Danni subiti!');

      if (typeof SoundEngine !== "undefined") {
        if (isSuccess) SoundEngine.playSfx(d20 === 20 ? "lucky" : "success");
        else SoundEngine.playSfx(d20 === 1 ? "unlucky" : "hurt");
      }

      setTimeout(() => {
        modal.close();
        const node = AppState.activeSession.currentNode;
        if (isSuccess) {
          tgHaptic("success");
          this.showFloatingDamage(d20 === 20 ? "🌟 CRITICO!" : "✅ Superato!", d20 === 20, false);
          this.advanceToNode(node.destSuccesso);
        } else {
          tgHaptic("error");
          this.showFloatingDamage(d20 === 1 ? "💀 FUMBLE!" : "❌ Fallito!", false, true);
          this.advanceToNode(node.destFallback || node.destFallimento);
        }
      }, 650);
    });
  },

  combatAction: async function(subAction) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const curRound = AppState.activeSession.combatRound || 1;

    if (subAction === "attack_round") {
      s("dice-roll-title", `Attacco • Round ${curRound}`);
      s("dice-roll-result", "--");
      s("dice-roll-desc", "Tiro di attacco...");
      if (diceCube) diceCube.classList.add("dice-rolling");
      if (diceModal) diceModal.showModal();

      if (typeof SoundEngine !== "undefined") {
        SoundEngine.duck(0.08, 900);
        SoundEngine.playSfx("dice");
      }
    } else if (subAction === "flee") {
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("flee");
    }

    try {
      const res = await apiCall("game_action", {
        subAction: subAction,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (subAction === "attack_round") {
        const log = res.combatLog;
        if (diceCube) diceCube.classList.remove("dice-rolling");

        if (log) {
          s("dice-roll-result", `D20 (${log.d20Hero}) = ${log.totHero} vs CD ${log.cdTarget}`);
          s("dice-roll-desc", log.isHit ? (log.isCrit ? "CRITICO!" : `COLPITO! -${log.dmgDealt} PV`) : "A VUOTO!");
        } else {
          s("dice-roll-result", res.status === "VICTORY" ? "VITTORIA!" : "FINE SCONTRO");
        }

        setTimeout(() => {
          if (diceModal) diceModal.close();

          if (log) {
            if (log.isHit) {
              tgHaptic(log.isCrit ? "success" : "light");
              this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
              if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(log.isCrit ? "crit_hit" : "hit");
            } else {
              this.showFloatingDamage("💨 A vuoto", false, false);
              if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("flee");
            }

            if (log.dmgTaken > 0) {
              setTimeout(() => {
                tgHaptic("error");
                this.showFloatingDamage(`💔 -${log.dmgTaken} PV Squadra`, false, true);
                if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("hurt");
              }, 250);
            }
          }

          if (res.status === "VICTORY") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") {
              SoundEngine.stopHeartbeat();
              SoundEngine.playSfx("lucky");
              SoundEngine.playBgm("victory");
            }
            if (window.confetti) confetti({ particleCount: 75, spread: 60 });

            const hero = AppState.activeSession.hero;
            const hasNecroAbl = (hero?.abilita?.includes("Necromanzia") && hero.pv > 1);
            AppState.activeSession.engineState.pendingVictory = res.nextView;

            if (hasNecroAbl && !res.victoryData?.chainInfected) {
              this.renderNecromancyPrompt(res.victoryData.enemy);
            } else {
              this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
            }
          } else if (res.status === "DEFEAT") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") {
              SoundEngine.stopHeartbeat();
              SoundEngine.playSfx("zelda_death");
              SoundEngine.playBgm("defeat");
            }
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          } else {
            AppState.activeSession.combatRound = (log ? log.round + 1 : curRound + 1);
            this.renderNode(res.nodo, res.statoEroe);
          }
        }, 700);
      } else {
        if (diceModal) diceModal.close();
        if (res.nextView) this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
        else if (res.nodo) this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      if (diceModal) diceModal.close();
      this._setBusy(false);
      console.error("[Rules2Engine] Errore combatAction:", e);
      tgAlert("Errore azione: " + e.message);
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    this._setBusy(false);
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("evil_laugh");

    actBox.innerHTML = `
      <div class="necromancy-prompt-box">
        <div class="font-black text-purple-300">🧟 RIANIMAZIONE DISPONIBILE</div>
        <div class="text-[10px] text-slate-300">Rianima <b>${deadEnemy ? deadEnemy.nome : 'nemico'}</b> come Zombi (Danno x2).</div>
        <div class="combat-actions-grid pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="btn btn-sm btn-secondary font-black uppercase">
            🧟 Rianima
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="btn btn-sm btn-outline border-white/20 text-slate-300 font-bold uppercase">
            Prosegui
          </button>
        </div>
      </div>
    `;
  },

  executeResurrectZombie: async function(enemyId) {
    if (this._isBusy) return;
    this._setBusy(true);

    try {
      const res = await apiCall("game_action", {
        subAction: "resurrect_zombie",
        targetId: enemyId,
        method: "ABILITA",
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("zombie");
        this.showFloatingDamage("🧟 Risorto!", false, false);
        if (AppState.activeSession.engineState?.pendingVictory) {
          this.renderNode(AppState.activeSession.engineState.pendingVictory.nodo, res.statoEroe);
          AppState.activeSession.engineState.pendingVictory = null;
        }
      }
    } catch (e) {
      tgAlert("Rianimazione fallita: " + e.message);
      this.skipNecromancy();
    }
  },

  skipNecromancy: function() {
    if (AppState.activeSession.engineState?.pendingVictory) {
      const next = AppState.activeSession.engineState.pendingVictory;
      this.renderNode(next.nodo, next.statoEroe);
      AppState.activeSession.engineState.pendingVictory = null;
    }
  },

  combatBribe: async function(drugName) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    try {
      const res = await apiCall("game_action", {
        subAction: "bribe",
        drug: drugName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("bribe");
        this.showFloatingDamage("🟡 Corrotto!", false, false);
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      }
    } catch (e) {
      this._setBusy(false);
      tgAlert("Corruzione fallita: " + e.message);
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    const box = document.getElementById("floating-damage-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `floating-damage ${isHeroDmg ? 'text-glow-rose' : (isCrit ? 'text-glow-amber' : '')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  submitQuizAnswer: function(selectedOpz) {
    if (this._isBusy) return;
    const node = AppState.activeSession.currentNode;
    if (!node?.quiz) return;

    this._setBusy(true);
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaCorretta?.trim().toLowerCase());
    if (isCorrect) {
      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("lucky");
      this.showFloatingDamage("✅ Esatto!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      this.showFloatingDamage("❌ Errato!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // --------------------------------------------------------------------------
  // 5. DEEP INSPECTION UNIVERSALE & I 5 CASSETTI COCKPIT
  // --------------------------------------------------------------------------
  inspectCurrentEnemyDetail: function() {
    const enemy = AppState.activeSession.currentNode;
    if (!enemy) return;

    this.inspectEntityDetail({
      id: enemy.id,
      nome: enemy.nome,
      tipo: "NEMICO",
      categoria: enemy.categoria || "Mazzu",
      sottocategoria: enemy.sottocategoria || "Soldato",
      pv: enemy.pv,
      danno: enemy.danno,
      forza: enemy.forza,
      destrezza: enemy.destrezza,
      intelligenza: enemy.intelligenza,
      difficolta: enemy.difficolta,
      statRichiesta: enemy.statRichiesta,
      debolezze: enemy.debolezze,
      descrizione: enemy.testo,
      citazione: enemy.citazione,
      autoreCitazione: enemy.autoreCitazione,
      mediaUrl: enemy.mediaUrl,
      isEnemyInspection: true
    });
  },

  inspectEntityDetail: function(it) {
    if (!it) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    s("uni-detail-icon", it.emoji || (it.tipo === "NEMICO" ? "👾" : "📦"));
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `${(it.tipo || 'EQUIPAGGIAMENTO').toUpperCase()} • ${(it.categoria || 'GENERALE').toUpperCase()}`);
    s("uni-detail-metrics-label", it.tipo === "NEMICO" ? "PARAMETRI BELLICI" : "PARAMETRI");

    const bonuses = [];
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv}</b>`);
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.forza) bonuses.push(`🥊 FOR: <b>${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 DES: <b>${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 INT: <b>${it.intelligenza}</b>`);
    if (it.difficolta) bonuses.push(`🎯 Sfida: <b>${it.statRichiesta || 'FORZA'} (CD ${it.difficolta})</b>`);
    if (it.costoOro) bonuses.push(`💰 Prezzo: <b class="text-amber-300">${it.costoOro} 🟡</b>`);

    let humanProps = Rules2_FormatHumanEffect(it.requisitiCodificati || it.effettoCodificato || it.debolezze || "");
    h("uni-detail-metrics-value", bonuses.join(" • ") + (humanProps ? "<br>" + humanProps : ""));

    let cleanLore = (it.descrizione || it.testo || "Nessun fascicolo allegato.").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
    s("uni-detail-lore", cleanLore);

    const mediaContainer = document.getElementById("uni-detail-media-container");
    if (mediaContainer) {
      if (it.mediaUrl && it.mediaUrl !== "—" && it.mediaUrl.startsWith("http")) {
        document.getElementById("uni-detail-img").src = it.mediaUrl;
        mediaContainer.classList.remove("hidden");
      } else {
        mediaContainer.classList.add("hidden");
      }
    }

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (it.isEnemyInspection) {
        btn.textContent = "Torna";
        btn.className = "btn btn-primary btn-sm w-full font-black uppercase";
        btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
      } else if (it.isFromBackpack) {
        const cat = Rules2_ClassifyEntity(it);
        const isArma = cat === "ARMI";
        const isVeicolo = cat === "VEICOLI";
        const isConsumabile = (cat === "CURE" || cat === "DROGHE");

        if (isConsumabile) {
          btn.textContent = (cat === "DROGHE") ? "Assumi" : "Usa";
          btn.className = "btn btn-success btn-sm w-full font-black uppercase";
          btn.onclick = () => {
            this.useBackpackItem(it.nome);
            document.getElementById("modal-universal-detail")?.close();
          };
        } else if (isArma) {
          btn.textContent = "Impugna";
          btn.className = "btn btn-primary btn-sm w-full font-black uppercase";
          btn.onclick = () => {
            this.equipItem(it.nome, "weapon");
            document.getElementById("modal-universal-detail")?.close();
          };
        } else if (isVeicolo) {
          btn.textContent = "Guida";
          btn.className = "btn btn-primary btn-sm w-full font-black uppercase";
          btn.onclick = () => {
            this.equipItem(it.nome, "vehicle");
            document.getElementById("modal-universal-detail")?.close();
          };
        } else {
          btn.textContent = "Chiudi";
          btn.className = "btn btn-ghost btn-sm w-full text-slate-400 font-bold uppercase";
          btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
        }
      } else {
        btn.textContent = "Chiudi";
        btn.className = "btn btn-ghost btn-sm w-full text-slate-400 font-bold uppercase";
        btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
      }
    }

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-universal-detail")?.showModal();
  },

  // 1. CASSETTO SCHEDA EROE
  openHeroSheetDrawer: function() {
    const h = AppState.activeSession.hero;
    if (!h) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("sheet-hero-name", h.nomeEroe || "Avventuriero");
    s("sheet-hero-class", `${h.classe || "Avventuriero"} (${h.schieramentoPolitico || "Destra"})`);
    s("sheet-hero-gold", `${h.oro || 0} 🟡`);

    const sheetAvatarImg = document.getElementById("sheet-hero-avatar-img");
    const sheetAvatarFallback = document.getElementById("sheet-hero-avatar-fallback");
    if (sheetAvatarImg && sheetAvatarFallback) {
      if (h.mediaUrl && h.mediaUrl !== "—" && h.mediaUrl.startsWith("http")) {
        sheetAvatarImg.src = h.mediaUrl;
        sheetAvatarImg.classList.remove("hidden");
        sheetAvatarFallback.classList.add("hidden");
      } else {
        sheetAvatarImg.classList.add("hidden");
        sheetAvatarFallback.classList.remove("hidden");
      }
    }

    const stats = h.stats || { FORZA: 10, DESTREZZA: 10, INTELLIGENZA: 10 };
    const mods = h.modificatori || { FORZA: 0, DESTREZZA: 0, INTELLIGENZA: 0 };

    s("sheet-pure-for", stats.FORZA || 10);
    s("sheet-pure-des", stats.DESTREZZA || 10);
    s("sheet-pure-int", stats.INTELLIGENZA || 10);

    s("sheet-mod-for", (mods.FORZA >= 0 ? "+" : "") + mods.FORZA);
    s("sheet-mod-des", (mods.DESTREZZA >= 0 ? "+" : "") + mods.DESTREZZA);
    s("sheet-mod-int", (mods.INTELLIGENZA >= 0 ? "+" : "") + mods.INTELLIGENZA);

    s("sheet-active-weapon", h.armaAttiva || "Pugni nudi");
    s("sheet-active-vehicle", h.veicoloAttivo || "A piedi");

    const ablsBox = document.getElementById("sheet-abilities-list");
    if (ablsBox) {
      const list = h.abilita || [];
      ablsBox.innerHTML = list.length > 0
        ? list.map(a => `<span class="badge badge-sm badge-info font-bold mr-1 mb-1">⚡ ${a}</span>`).join("")
        : "Nessun talento attivo.";
    }

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("drawer-hero-sheet")?.showModal();
  },

  // 2. CASSETTO ZAINO EROE
  openBackpackDrawer: function() {
    this.filterBackpack(AppState.activeSession.engineState?.backpackFilter || "ALL");
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("drawer-backpack")?.showModal();
  },

  _findEntityData: function(itemName) {
    if (!itemName) return null;
    const catalog = AppState.activeSession.shopCatalog || [];
    const clean = String(itemName).trim().toLowerCase();
    const found = catalog.find(x => String(x.nome || "").trim().toLowerCase() === clean || String(x.id || "").trim().toLowerCase() === clean);
    if (found) return found;

    return { nome: itemName, categoria: Rules2_ClassifyEntity({ nome: itemName }) };
  },

  filterBackpack: function(cat) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
    AppState.activeSession.engineState.backpackFilter = cat || "ALL";

    const tabsContainer = document.getElementById("backpack-tabs");
    if (tabsContainer) {
      tabsContainer.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const btnText = btn.textContent.toUpperCase();
        const isMatch = (cat === "ALL" && btnText.includes("TUTTI")) || btnText.includes(cat);
        btn.className = `rpg-category-chip badge ${isMatch ? 'badge-info active' : 'badge-ghost'}`;
      });
    }

    const c = document.getElementById("backpack-slots-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let inv = h.inventario || [];
    if (inv.length === 0) {
      c.innerHTML = `<div class="empty-state-card">Zaino vuoto.</div>`;
      return;
    }

    if (cat && cat !== "ALL") {
      inv = inv.filter(itemName => {
        const ent = this._findEntityData(itemName);
        return Rules2_ClassifyEntity(ent) === cat;
      });
      if (inv.length === 0) {
        c.innerHTML = `<div class="empty-state-card">Nessun articolo per <b>${cat}</b>.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const ent = this._findEntityData(it);
      const category = Rules2_ClassifyEntity(ent);

      return `
        <div class="backpack-slot-card">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="slot-info-clickable">
            <div class="slot-name">${it}</div>
            <div class="slot-tag ${isArma || isVeicolo ? 'active-gear' : ''}">
              ${isArma ? '🗡️ [IN PUGNO]' : (isVeicolo ? '🛴 [IN USO]' : category)}
            </div>
          </div>
          <button onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="btn btn-xs btn-outline border-white/20 text-slate-300 font-bold">
            Fascicolo
          </button>
        </div>
      `;
    }).join("");
  },

  equipItem: async function(itemName, type) {
    if (!AppState.activeSession.gameKey) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "equip",
        item: itemName,
        type: type,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("selection");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        this.filterBackpack(AppState.activeSession.engineState.backpackFilter);
      }
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  useBackpackItem: async function(itemName) {
    if (!AppState.activeSession.gameKey) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "use_item",
        item: itemName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        this.filterBackpack(AppState.activeSession.engineState.backpackFilter);
      }
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  // 3. CASSETTO EMPORIO DI CICCIO & CO.
  openEmporioDrawer: function() {
    const h = AppState.activeSession.hero;
    const goldDisp = document.getElementById("emporio-gold-display");
    if (goldDisp) goldDisp.textContent = `${h ? h.oro : 0} 🟡`;
    this.setEmporioMode(AppState.activeSession.engineState?.emporioMode || "buy");
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("drawer-emporio")?.showModal();
  },

  setEmporioMode: function(mode) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
    AppState.activeSession.engineState.emporioMode = mode;

    const btnBuy = document.getElementById("emporio-tab-buy");
    const btnSell = document.getElementById("emporio-tab-sell");
    const container = document.getElementById("emporio-items-container");
    const h = AppState.activeSession.hero;

    if (btnBuy) btnBuy.className = `flex-1 btn btn-xs ${mode === 'buy' ? 'btn-primary font-black uppercase' : 'btn-ghost text-slate-400 font-bold uppercase'}`;
    if (btnSell) btnSell.className = `flex-1 btn btn-xs ${mode === 'sell' ? 'btn-primary font-black uppercase' : 'btn-ghost text-slate-400 font-bold uppercase'}`;

    if (mode === "sell") {
      const inv = h?.inventario || [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Zaino vuoto.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => {
        const ent = this._findEntityData(it);
        const buyPrice = Math.abs(typeof cleanNumber === "function" ? cleanNumber(ent?.costoOro || ent?.costo, 10) : Number(ent?.costoOro || ent?.costo || 10));
        const sellPrice = Math.max(1, Math.ceil(buyPrice * 0.25));

        return `
          <div class="emporio-sell-row">
            <span class="font-bold text-white truncate pr-2">${it}</span>
            <button onclick="Rules2Engine.sellToEmporio('${Rules2_SafeAttr(it)}', ${sellPrice})" class="btn btn-xs btn-warning font-black uppercase">
              Vendi (+${sellPrice} 🟡)
            </button>
          </div>
        `;
      }).join("");
    } else {
      const emporioItems = AppState.activeSession.shopCatalog || [];

      if (emporioItems.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Banchi vuoti.</div>`;
        return;
      }

      container.innerHTML = emporioItems.map(item => {
        const price = Math.abs(typeof cleanNumber === "function" ? cleanNumber(item.costoOro || item.costo, 10) : Number(item.costoOro || item.costo || 10));
        const canAfford = (h && h.oro >= price);

        return `
          <div class="emporio-item-card group">
            <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(item.nome)}'))" class="item-card-clickable">
              <div class="item-card-header">
                <span class="text-lg">${item.emoji || '📦'}</span>
                <span class="item-card-price">${price} 🟡</span>
              </div>
              <div class="item-card-name">${item.nome}</div>
              <div class="item-card-desc">${item.testo || item.descrizione || ''}</div>
            </div>
            <div class="item-card-actions">
              <button onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(item.nome)}'))" class="btn btn-xs btn-outline border-white/10 text-slate-300">
                Dettagli
              </button>
              <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Compra' : 'Oro Insuff.'}
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  },

  buyFromEmporio: async function(itemId, goldCost) {
    const hero = AppState.activeSession.hero;
    if (!hero || hero.oro < goldCost) {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      tgAlert("Oro insufficiente!");
      return;
    }
    const item = (AppState.activeSession.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    if (Rules2_ClassifyEntity(item) === "VEICOLI") {
      const hasVehicle = (hero.inventario || []).some(x => Rules2_ClassifyEntity(this._findEntityData(x)) === "VEICOLI");
      if (hasVehicle) {
        tgHaptic("warning");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
        tgAlert("Massimo 1 Veicolo consentito!");
        return;
      }
    }

    try {
      const res = await apiCall("game_action", {
        subAction: "buy_emporio",
        itemId: itemId,
        cost: goldCost,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (res?.statoEroe) {
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        Wallet.setGold(res.statoEroe.oro);
      } else {
        hero.oro -= goldCost;
        hero.inventario.push(item.nome);
        Wallet.setGold(hero.oro);
      }

      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  sellToEmporio: async function(itemName, fallbackGain) {
    try {
      const res = await apiCall("game_action", {
        subAction: "sell_emporio",
        itemName: itemName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (res?.statoEroe) {
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        Wallet.setGold(res.statoEroe.oro);
      } else {
        const hero = AppState.activeSession.hero;
        if (hero) {
          const idx = (hero.inventario || []).indexOf(itemName);
          if (idx !== -1) hero.inventario.splice(idx, 1);
          hero.oro += (fallbackGain || 10);
          if (hero.armaAttiva === itemName) hero.armaAttiva = "";
          if (hero.veicoloAttivo === itemName) hero.veicoloAttivo = "";
          Wallet.setGold(hero.oro);
        }
      }

      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  openCambioModal: function() {
    const balEl = document.getElementById("cambio-megoin-balance");
    if (balEl) balEl.textContent = Wallet.getMegoin();
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-banco-cambio")?.showModal();
  },

  convertMegoinToGold: async function(megoinCost, goldEarned) {
    const currentMegoin = Wallet.getMegoin();
    if (currentMegoin < megoinCost) {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      tgAlert("Megoin insufficienti!");
      return;
    }

    try {
      const res = await apiCall("currency_exchange", {
        megoin: megoinCost,
        gold: goldEarned,
        gameKey: AppState.activeSession.gameKey || "game1"
      });

      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") {
          SoundEngine.playSfx("cash_register");
          SoundEngine.playSfx("lucky");
        }
        if (window.confetti) confetti({ particleCount: 60, spread: 50 });

        const nuovoSaldo = res.nuovoSaldoMegoin !== undefined ? res.nuovoSaldoMegoin : (currentMegoin - megoinCost);
        Wallet.setMegoin(nuovoSaldo);

        if (Rules2Wizard.state.currentGold !== undefined) {
          Rules2Wizard.state.currentGold += goldEarned;
          const wizGoldDisp = document.getElementById("wizard-shop-gold-display");
          if (wizGoldDisp) wizGoldDisp.textContent = `💰 ${Rules2Wizard.state.currentGold} 🟡`;
        }

        if (AppState.activeSession.hero) {
          const nuovoOro = res.nuovoOro !== undefined ? res.nuovoOro : (AppState.activeSession.hero.oro + goldEarned);
          Wallet.setGold(nuovoOro);
          this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        }

        if (typeof AppModules !== "undefined") {
          AppModules.renderProfile(AppState.user);
        }

        tgAlert(`Convertiti ${megoinCost} 🪙 in +${goldEarned} 🟡 Oro!`);
        document.getElementById("modal-banco-cambio")?.close();
      }
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  // 4. CASSETTO SQUADRA & ZOMBI
  openSquadDrawer: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const compData = h.compagniData || {};
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="empty-state-card">In solitaria. Nessun alleato.</div>`;
    } else {
      html += comp.map(a => {
        const d = compData[a] || {};
        const hpText = d.pv ? ` (❤️ ${d.pv}/${d.pvMax || 15} PV)` : "";
        return `<div class="squad-member-card"><span>🤝 ${a}${hpText}</span> <span class="badge-human">Alleato</span></div>`;
      }).join("");
      html += zombies.map(z => `
        <div class="squad-member-card zombie">
          <span>🧟 ${z.nome}</span> <span class="badge-zombie">Danno x2 (❤️ ${z.pv}/${z.pvMax || 15})</span>
        </div>
      `).join("");
    }

    c.innerHTML = html;
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("drawer-squad")?.showModal();
  },

  // 5. CASSETTO DOSSIER & INCHIESTA
  openDossierDrawer: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => {
      const ent = this._findEntityData(it);
      return Rules2_ClassifyEntity(ent) === "INFORMAZIONI";
    });

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="empty-state-card">Nessun reperto d'inchiesta.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const sub = String(ent?.sottocategoria || "").toLowerCase();
        const isPermanent = (sub === "prove" || sub === "prova");

        return `
          <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(p)}'))" class="dossier-evidence-card">
            <div class="evidence-header">
              <span class="evidence-name">📁 ${p}</span>
              <span class="badge badge-xs badge-info">${ent?.categoria || 'Reperto'}</span>
            </div>
            <div class="evidence-desc">
              ${isPermanent ? 'Organigramma: <b class="text-emerald-400">+1 INT permanente</b>' : `Inchiesta: <b class="text-amber-300">+1 INT situazionale</b>`}
            </div>
          </div>
        `;
      }).join("");
    }

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("clue_found");
    document.getElementById("drawer-dossier")?.showModal();
  },

  openAbandonModal: function() {
    tgHaptic("warning");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-abandon")?.showModal();
  },

  confirmAbandon: function() {
    document.getElementById("modal-abandon")?.close();
    AppState.activeSession.partitaId = null;
    AppState.activeSession.hero = null;
    AppState.activeSession.currentNode = null;
    AppState.activeSession.engineState = null;
    if (typeof SoundEngine !== "undefined") SoundEngine.stopHeartbeat();
    this.leaveGameToHub();
  },

  leaveGameToHub: function() {
    if (typeof SoundEngine !== "undefined") {
      SoundEngine.stopHeartbeat();
      SoundEngine.playBgm("hub");
    }
    AppRouter.navigate("games");
  }
};

// ----------------------------------------------------------------------------
// 6. ESPOSIZIONE GLOBALE & BINDING DIRETTO CON LE VISTE
// ----------------------------------------------------------------------------
window.Rules2Wizard = Rules2Wizard;
window.Rules2Engine = Rules2Engine;

if (typeof window.EngineRegistry !== "undefined" && typeof window.EngineRegistry.register === "function") {
  window.EngineRegistry.register("Rules2", Rules2Engine);
  window.EngineRegistry.register("rules2", Rules2Engine);
  window.EngineRegistry.register("Rules 2", Rules2Engine);
}

window.GameEngine = {
  setWizardViewMode: (step, mode) => Rules2Wizard.setWizardViewMode(step, mode),
  coverflowPrev: () => Rules2Wizard.coverflowPrev(),
  coverflowNext: () => Rules2Wizard.coverflowNext(),
  wizardConfirmStep1: () => Rules2Wizard.confirmStep1(),
  wizardPrevStep: (s) => Rules2Wizard.prevStep(s),
  wizardConfirmStep2: () => Rules2Wizard.confirmStep2(),
  filterWizardShop: (c) => Rules2Wizard.filterShop(c),
  resetWizardShop: () => Rules2Wizard.resetShop(),
  wizardNextStep: (s) => Rules2Wizard.nextStep(s),
  wizardFinalizeHero: () => Rules2Wizard.finalizeHero(),

  openHeroSheetDrawer: () => Rules2Engine.openHeroSheetDrawer(),
  openBackpackDrawer: () => Rules2Engine.openBackpackDrawer(),
  openEmporioDrawer: () => Rules2Engine.openEmporioDrawer(),
  openSquadDrawer: () => Rules2Engine.openSquadDrawer(),
  openDossierDrawer: () => Rules2Engine.openDossierDrawer(),

  setEmporioMode: (m) => Rules2Engine.setEmporioMode(m),
  buyFromEmporio: (id, p) => Rules2Engine.buyFromEmporio(id, p),
  sellToEmporio: (it, g) => Rules2Engine.sellToEmporio(it, g),
  openCambioModal: () => Rules2Engine.openCambioModal(),
  convertMegoinToGold: (m, g) => Rules2Engine.convertMegoinToGold(m, g),

  filterBackpack: (c) => Rules2Engine.filterBackpack(c),
  useBackpackItem: (it) => Rules2Engine.useBackpackItem(it),
  equipItem: (it, t) => Rules2Engine.equipItem(it, t),

  combatAction: (act) => Rules2Engine.combatAction(act),
  combatBribe: (d) => Rules2Engine.combatBribe(d),
  executeResurrectZombie: (id) => Rules2Engine.executeResurrectZombie(id),
  skipNecromancy: () => Rules2Engine.skipNecromancy(),
  submitQuizAnswer: (a) => Rules2Engine.submitQuizAnswer(a),
  advanceToNode: (t) => Rules2Engine.advanceToNode(t),
  openAbandonModal: () => Rules2Engine.openAbandonModal(),
  confirmAbandon: () => Rules2Engine.confirmAbandon(),
  leaveGameToHub: () => Rules2Engine.leaveGameToHub()
};
