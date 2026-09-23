// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2wizard.js (VERSIONE 20.0 - TCG MOVERINA CARD & GLORIOUS STEPPER)
// LAYER: WIZARD FULL-STAGE, TCG CARDS, THUMB STEPPER RAIL, CHIP FILTERS & REVISION
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
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Usa 1 dose di droga per rianimare uno Zombi.");
    else if (tag === "CLASSE:Destra") out.push("⚖️ <b>Orientamento Destra:</b> +1 Danno fisso vs Mazzu e Ideologi.");
    else if (tag === "CLASSE:Sinistra") out.push("⚖️ <b>Orientamento Sinistra:</b> +1 Danno fisso vs Camorristi e Burocrati.");
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 costante a tutti i tiri D20 ed Eventi.");
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

function wizardNotify(msg, type = "info") {
  if (window.AppCore && typeof AppCore.toast === "function") {
    AppCore.toast(msg, type);
  } else if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(msg);
  } else {
    alert(msg);
  }
}

// ----------------------------------------------------------------------------
// 2. STORE CLIENT-SIDE (CACHE LOCALE DATI WIZARD)
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
// 3. WIZARD CREAZIONE PERSONAGGIO (MACCHINA A STATI CON REVISIONE DIRETTA)
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

    classFactionFilter: "tutte",
    abilityCategoryFilter: "tutti",

    activeClassIndex: 0,
    activeAbilityIndex: 0,
    activeShopIndex: 0,

    chosenClass: null,
    chosenAbilities: [],
    boughtItems: [],
    heroName: "",
    remainingPx: 100,
    startingGold: 40,
    currentGold: 40
  },

  // --------------------------------------------------------------------------
  // GESTIONE SINCRONIZZATA DELL'ORO CON IL RUNTIME ENGINE
  // --------------------------------------------------------------------------
  syncGold: function() {
    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.getGold === "function") {
      const engineGold = Rules2Engine.getGold();
      if (engineGold !== undefined && !isNaN(engineGold)) {
        if (engineGold > this.state.currentGold) {
          const diff = engineGold - this.state.currentGold;
          this.state.startingGold += diff;
          this.state.currentGold = engineGold;
        }
      }
    }
    this._syncGoldDisplay();
  },

  setGold: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    const diff = num - this.state.currentGold;
    this.state.currentGold = num;
    this.state.startingGold += diff;
    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.setGold === "function") {
      Rules2Engine.setGold(num);
    }
    this._syncGoldDisplay();
    if (this.state.step === 3) {
      this.filterShop(this.state.shopCategory);
    }
  },

  addGold: function(amount) {
    this.setGold(this.state.currentGold + (parseInt(amount, 10) || 0));
  },

  _syncGoldDisplay: function() {
    const goldDisp = document.getElementById("wizard-shop-gold-display");
    if (goldDisp) goldDisp.innerHTML = `💰 <b>${this.state.currentGold}</b> 🟡`;
  },

  // --------------------------------------------------------------------------
  // STEPPER PROGRESSIVO SUL BINARIO INFERIORE (ZONA DEL POLLICE)
  // --------------------------------------------------------------------------
  updateStepper: function(step) {
    // 1. Aggiorna il nuovo binario minimal a segmenti luminosi
    [1, 2, 3, 4].forEach(n => {
      const seg = document.getElementById(`wiz-step-seg-${n}`);
      if (seg) {
        seg.className = "stepper-rail-segment";
        if (n === step) seg.classList.add("active");
        else if (n < step) seg.classList.add("completed");
      }
    });

    // 2. Retro-compatibilità con eventuali tracker precedenti
    [1, 2, 3, 4].forEach(n => {
      const ind = document.getElementById(`wiz-step-ind-${n}`);
      if (!ind) return;
      ind.classList.remove('active', 'completed');
      if (n === step) ind.classList.add('active');
      else if (n < step) ind.classList.add('completed');
    });
  },

  syncLiveHUD: function() {
    const cls = this.state.chosenClass;
    if (!cls) return;

    const avatarEl = document.getElementById('wiz-live-avatar');
    const nameEl = document.getElementById('wiz-live-name');
    const statsEl = document.getElementById('wiz-live-stats');
    const budgetEl = document.getElementById('wiz-live-budget');
    const goldEl = document.getElementById('wiz-live-gold');

    if (avatarEl) avatarEl.textContent = cls.emoji || '🥋';
    if (nameEl) nameEl.textContent = this.state.heroName || cls.nome;
    if (statsEl) statsEl.textContent = `❤️ ${cls.pv} PV • FOR ${cls.forza} · DES ${cls.destrezza} · INT ${cls.intelligenza}`;
    if (budgetEl) budgetEl.textContent = `✨ ${this.state.remainingPx} PX`;
    if (goldEl) goldEl.textContent = `💰 ${this.state.currentGold} 🟡`;
  },

  // --------------------------------------------------------------------------
  // APERTURA E RIPRISTINO SESSIONE DA GOOGLE APPS SCRIPT
  // --------------------------------------------------------------------------
  open: async function(gameKey, epNum, isVeteran = false, savedHero = null) {
    try {
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

      if (this.state.isVeteran && savedHero) {
        const matchingClass = this.state.classes.find(c => c.id === savedHero.classeId || c.nome === savedHero.classe) || this.state.classes[0];
        this.state.chosenClass = matchingClass;
        this.state.heroName = savedHero.nomeEroe || AppState.user?.nome || "Veterano";
        this.state.currentGold = savedHero.oro !== undefined ? Number(savedHero.oro) : Number(matchingClass.oro || 40);
        this.state.startingGold = this.state.currentGold;
        this.state.remainingPx = Number(savedHero.px !== undefined ? savedHero.px : 100);
        this.state.chosenAbilities = [...(savedHero.abilitaIds || savedHero.abilita || [])];

        this.syncGold();
        this.renderStep2();
        this.showStep(2);
      } else {
        const firstClass = this.state.classes[0] || null;
        this.state.chosenClass = firstClass;
        this.state.remainingPx = 100;
        this.state.startingGold = firstClass ? Number(firstClass.oro || 40) : 40;
        this.state.currentGold = this.state.startingGold;
        this.state.heroName = AppState.user?.nome || "Avventuriero";

        this.syncGold();
        this.renderStep1();
        this.showStep(1);
      }

      this.bindModalBackdropClose();
      AppRouter.navigate("view-wizard");
    } catch (err) {
      console.error("[Rules2Wizard] Errore apertura wizard:", err);
      wizardNotify("Errore caricamento wizard: " + err.message, "error");
    }
  },

  resumeSession: async function(gameKey, epNum, sessionData) {
    try {
      let wizData = Rules2Store.loadCachedWizardData(gameKey);
      if (!wizData) {
        wizData = await apiCall("game_wizard_data", { gameKey: gameKey });
        if (wizData) Rules2Store.setCachedWizardData(gameKey, wizData);
      }

      this.state.gameKey = gameKey;
      this.state.episodio = epNum;
      this.state.classes = (wizData.classes || wizData.classi || []);
      this.state.abilities = (wizData.abilities || wizData.abilita || []);
      this.state.shopCatalog = (wizData.emporioItems || wizData.equipaggiamenti || []);

      const fase = String(sessionData.activeFase || "WIZARD_CLASSE").toUpperCase();
      const hero = sessionData.statoEroe || {};

      if (hero.classeId || hero.classe) {
        const found = this.state.classes.find(c => c.id === hero.classeId || c.nome === hero.classe) || this.state.classes[0];
        if (found) {
          this.state.activeClassIndex = this.state.classes.indexOf(found);
          this.state.chosenClass = found;
          this.state.startingGold = Number(found.oro || 40);
        }
      } else {
        this.state.chosenClass = this.state.classes[0] || null;
        this.state.startingGold = this.state.chosenClass ? Number(this.state.chosenClass.oro || 40) : 40;
      }

      this.state.heroName = hero.nomeEroe || AppState.user?.nome || "Avventuriero";

      this.state.chosenAbilities = [];
      if (hero.abilita && Array.isArray(hero.abilita)) {
        hero.abilita.forEach(aName => {
          const aObj = this.state.abilities.find(x => x.nome === aName || x.id === aName);
          if (aObj) this.state.chosenAbilities.push(aObj.id);
        });
      }
      this.state.remainingPx = hero.px !== undefined ? Number(hero.px) : (100 - (this.state.chosenAbilities.length * 100));

      this.state.boughtItems = [];
      if (hero.inventario && Array.isArray(hero.inventario)) {
        hero.inventario.forEach(iName => {
          const itemObj = this.state.shopCatalog.find(x => x.nome === iName || x.id === iName);
          if (itemObj) this.state.boughtItems.push(itemObj);
        });
      }
      this.state.currentGold = hero.oro !== undefined ? Number(hero.oro) : this.state.startingGold;
      this.syncGold();

      this.bindModalBackdropClose();
      AppRouter.navigate("view-wizard");

      if (fase === "WIZARD_ABILITA") {
        this.renderStep2();
        this.showStep(2);
      } else if (fase === "WIZARD_SHOP") {
        this.renderStep3();
        this.showStep(3);
      } else if (fase === "WIZARD_NOME") {
        this.renderStep4();
        this.showStep(4);
      } else {
        this.renderStep1();
        this.showStep(1);
      }
    } catch (e) {
      console.error("[Rules2Wizard] Errore ripristino wizard:", e);
      this.open(gameKey, epNum, false, null);
    }
  },

  _syncStepToServer: function(faseName) {
    if (!this.state.gameKey) return;
    const heroPayload = {
      subAction: "save_wizard_step",
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      fase: faseName,
      classeId: this.state.chosenClass?.id || "",
      classe: this.state.chosenClass?.nome || "",
      schieramentoPolitico: this.state.chosenClass?.sottocategoria || "Destra",
      oro: this.state.currentGold,
      px: this.state.remainingPx,
      abilita: (this.state.chosenAbilities || []).map(id => {
        const a = this.state.abilities.find(x => x.id === id);
        return a ? a.nome : id;
      }),
      inventario: (this.state.boughtItems || []).map(i => i.nome || i.id),
      nomeEroe: this.state.heroName
    };
    apiCall("game_action", heroPayload).catch(() => {});
  },

  confirmStep1: function() {
    if (!this.state.chosenClass) return wizardNotify("Scegli una classe prima di avanzare!", "warning");
    tgHaptic("success");
    this._syncStepToServer("WIZARD_ABILITA");
    this.renderStep2();
    this.showStep(2);
  },

  confirmStep2: function() {
    if (!this.state.chosenClass) return wizardNotify("Scegli prima una classe!", "warning");
    tgHaptic("success");
    this._syncStepToServer("WIZARD_SHOP");
    this.renderStep3();
    this.showStep(3);
  },

  goToStep: function(s) {
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
    if (s === 1) this.renderStep1();
    else if (s === 2) this.renderStep2();
    else if (s === 3) this.renderStep3();
    else if (s === 4) this.renderStep4();
    this.showStep(s);
  },

  nextStep: function(s) {
    if (s === 4) {
      this._syncStepToServer("WIZARD_NOME");
      this.renderStep4();
    }
    this.showStep(s);
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
  },

  prevStep: function(s) {
    this.showStep(s);
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
  },

  showStep: function(stepNum) {
    this.state.step = stepNum;
    this.updateStepper(stepNum);
    this.syncLiveHUD();

    [1, 2, 3, 4].forEach(n => {
      const panel = document.getElementById(`wizard-step-${n === 1 ? 'class' : n === 2 ? 'abilities' : n === 3 ? 'shop' : 'name'}`);
      if (panel) panel.classList.toggle("hidden", n !== stepNum);
      const footer = document.getElementById(`wiz-footer-step-${n}`);
      if (footer) footer.classList.toggle("hidden", n !== stepNum);
    });

    if (stepNum === 2 && this.state.isVeteran) {
      const prevClassBtn = document.querySelector("#wiz-footer-step-2 button:first-child");
      if (prevClassBtn) prevClassBtn.classList.add("hidden");
    }

    if (stepNum === 3) {
      const nextBtn = document.getElementById("wizard-step3-next-btn");
      if (nextBtn) {
        if (this.state.isVeteran) {
          nextBtn.textContent = `Inizia Ep. ${this.state.episodio} 🚀`;
          nextBtn.onclick = () => Rules2Wizard.finalizeHero();
        } else {
          nextBtn.textContent = "Al Battesimo ›";
          nextBtn.onclick = () => Rules2Wizard.nextStep(4);
        }
      }
    }

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
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

  scrollToCard: function(stageId, index, cardWidth = 285) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    stage.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  },

  // --------------------------------------------------------------------------
  // STEP 1: SCELTA CLASSE COSTIERA (MODELLO TCG "MOVERINA")
  // --------------------------------------------------------------------------
  setClassFactionFilter: function(faction) {
    this.state.classFactionFilter = faction;
    this.renderStep1();
  },

  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    let classes = this.state.classes || [];
    const filter = this.state.classFactionFilter || "tutte";

    // 1. Iniezione Barra Filtri a Chip Rapidi
    let filterBar = document.getElementById("wizard-class-faction-chips");
    if (!filterBar) {
      const parentPanel = document.getElementById("wizard-step-class");
      if (parentPanel) {
        filterBar = document.createElement("div");
        filterBar.id = "wizard-class-faction-chips";
        filterBar.className = "chips-scroll-bar flex gap-1.5 overflow-x-auto py-1.5 mb-1";
        parentPanel.insertBefore(filterBar, parentPanel.firstChild);
      }
    }

    if (filterBar) {
      filterBar.innerHTML = `
        <button onclick="Rules2Wizard.setClassFactionFilter('tutte')" class="rpg-category-chip ${filter === 'tutte' ? 'active' : ''}">TUTTE</button>
        <button onclick="Rules2Wizard.setClassFactionFilter('sinistra')" class="rpg-category-chip ${filter === 'sinistra' ? 'active' : ''}">SINISTRA</button>
        <button onclick="Rules2Wizard.setClassFactionFilter('destra')" class="rpg-category-chip ${filter === 'destra' ? 'active' : ''}">DESTRA</button>
      `;
    }

    // Filtro attivo in RAM
    if (filter !== "tutte") {
      classes = classes.filter(c => String(c.sottocategoria || "").toLowerCase() === filter.toLowerCase());
    }

    // 2. Render delle Carte TCG con Modello "Moverina"
    stage.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.activeClassIndex === idx);
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();
      const forVal = Number(cls.forza || 10);
      const desVal = Number(cls.destrezza || 10);
      const intVal = Number(cls.intelligenza || 10);
      const startingLoot = cls.equipLoot || "Pugni nudi";

      return `
        <div id="coverflow-card-${idx}" data-faction="${pol}" onclick="Rules2Wizard.selectClassByIndex(${idx})" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
          <!-- A. Testata Interna -->
          <div class="tcg-card-header">
            <h4 class="tcg-card-title">${cls.emoji || '🥋'} ${cls.nome}</h4>
            <span class="tcg-card-faction-badge ${pol}">${pol.toUpperCase()}</span>
          </div>

          <!-- B. Illustrazione con Citazione Sfumata Morbida -->
          <div class="tcg-card-media">
            <img src="${cls.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            ${(cls.citazione && cls.citazione !== "—") ? `
              <div class="tcg-card-quote-overlay">
                <div class="tcg-card-quote-text">“${cls.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                <div class="tcg-card-quote-author">${cls.autoreCitazione || 'LA FAZIONE'}</div>
              </div>
            ` : ''}
          </div>

          <!-- C. Piastra Statistiche Incastonata -->
          <div class="tcg-stats-plate">
            <span>🥊 FOR <b>${forVal}</b></span>
            <span>🤸 DES <b>${desVal}</b></span>
            <span>🧠 INT <b>${intVal}</b></span>
          </div>

          <!-- D. Narrazione a 12.5px Leggibile -->
          <p class="tcg-card-desc">${cls.descrizione || cls.testo || ''}</p>

          <!-- E. Piede con Dotazione Iniziale, PV e Oro -->
          <div class="tcg-card-footer">
            <div class="tcg-card-loot" title="${Rules2_SafeAttr(startingLoot)}">🎒 ${startingLoot}</div>
            <div class="tcg-card-vitals">
              <span class="tcg-pv-badge">❤️ ${cls.pv} PV</span>
              <span class="tcg-gold-badge">🟡 ${cls.oro} ORO</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = classes.map((_, i) => `
        <span onclick="Rules2Wizard.selectClassByIndex(${i})" class="coverflow-dot ${i === this.state.activeClassIndex ? 'active' : ''}"></span>
      `).join("");
    }

    this.syncLiveHUD();
  },

  selectClassByIndex: function(idx) {
    this.state.activeClassIndex = idx;
    this.state.chosenClass = this.state.classes[idx];

    if (!this.state.isVeteran && this.state.chosenClass) {
      this.state.startingGold = Number(this.state.chosenClass.oro || 40);
      this.state.currentGold = this.state.startingGold;
      this.syncGold();
    }

    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();

    this.renderStep1();
    this.scrollToCard('wizard-classes-stage', idx);
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ & TALENTI (CARD TCG UNIFORME & BUDGET 100 PX)
  // --------------------------------------------------------------------------
  setAbilityCategoryFilter: function(cat) {
    this.state.abilityCategoryFilter = cat;
    this.renderStep2();
  },

  renderStep2: function() {
    const stage = document.getElementById("wizard-abilities-stage");
    const dotsBox = document.getElementById("wizard-abilities-dots");
    if (!stage) return;

    let abilities = this.state.abilities || [];
    const filter = this.state.abilityCategoryFilter || "tutti";
    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    // 1. Barra Filtri Categoria Talenti
    let filterBar = document.getElementById("wizard-abilities-filter-chips");
    if (!filterBar) {
      const parentPanel = document.getElementById("wizard-step-abilities");
      if (parentPanel) {
        filterBar = document.createElement("div");
        filterBar.id = "wizard-abilities-filter-chips";
        filterBar.className = "chips-scroll-bar flex gap-1.5 overflow-x-auto py-1.5 mb-1";
        parentPanel.insertBefore(filterBar, parentPanel.firstChild);
      }
    }

    if (filterBar) {
      filterBar.innerHTML = `
        <button onclick="Rules2Wizard.setAbilityCategoryFilter('tutti')" class="rpg-category-chip ${filter === 'tutti' ? 'active' : ''}">TUTTI</button>
        <button onclick="Rules2Wizard.setAbilityCategoryFilter('fisica')" class="rpg-category-chip ${filter === 'fisica' ? 'active' : ''}">FISICA</button>
        <button onclick="Rules2Wizard.setAbilityCategoryFilter('mentale')" class="rpg-category-chip ${filter === 'mentale' ? 'active' : ''}">MENTALE</button>
        <button onclick="Rules2Wizard.setAbilityCategoryFilter('clandestina')" class="rpg-category-chip ${filter === 'clandestina' ? 'active' : ''}">OCCULTA</button>
      `;
    }

    if (filter !== "tutti") {
      abilities = abilities.filter(a => String(a.categoria || "").toLowerCase() === filter.toLowerCase());
    }

    // 2. Render Carte Talenti con Sagoma TCG
    stage.innerHTML = abilities.map((abl, idx) => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);
      const perkText = Rules2_FormatHumanEffect(abl.requisitiCodificati || abl.effettoCodificato, userFaction);

      return `
        <div id="abilities-card-${idx}" onclick="Rules2Wizard.toggleAbility('${abl.id}')" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
          <div class="tcg-card-header">
            <h4 class="tcg-card-title">${abl.emoji || '⚡'} ${abl.nome}</h4>
            <span class="tcg-card-faction-badge ${isCompatible ? 'destra' : 'sinistra'}">${(abl.categoria || 'Talento').toUpperCase()}</span>
          </div>

          <div class="tcg-card-media flex items-center justify-center bg-gradient-to-b from-slate-900 to-black">
            <div class="text-6xl filter drop-shadow(0 0 12px rgba(56,189,248,0.5))">${abl.emoji || '⚡'}</div>
          </div>

          <div class="tcg-stats-plate">
            <span>✨ <b>${abl.costoPX || 100} PX</b></span>
            <span>🎯 <b>${isCompatible ? 'Compatibile' : 'Vincolato'}</b></span>
            <span>⚡ <b>${isSelected ? 'Appreso' : 'Disponibile'}</b></span>
          </div>

          <div class="tcg-card-desc">${perkText}</div>

          <div class="tcg-card-footer">
            <div class="tcg-card-loot">${abl.sottocategoria || 'Abilità'}</div>
            <button class="btn btn-xs ${isSelected ? 'btn-warning text-black font-black' : (isCompatible ? 'btn-primary font-bold' : 'btn-disabled opacity-40')} px-3">
              ${isSelected ? 'Appreso ✓' : (isCompatible ? '+ Apprendi' : '🔒 Bloccato')}
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = abilities.map((_, i) => `
        <span onclick="Rules2Wizard.scrollToCard('wizard-abilities-stage', ${i})" class="coverflow-dot ${i === this.state.activeAbilityIndex ? 'active' : ''}"></span>
      `).join("");
    }

    this.syncLiveHUD();
  },

  toggleAbility: function(ablId) {
    const ab = this.state.abilities.find(a => a.id === ablId);
    if (!ab) return;

    const cost = Number(ab.costoPX || 100);
    const idx = this.state.chosenAbilities.indexOf(ablId);

    if (idx !== -1) {
      this.state.chosenAbilities.splice(idx, 1);
      this.state.remainingPx += cost;
      tgHaptic("light");
      if (window.SoundEngine) SoundEngine.playClick();
      wizardNotify(`Rimosso ${ab.nome}. +${cost} PX rimborsati.`, "info");
    } else {
      if (this.state.remainingPx < cost) {
        tgHaptic("error");
        return wizardNotify(`PX insufficienti! Mancano ${cost - this.state.remainingPx} PX.`, "warning");
      }
      this.state.chosenAbilities.push(ablId);
      this.state.remainingPx -= cost;
      tgHaptic("success");
      if (window.SoundEngine) SoundEngine.playCoin();
      wizardNotify(`Talento ${ab.nome} appreso!`, "success");
    }

    this.renderStep2();
  },

  // --------------------------------------------------------------------------
  // STEP 3: MERCATO NERO (CARD TCG, BADGE QUANTITÀ & RESET)
  // --------------------------------------------------------------------------
  renderStep3: function() {
    this.syncGold();
    this.filterShop(this.state.shopCategory || "ARMI");
  },

  filterShop: function(cat) {
    this.syncGold();
    this.state.shopCategory = cat;

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(cat.toUpperCase());
        btn.classList.toggle("active", isAct);
      });
    }

    const stage = document.getElementById("wizard-shop-stage");
    const dotsBox = document.getElementById("wizard-shop-dots");
    if (!stage) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);

    stage.innerHTML = filtered.map((it, idx) => {
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const canAfford = (this.state.currentGold >= price);
      const inBag = (this.state.boughtItems || []).filter(b => b.id === it.id || b.nome === it.nome).length;

      return `
        <div id="shop-card-${idx}" class="coverflow-card tcg-card relative ${inBag > 0 ? 'selected' : ''}">
          ${inBag > 0 ? `<span class="badge badge-xs badge-warning absolute top-2 right-2 font-mono font-black z-20 shadow-md">x${inBag}</span>` : ''}

          <div class="tcg-card-header">
            <h4 class="tcg-card-title">${it.emoji || '📦'} ${it.nome}</h4>
            <span class="tcg-card-faction-badge destra">${this.state.shopCategory}</span>
          </div>

          <div class="tcg-card-media flex items-center justify-center bg-black">
            ${it.mediaUrl ? `<img src="${it.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(it.nome)}" loading="lazy">` : `<div class="text-5xl">${it.emoji || '📦'}</div>`}
          </div>

          <div class="tcg-stats-plate">
            <span>💰 <b>${price} 🟡</b></span>
            <span>💥 <b>${it.danno ? '+' + it.danno : '—'}</b></span>
            <span>❤️ <b>${it.pv ? '+' + it.pv : '—'}</b></span>
          </div>

          <p class="tcg-card-desc">${it.descrizione || it.testo || ''}</p>

          <div class="tcg-card-footer">
            <div class="tcg-card-loot font-bold">${price} ORO</div>
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-disabled opacity-40'} px-3" ${!canAfford ? 'disabled' : ''}>
              ${inBag > 0 ? `Compra Ancora (+1)` : `Compra`}
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = filtered.map((_, i) => `
        <span onclick="Rules2Wizard.scrollToCard('wizard-shop-stage', ${i})" class="coverflow-dot ${i === this.state.activeShopIndex ? 'active' : ''}"></span>
      `).join("");
    }

    this.updateBackpackSummary();
    this.syncLiveHUD();
  },

  buyItem: function(itemId, price) {
    this.syncGold();
    if (this.state.currentGold < price) {
      tgHaptic("error");
      return wizardNotify("Monete d'oro insufficienti!", "warning");
    }

    const item = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    if (Rules2_ClassifyEntity(item) === "VEICOLI") {
      const alreadyHasVehicle = this.state.boughtItems.some(x => Rules2_ClassifyEntity(x) === "VEICOLI");
      if (alreadyHasVehicle) {
        tgHaptic("warning");
        return wizardNotify("Massimo 1 Veicolo consentito!", "warning");
      }
    }

    this.state.currentGold -= price;
    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.setGold === "function") {
      Rules2Engine.setGold(this.state.currentGold);
    }
    this.state.boughtItems.push(item);

    tgHaptic("success");
    if (window.SoundEngine) SoundEngine.playCoin();
    wizardNotify(`${item.nome} aggiunto allo zaino!`, "success");

    this.filterShop(this.state.shopCategory);
  },

  resetShop: function() {
    (this.state.boughtItems || []).forEach(item => {
      const p = Math.abs(Number(item.costoOro || item.costo || 0));
      this.state.currentGold += p;
    });
    this.state.boughtItems = [];
    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.setGold === "function") {
      Rules2Engine.setGold(this.state.currentGold);
    }
    this._syncGoldDisplay();
    tgHaptic("selection");
    this.filterShop(this.state.shopCategory);
    wizardNotify("Zaino svuotato e monete d'oro rimborsate.", "info");
  },

  updateBackpackSummary: function() {
    const countEl = document.getElementById("wizard-shop-backpack-count");
    if (!countEl) return;
    const startingItem = this.state.chosenClass?.equipLoot;
    const hasStarting = (startingItem && startingItem !== "—" && startingItem !== "-");
    const total = (hasStarting ? 1 : 0) + this.state.boughtItems.length;
    countEl.textContent = `${total}`;
  },

  // --------------------------------------------------------------------------
  // STEP 4: IL "BATTESIMO DELL'AGENTE" (DOSSIER EPICO & REVISIONE DIRETTA)
  // --------------------------------------------------------------------------
  renderStep4: function() {
    this.syncGold();
    const cls = this.state.chosenClass;
    if (!cls) return;

    const pol = String(cls.sottocategoria || 'Destra').toLowerCase();
    const heroName = this.state.heroName || AppState.user?.nome || "Avventuriero";
    const startingGear = cls.equipLoot || "Pugni nudi";

    let effFor = Number(cls.forza || 10);
    let effDes = Number(cls.destrezza || 10);
    let effInt = Number(cls.intelligenza || 10);
    let bonusPV = 0;

    this.state.boughtItems.forEach(item => {
      if (item.forza) effFor += Number(item.forza);
      if (item.destrezza) effDes += Number(item.destrezza);
      if (item.intelligenza) effInt += Number(item.intelligenza);
      if (item.pv) bonusPV += Number(item.pv);
    });

    const totPV = Number(cls.pv || 25) + bonusPV;

    const container = document.getElementById("wizard-step-name");
    if (!container) return;

    container.innerHTML = `
      <div class="subheader-3col">
        <div class="subheader-left">BATTESIMO</div>
        <div class="subheader-center">Consacrazione Eroe</div>
        <div class="subheader-right">4/4</div>
      </div>

      <div class="space-y-3.5 pt-1">
        <!-- 1. Input Nome dell'Eroe + Generatore Alias da Bisca -->
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider block">Nome dell'Eroe nella Darsena</label>
            <button onclick="Rules2Wizard.randomizeHeroName()" class="text-[10.5px] text-amber-300 font-mono hover:underline flex items-center gap-1 font-bold">
              🎲 Nome da Bisca
            </button>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-slate-800 border border-sky-400/40 flex items-center justify-center text-lg shrink-0">
              ${cls.emoji || '🥋'}
            </div>
            <input id="wizard-hero-name-input" type="text" value="${heroName}" oninput="Rules2Wizard.updateHeroName(this.value)" class="input input-bordered input-sm w-full bg-slate-950 text-white font-bold text-sm focus:border-sky-400">
          </div>
        </div>

        <!-- 2. Scheda Riassuntiva Matricola (Dossier TCG Syndicate) -->
        <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950/20 to-slate-950 border border-sky-400/40 space-y-3 shadow-xl">
          <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-slate-800 border border-sky-400 flex items-center justify-center text-2xl">
                ${cls.emoji || '🥋'}
              </div>
              <div>
                <span class="text-[9px] font-mono text-sky-400 font-bold uppercase tracking-wider">${pol}</span>
                <h4 class="font-black text-sm text-white" id="recap-hero-title">${heroName} • ${cls.nome}</h4>
                <div class="text-[10.5px] font-mono text-slate-300 mt-0.5">❤️ <b>${totPV}</b> PV • 💰 <b>${this.state.currentGold}</b> 🟡 Oro</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div class="p-2 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[8.5px] text-slate-400 font-bold uppercase">FORZA</div>
              <div class="text-sm font-black text-white">${effFor}</div>
            </div>
            <div class="p-2 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[8.5px] text-slate-400 font-bold uppercase">DESTREZZA</div>
              <div class="text-sm font-black text-white">${effDes}</div>
            </div>
            <div class="p-2 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[8.5px] text-slate-400 font-bold uppercase">INTELLIGENZA</div>
              <div class="text-sm font-black text-white">${effInt}</div>
            </div>
          </div>

          <!-- ⭐ 3 NODI DI REVISIONE DIRETTA (SALTO ALLO STEP SENZA RICOMINCIARE) -->
          <div class="space-y-1.5 pt-1 text-xs font-mono">
            <div class="p-2 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-between">
              <div>
                <span class="text-slate-400 text-[10px]">Classe:</span>
                <b class="text-white ml-1">${cls.nome}</b>
              </div>
              <button onclick="Rules2Wizard.goToStep(1)" class="btn btn-xs btn-outline border-white/20 text-sky-300 font-bold text-[10px]">
                ✎ Modifica
              </button>
            </div>

            <div class="p-2 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-between">
              <div>
                <span class="text-slate-400 text-[10px]">Talenti (${this.state.chosenAbilities.length}):</span>
                <b class="text-amber-300 ml-1">${this.state.chosenAbilities.length > 0 ? this.state.chosenAbilities.length + ' appresi' : 'Nessuno'}</b>
              </div>
              <button onclick="Rules2Wizard.goToStep(2)" class="btn btn-xs btn-outline border-white/20 text-sky-300 font-bold text-[10px]">
                ✎ Modifica
              </button>
            </div>

            <div class="p-2 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-between">
              <div>
                <span class="text-slate-400 text-[10px]">Zaino:</span>
                <b class="text-emerald-400 ml-1">${this.state.boughtItems.length + 1} oggetti</b>
              </div>
              <button onclick="Rules2Wizard.goToStep(3)" class="btn btn-xs btn-outline border-white/20 text-sky-300 font-bold text-[10px]">
                ✎ Modifica
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  updateHeroName: function(val) {
    if (val && val.trim()) {
      this.state.heroName = val.trim();
      const recap = document.getElementById('recap-hero-title');
      if (recap) recap.textContent = `${this.state.heroName} • ${this.state.chosenClass?.nome}`;
      this._syncStepToServer("WIZARD_NOME");
    }
  },

  randomizeHeroName: function() {
    const firstNames = ['Paul', 'Tazio', 'Vincenzo', 'Dante', 'Marco', 'Silvia', 'Laura', 'Gennaro', 'Ruggero', 'Flavio'];
    const lastNames = ['De Santis', 'Maraldi', 'Vettori', 'Bonghi', 'Calamari', 'Porta', 'Rossi', 'Ferrante', 'Speranza'];
    const randFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    this.state.heroName = `${randFirst} ${randLast}`;

    const input = document.getElementById('wizard-hero-name-input');
    if (input) input.value = this.state.heroName;
    const recap = document.getElementById('recap-hero-title');
    if (recap) recap.textContent = `${this.state.heroName} • ${this.state.chosenClass?.nome}`;
    this._syncStepToServer("WIZARD_NOME");
  },

  finalizeHero: function() {
    const input = document.getElementById('wizard-hero-name-input');
    if (input && input.value.trim()) {
      this.state.heroName = input.value.trim();
    }

    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass?.id || "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      heroName: this.state.heroName,
      avatarUrl: this.state.chosenClass?.mediaUrl || "",
      isVeteran: this.state.isVeteran
    };

    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.executeStartGame === "function") {
      Rules2Engine.executeStartGame(payload, payload.avatarUrl);
    }
  }
};

// ----------------------------------------------------------------------------
// 4. ESPOSIZIONE GLOBALE & PROXY
// ----------------------------------------------------------------------------
window.Rules2Wizard = Rules2Wizard;

if (typeof window.GameEngine === "undefined") window.GameEngine = {};
Object.assign(window.GameEngine, {
  setClassFactionFilter: (f) => Rules2Wizard.setClassFactionFilter(f),
  setAbilityCategoryFilter: (c) => Rules2Wizard.setAbilityCategoryFilter(c),
  wizardConfirmStep1: () => Rules2Wizard.confirmStep1(),
  wizardPrevStep: (s) => Rules2Wizard.prevStep(s),
  wizardConfirmStep2: () => Rules2Wizard.confirmStep2(),
  filterWizardShop: (c) => Rules2Wizard.filterShop(c),
  resetWizardShop: () => Rules2Wizard.resetShop(),
  wizardNextStep: (s) => Rules2Wizard.nextStep(s),
  wizardFinalizeHero: () => Rules2Wizard.finalizeHero(),
  wizardGoToStep: (s) => Rules2Wizard.goToStep(s)
});
