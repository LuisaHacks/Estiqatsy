// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2wizard.js (VERSIONE 14.0 - TOUCH SCROLL-SNAP & GAS REST ALIGNED)
// LAYER: WIZARD FULL-STAGE, LIVE HUD DOCK, STEPPER TRACKER & STAT CALCULATOR
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
// 3. WIZARD CREAZIONE PERSONAGGIO (MACCHINA A STATI CON RESUME REALE SU GAS)
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
  // STEPPER PROGRESSIVO & LIVE HUD
  // --------------------------------------------------------------------------
  updateStepper: function(step) {
    [1, 2, 3, 4].forEach(n => {
      const ind = document.getElementById(`wiz-step-ind-${n}`);
      if (!ind) return;
      ind.classList.remove('active', 'completed');
      if (n === step) {
        ind.classList.add('active');
      } else if (n < step) {
        ind.classList.add('completed');
      }
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

      // Fetch dati reali da Modulo_WebApp.gs
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
        this.state.heroName = savedHero.nomeEroe || AppState.user?.first_name || "Veterano";
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
        this.state.heroName = AppState.user?.nome || AppState.user?.first_name || "Avventuriero";

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
          nextBtn.textContent = "Riepilogo ›";
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
    if (window.SoundEngine) SoundEngine.playClick();

    if (this.state.step === 1) {
      if (!is3D) this.renderClassesList();
      else this.scrollToCard('wizard-classes-stage', this.state.activeClassIndex);
    } else if (this.state.step === 2) {
      this.renderStep2();
    } else if (this.state.step === 3) {
      this.renderStep3();
    }
  },

  // --------------------------------------------------------------------------
  // HELPER SCROLL-SNAP NATIVO TOUCH (ZERO CPU BOTTLENECK)
  // --------------------------------------------------------------------------
  scrollToCard: function(stageId, index, cardWidth = 274) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    stage.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  },

  // --------------------------------------------------------------------------
  // STEP 1: SCELTA CLASSE COSTIERA (CON SCROLL-SNAP NATIVO)
  // --------------------------------------------------------------------------
  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    const classes = this.state.classes || [];
    stage.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.activeClassIndex === idx);
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();
      const forVal = Number(cls.forza || 10);
      const desVal = Number(cls.destrezza || 10);
      const intVal = Number(cls.intelligenza || 10);

      return `
        <div id="coverflow-card-${idx}" data-faction="${pol}" onclick="Rules2Wizard.selectClassByIndex(${idx})" class="coverflow-card ${isSelected ? 'selected' : ''}">
          <div class="relative">
            <img src="${cls.mediaUrl}" class="coverflow-card-img" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            <span class="absolute top-2 left-2 item-card-badge">${pol.toUpperCase()}</span>
            <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 font-mono text-[10px] text-amber-300 font-bold">❤️ ${cls.pv} PV</span>
          </div>

          <div class="coverflow-card-body">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-black text-white">${cls.emoji || '🥋'} ${cls.nome}</h4>
              ${isSelected ? '<span class="badge badge-xs badge-info font-black">ATTIVO</span>' : ''}
            </div>

            <div class="grid grid-cols-3 gap-1 text-center font-mono my-2 text-[10px]">
              <div class="bg-black/40 rounded p-1 border border-white/5">FOR <b>${forVal}</b></div>
              <div class="bg-black/40 rounded p-1 border border-white/5">DES <b>${desVal}</b></div>
              <div class="bg-black/40 rounded p-1 border border-white/5">INT <b>${intVal}</b></div>
            </div>

            <p class="text-[10.5px] text-slate-300 leading-snug line-clamp-2">${cls.descrizione || cls.testo || ''}</p>

            <div class="mt-2 pt-1.5 border-t border-white/10 text-[9.5px] text-slate-400 flex items-center justify-between">
              <span class="truncate">🎒 <b>${cls.equipLoot || 'Pugni nudi'}</b></span>
              <span class="font-mono text-amber-300 font-bold">🟡 ${cls.oro} ORO</span>
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

  coverflowNext: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    const nextIdx = (this.state.activeClassIndex + 1) % total;
    this.selectClassByIndex(nextIdx);
  },

  coverflowPrev: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    const prevIdx = (this.state.activeClassIndex - 1 + total) % total;
    this.selectClassByIndex(prevIdx);
  },

  renderClassesList: function() {
    const container = document.getElementById("wizard-classes-list-container");
    if (!container) return;

    const classes = this.state.classes || [];
    container.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.chosenClass?.id === cls.id);
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();

      return `
        <div onclick="Rules2Wizard.selectClassByIndex(${idx})" class="p-3.5 rounded-2xl bg-slate-900 border transition-all ${isSelected ? 'border-sky-400 bg-sky-950/30' : 'border-white/10'} flex items-center justify-between cursor-pointer">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-xl shrink-0">
              ${cls.emoji || '🥋'}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-bold text-white truncate">${cls.nome}</h4>
                <span class="badge badge-xs ${pol === 'destra' ? 'badge-info' : 'badge-error'} font-mono uppercase text-[8px]">${pol}</span>
              </div>
              <div class="text-[10px] font-mono text-sky-300 mt-0.5">❤️ ${cls.pv} PV • FOR ${cls.forza} · DES ${cls.destrezza} · INT ${cls.intelligenza}</div>
            </div>
          </div>
          <button class="btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline border-white/20 text-slate-300'} font-bold shrink-0 ml-2">
            ${isSelected ? 'Scelto ✓' : 'Scegli'}
          </button>
        </div>
      `;
    }).join("");
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ & TALENTI CLANDESTINI (BUDGET 100 PX)
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
    } else {
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
        <div id="abilities-card-${idx}" onclick="Rules2Wizard.toggleAbility('${abl.id}')" class="coverflow-card ${isSelected ? 'selected' : ''}">
          <div class="p-4 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col justify-between h-[230px]">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="badge badge-xs badge-info font-black text-[9px] uppercase">${abl.categoria || 'Talento'}</span>
                <span class="font-mono text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">${abl.costoPX || 100} PX</span>
              </div>
              <div class="text-3xl my-2 text-center">${abl.emoji || '⚡'}</div>
              <h4 class="text-xs font-black text-white text-center">${abl.nome}</h4>
              <div class="text-[10px] text-slate-300 text-center mt-1 leading-snug line-clamp-3">${perkText}</div>
            </div>
            <button class="btn btn-xs ${isSelected ? 'btn-warning text-black' : (isCompatible ? 'btn-primary' : 'btn-disabled')} font-bold w-full mt-2">
              ${isSelected ? 'Appreso ✓ (Rimuovi)' : (isCompatible ? '+ Apprendi Talento' : '🔒 Incompatibile')}
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

  renderAbilitiesList: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    if (!grid) return;

    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    grid.innerHTML = this.state.abilities.map(abl => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);

      return `
        <div class="p-3.5 rounded-2xl bg-slate-900 border transition-all ${isSelected ? 'border-amber-400 bg-amber-950/20' : 'border-white/10'} flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-slate-800 border ${isSelected ? 'border-amber-400' : 'border-white/10'} flex items-center justify-center text-xl shrink-0">
              ${abl.emoji || '⚡'}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs font-bold text-white">${abl.nome}</h4>
                <span class="badge badge-xs badge-warning font-mono font-bold">${abl.costoPX || 100} PX</span>
              </div>
              <p class="text-[10.5px] text-slate-300 leading-snug mt-0.5">${abl.descrizione || ''}</p>
            </div>
          </div>
          <button onclick="Rules2Wizard.toggleAbility('${abl.id}')" class="btn btn-xs ${isSelected ? 'btn-warning text-black font-black' : (isCompatible ? 'btn-outline border-white/20 text-slate-300' : 'btn-disabled')} shrink-0 px-3">
            ${isSelected ? 'Appreso ✓' : (isCompatible ? 'Acquista' : '🔒')}
          </button>
        </div>
      `;
    }).join("");
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

  cylinderAbilitiesNext: function() {
    const total = (this.state.abilities || []).length;
    if (total <= 1) return;
    this.state.activeAbilityIndex = (this.state.activeAbilityIndex + 1) % total;
    this.scrollToCard('wizard-abilities-stage', this.state.activeAbilityIndex);
  },

  cylinderAbilitiesPrev: function() {
    const total = (this.state.abilities || []).length;
    if (total <= 1) return;
    this.state.activeAbilityIndex = (this.state.activeAbilityIndex - 1 + total) % total;
    this.scrollToCard('wizard-abilities-stage', this.state.activeAbilityIndex);
  },

  // --------------------------------------------------------------------------
  // STEP 3: MERCATO NERO DI CICCIO (ORO REALE & CONTRATTI)
  // --------------------------------------------------------------------------
  renderStep3: function() {
    this.syncGold();
    this.filterShop(this.state.shopCategory || "ARMI");
  },

  filterShop: function(cat) {
    this.syncGold();
    this.state.shopCategory = cat;
    const is3D = (this.state.globalViewMode === "3d");

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(cat.toUpperCase());
        btn.classList.toggle("active", isAct);
      });
    }

    const v3D = document.getElementById("wizard-shop-view-3d");
    const vList = document.getElementById("wizard-shop-view-list");
    if (v3D) v3D.classList.toggle("hidden", !is3D);
    if (vList) vList.classList.toggle("hidden", is3D);

    if (is3D) {
      this.renderShop3D();
    } else {
      this.renderShopList();
    }

    this.updateBackpackSummary();
  },

  renderShop3D: function() {
    const stage = document.getElementById("wizard-shop-stage");
    const dotsBox = document.getElementById("wizard-shop-dots");
    if (!stage) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);

    stage.innerHTML = filtered.map((it, idx) => {
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const canAfford = (this.state.currentGold >= price);
      const cartCount = (this.state.boughtItems || []).filter(b => b.id === it.id || b.nome === it.nome).length;

      return `
        <div id="shop-card-${idx}" class="coverflow-card ${cartCount > 0 ? 'selected' : ''}">
          <div class="p-4 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col justify-between h-[230px]">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="badge badge-xs badge-info font-black text-[9px] uppercase">${this.state.shopCategory}</span>
                <span class="font-mono text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">${price} 🟡</span>
              </div>
              <div class="text-3xl my-2 text-center">${it.emoji || '📦'}</div>
              <h4 class="text-xs font-black text-white text-center">${it.nome}</h4>
              <p class="text-[10.5px] text-slate-300 text-center mt-1 leading-snug line-clamp-2">${it.descrizione || it.testo || ''}</p>
            </div>
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-disabled opacity-40'} w-full mt-2" ${!canAfford ? 'disabled' : ''}>
              ${cartCount > 0 ? `Nello Zaino (${cartCount}) +` : `Compra (${price} 🟡)`}
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

    this.syncLiveHUD();
  },

  renderShopList: function() {
    const container = document.getElementById("wizard-shop-grid");
    if (!container) return;

    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    container.innerHTML = filtered.map(it => {
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const canAfford = (this.state.currentGold >= price);
      const inBag = (this.state.boughtItems || []).filter(b => b.id === it.id || b.nome === it.nome).length;

      return `
        <div class="p-3.5 rounded-2xl bg-slate-900 border ${inBag > 0 ? 'border-amber-400 bg-amber-950/10' : 'border-white/10'} flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-xl shrink-0">
              ${it.emoji || '📦'}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-xs text-white">${it.nome}</span>
                ${inBag > 0 ? `<span class="badge badge-xs badge-warning font-mono font-bold">x${inBag}</span>` : ''}
              </div>
              <div class="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">${it.descrizione || ''}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-mono text-xs font-bold text-amber-300">${price} 🟡</span>
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-disabled opacity-40'} px-3" ${!canAfford ? 'disabled' : ''}>
              Compra
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  cylinderShopNext: function() {
    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const total = filtered.length;
    if (total <= 1) return;
    this.state.activeShopIndex = (this.state.activeShopIndex + 1) % total;
    this.scrollToCard('wizard-shop-stage', this.state.activeShopIndex);
  },

  cylinderShopPrev: function() {
    const filtered = (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
    const total = filtered.length;
    if (total <= 1) return;
    this.state.activeShopIndex = (this.state.activeShopIndex - 1 + total) % total;
    this.scrollToCard('wizard-shop-stage', this.state.activeShopIndex);
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
    wizardNotify(`${item.nome} inserito nello zaino!`, "success");

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
    wizardNotify("Zaino svuotato e oro ripristinato.", "info");
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
  // STEP 4: LANCIO EROE & STATISTICHE FINALI
  // --------------------------------------------------------------------------
  renderStep4: function() {
    this.syncGold();
    const cls = this.state.chosenClass;
    if (!cls) return;

    const pol = String(cls.sottocategoria || 'Destra').toLowerCase();
    const heroName = this.state.heroName || AppState.user?.nome || AppState.user?.first_name || "Avventuriero";
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
      <div class="wizard-single-header">
        <div>
          <span class="wizard-step-badge">4/4</span>
          <h3 class="wizard-step-title">Battesimo dell'Agente</h3>
        </div>
        <span class="text-xs font-mono text-emerald-400 font-bold">✨ Pronto al Duello</span>
      </div>

      <div class="space-y-4">
        <!-- Input Nome Eroe -->
        <div class="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider block">Nome dell'Eroe nella Darsena</label>
            <button onclick="Rules2Wizard.randomizeHeroName()" class="text-[10px] text-amber-300 font-mono hover:underline flex items-center gap-1">
              🎲 Nome Casuale
            </button>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 rounded-xl bg-slate-800 border border-sky-400/40 flex items-center justify-center text-xl shrink-0">
              ${cls.emoji || '🥋'}
            </div>
            <input id="wizard-hero-name-input" type="text" value="${heroName}" oninput="Rules2Wizard.updateHeroName(this.value)" class="input input-bordered input-sm w-full bg-slate-950 text-white font-bold text-sm focus:border-sky-400">
          </div>
        </div>

        <!-- Scheda Riassuntiva Finale -->
        <div class="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950/30 to-slate-950 border border-sky-400/40 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-slate-800 border border-sky-400 flex items-center justify-center text-2xl">
                ${cls.emoji || '🥋'}
              </div>
              <div>
                <span class="text-[9px] font-mono text-sky-400 font-bold uppercase tracking-wider">${pol}</span>
                <h4 class="font-black text-sm text-white" id="recap-hero-title">${heroName} • ${cls.nome}</h4>
                <div class="text-[11px] font-mono text-slate-300 mt-0.5">❤️ <b>${totPV}</b> PV • 💰 <b>${this.state.currentGold}</b> 🟡 Oro</div>
              </div>
            </div>
            <button onclick="Rules2Wizard.goToStep(1)" class="btn btn-xs btn-outline border-white/20 text-slate-300 font-bold">
              Modifica ✎
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center font-mono">
            <div class="p-2.5 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[9px] text-slate-400 font-bold">FORZA</div>
              <div class="text-base font-black text-white">${effFor}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[9px] text-slate-400 font-bold">DESTREZZA</div>
              <div class="text-base font-black text-white">${effDes}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-black/50 border border-white/10">
              <div class="text-[9px] text-slate-400 font-bold">INTELLIGENZA</div>
              <div class="text-base font-black text-white">${effInt}</div>
            </div>
          </div>

          <div class="space-y-2 text-xs">
            <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5">
              <div class="text-[10px] font-mono text-amber-300 font-bold uppercase mb-1">Talenti (${this.state.chosenAbilities.length})</div>
              <div class="flex flex-wrap gap-1">
                ${this.state.chosenAbilities.map(id => {
                  const a = this.state.abilities.find(x => x.id === id);
                  return `<span class="badge badge-xs badge-warning font-bold">${a ? a.nome : id}</span>`;
                }).join('') || '<span class="text-slate-500 italic">Nessun talento attivo</span>'}
              </div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5">
              <div class="text-[10px] font-mono text-sky-300 font-bold uppercase mb-1">Dotazione Spalla</div>
              <div class="text-slate-300">${[startingGear, ...this.state.boughtItems.map(i => i.nome)].filter(Boolean).join(", ")}</div>
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
