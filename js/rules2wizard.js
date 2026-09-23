// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2wizard.js (VERSIONE 25.5 - UNIFIED MOVERINA & DECISIONAL SLOT)
// LAYER: WIZARD FULL-STAGE, 48px FULL-HUD, ZERO-FONDINO, 44px STEPPER-DOCK
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

function Rules2_FormatMod(val) {
  const num = Number(val || 10);
  const mod = Math.floor((num - 10) / 2);
  return (mod >= 0 ? "+" : "") + mod;
}

function Rules2_FormatHumanEffect(rawEffect, faction = "") {
  if (!rawEffect || rawEffect === "—" || rawEffect === "-") return "Nessuna proprietà speciale.";
  const tags = String(rawEffect).split(/[,|]/);
  const out = [];

  for (let t of tags) {
    const tag = t.trim();
    if (!tag || tag === "—") continue;

    if (tag === "TASTO:ZOMBI_ABILITA") out.push("🧟 <b>Necromanzia:</b> Costa 1 PV per rianimare un nemico come Zombi (Danno x2).");
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Usa 1 dose di droga per rianimare uno Zombi.");
    else if (tag === "CLASSE:Destra") out.push("⚖️ <b>Orientamento Destra:</b> +1 Danno fisso vs Mazzu e Ideologi.");
    else if (tag === "CLASSE:Sinistra") out.push("⚖️ <b>Orientamento Sinistra:</b> +1 Danno fisso vs Camorristi e Burocrati.");
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 costante a tutti i tiri D20 ed Eventi.");
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT contro la fazione ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente sull'inchiesta.");
    else if (tag.startsWith("SINTESI:")) out.push(`⚗️ <b>Laboratorio:</b> Sintetizza sostanze (${tag.replace("SINTESI:", "")}).`);
    else if (tag.startsWith("PASSIVO:INGREDIENTE_")) out.push("🧪 <b>Materia Prima:</b> Reagente chimico.");
    else if (tag.startsWith("PASSIVO:OGGETTO_")) out.push("🧰 <b>Strumento Speciale:</b> Sblocca varchi o controlli correlati.");
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
  } else {
    alert(msg);
  }
}

// ----------------------------------------------------------------------------
// 2. STORE CLIENT-SIDE (CACHE DATI WIZARD)
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
// 3. WIZARD CREAZIONE PERSONAGGIO (MOVERINA 5 FASCE & SLOT DECISIONALE)
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
    this.syncLiveHUD();
  },

  setGold: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    const diff = num - this.state.currentGold;
    this.state.currentGold = num;
    this.state.startingGold += diff;
    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.setGold === "function") {
      Rules2Engine.setGold(num);
    }
    this.syncLiveHUD();
    if (this.state.step === 3) {
      this.filterShop(this.state.shopCategory);
    }
  },

  // --------------------------------------------------------------------------
  // HUD A 2 RIGHE (48px - A TUTTA LARGHEZZA, A FILO DELLO STEPPER)
  // --------------------------------------------------------------------------
  syncLiveHUD: function() {
    const cls = this.state.chosenClass;
    const hudContainer = document.getElementById("wizard-live-hud");
    if (!hudContainer) return;

    const heroName = this.state.heroName || (cls ? cls.nome : "Avventuriero");
    const avatarEmoji = cls ? (cls.emoji || "🥋") : "🥋";
    
    let effFor = cls ? Number(cls.forza || 10) : 10;
    let effDes = cls ? Number(cls.destrezza || 10) : 10;
    let effInt = cls ? Number(cls.intelligenza || 10) : 10;
    let maxPV = cls ? Number(cls.pv || 25) : 25;

    this.state.boughtItems.forEach(item => {
      if (item.forza) effFor += Number(item.forza);
      if (item.destrezza) effDes += Number(item.destrezza);
      if (item.intelligenza) effInt += Number(item.intelligenza);
      if (item.pv) maxPV += Number(item.pv);
    });

    const forMod = Rules2_FormatMod(effFor);
    const desMod = Rules2_FormatMod(effDes);
    const intMod = Rules2_FormatMod(effInt);

    // Larghezza 100% identica alla colonna madre
    hudContainer.className = "hud-cockpit-48px w-full p-2 rounded-xl bg-slate-900/90 border border-white/10 shadow-lg mb-1";
    hudContainer.innerHTML = `
      <!-- RIGA 1: NOME LUNGO FLESSIBILE A SX & RISORSE BLOCCATE A DX -->
      <div class="flex items-center justify-between w-full min-w-0 leading-none">
        <div class="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
          <span class="text-sm shrink-0">${avatarEmoji}</span>
          <span class="text-xs font-black text-white truncate max-w-[170px]">${heroName}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
          <span class="text-sky-300 font-bold">✨ ${this.state.remainingPx} PX</span>
          <span class="text-amber-300 font-bold">🟡 ${this.state.currentGold} ORO</span>
        </div>
      </div>

      <!-- RIGA 2: VITALI GRADIENTE & STATISTICHE D20 TRA PARENTESI -->
      <div class="flex items-center justify-between w-full pt-1.5 mt-1 border-t border-white/5 text-[10px] font-mono leading-none">
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-rose-400">❤️</span>
          <div class="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-emerald-500 to-sky-400" style="width: 100%;"></div>
          </div>
          <span class="text-rose-300 font-bold">${maxPV}/${maxPV}</span>
        </div>
        <div class="text-slate-300 tracking-tight text-right shrink-0">
          🥊 ${effFor} (${forMod}) · 🤸 ${effDes} (${desMod}) · 🧠 ${effInt} (${intMod})
        </div>
      </div>
    `;
  },

  // --------------------------------------------------------------------------
  // FOOTER INTEGRATO: "STEPPER-DOCK" (44px)
  // --------------------------------------------------------------------------
  updateStepperDock: function(stepNum) {
    const footerDock = document.getElementById("main-wizard-footer");
    if (!footerDock) return;

    let ctaLabel = "AVANZA ›";
    let ctaAction = `Rules2Wizard.nextStep(${stepNum + 1})`;

    if (stepNum === 1) {
      ctaLabel = "SCEGLI CLASSE ›";
      ctaAction = "Rules2Wizard.confirmStep1()";
    } else if (stepNum === 2) {
      ctaLabel = "ALL'EMPORIO ›";
      ctaAction = "Rules2Wizard.confirmStep2()";
    } else if (stepNum === 3) {
      ctaLabel = this.state.isVeteran ? `INIZIA EP. ${this.state.episodio} 🚀` : "AL BATTESIMO ›";
      ctaAction = this.state.isVeteran ? "Rules2Wizard.finalizeHero()" : "Rules2Wizard.nextStep(4)";
    } else if (stepNum === 4) {
      ctaLabel = "LANCIA EROE 🚀";
      ctaAction = "Rules2Wizard.finalizeHero()";
    }

    footerDock.className = "wizard-sticky-footer flex items-center justify-between px-3 bg-[#070A12]/95 border-t border-white/10 z-40";
    footerDock.innerHTML = `
      <div class="flex items-center justify-between w-full h-full text-xs font-mono">
        <!-- Sinistra: Tasto Indietro discreto -->
        <button onclick="Rules2Wizard.prevStep(${stepNum - 1})" class="btn btn-xs btn-ghost text-slate-400 ${stepNum === 1 ? 'invisible pointer-events-none' : ''} px-2">
          ‹ Indietro
        </button>

        <!-- Centro: Nodi di Avanzamento compatti -->
        <div class="flex items-center gap-1.5">
          ${[1, 2, 3, 4].map(n => `
            <div onclick="Rules2Wizard.goToStep(${n})" class="flex items-center gap-1 cursor-pointer ${n === stepNum ? 'opacity-100' : 'opacity-40'}">
              <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${n === stepNum ? 'bg-sky-400 text-slate-950 shadow-md' : (n < stepNum ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300')}">${n}</span>
              ${n < 4 ? '<span class="text-slate-600 text-[10px]">—</span>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Destra: Tasto Avanzamento Primario -->
        <button onclick="${ctaAction}" class="btn btn-xs btn-primary font-black uppercase tracking-wider px-3 h-[32px] min-h-[32px] shadow-lg">
          ${ctaLabel}
        </button>
      </div>
    `;
  },

  // --------------------------------------------------------------------------
  // SINCRONIZZAZIONE SERVER-SIDE STEP WIZARD
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // APERTURA E RIPRISTINO SESSIONE DA SERVER
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
    if (s < 1) return;
    this.showStep(s);
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
  },

  showStep: function(stepNum) {
    this.state.step = stepNum;
    this.syncLiveHUD();
    this.updateFooterDock(stepNum);

    [1, 2, 3, 4].forEach(n => {
      const panel = document.getElementById(`wizard-step-${n === 1 ? 'class' : n === 2 ? 'abilities' : n === 3 ? 'shop' : 'name'}`);
      if (panel) panel.classList.toggle("hidden", n !== stepNum);
    });

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  // --------------------------------------------------------------------------
  // CAROSELLO INFINITO & NAVIGAZIONE FLUTTUANTE CON FRECCE (‹ e ›)
  // --------------------------------------------------------------------------
  scrollToIndex: function(stageId, index, cardWidth = 316) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    stage.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  },

  getFilteredClasses: function() {
    let classes = this.state.classes || [];
    const filter = this.state.classFactionFilter || "tutte";
    if (filter !== "tutte") {
      classes = classes.filter(c => String(c.sottocategoria || "").toLowerCase() === filter.toLowerCase());
    }
    return classes;
  },

  getFilteredAbilities: function() {
    let abilities = this.state.abilities || [];
    const filter = this.state.abilityCategoryFilter || "tutti";
    if (filter !== "tutti") {
      abilities = abilities.filter(a => String(a.categoria || "").toLowerCase() === filter.toLowerCase());
    }
    return abilities;
  },

  getFilteredShopItems: function() {
    return (this.state.shopCatalog || []).filter(i => Rules2_ClassifyEntity(i) === this.state.shopCategory);
  },

  navigateInfiniteCards: function(step, direction) {
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();

    if (step === 1) {
      const list = this.getFilteredClasses();
      if (list.length <= 1) return;
      const nextIdx = (this.state.activeClassIndex + direction + list.length) % list.length;
      this.selectClassByIndex(nextIdx);
    } else if (step === 2) {
      const list = this.getFilteredAbilities();
      if (list.length <= 1) return;
      const nextIdx = (this.state.activeAbilityIndex + direction + list.length) % list.length;
      this.selectAbilityByIndex(nextIdx);
    } else if (step === 3) {
      const list = this.getFilteredShopItems();
      if (list.length <= 1) return;
      const nextIdx = (this.state.activeShopIndex + direction + list.length) % list.length;
      this.selectShopItemByIndex(nextIdx);
    }
  },

  // --------------------------------------------------------------------------
  // STEP 1: SCELTA CLASSE (MOVERINA 5 FASCE - ZERO FONDINO, IMMAGINE A TOP:0)
  // --------------------------------------------------------------------------
  setClassFactionFilter: function(faction) {
    this.state.classFactionFilter = faction;
    this.state.activeClassIndex = 0;
    this.renderStep1();
  },

  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    if (!stage) return;

    let classes = this.getFilteredClasses();
    const filter = this.state.classFactionFilter || "tutte";

    // Iniezione Micro-Chip compatti sotto l'HUD
    let filterBar = document.getElementById("wizard-class-faction-chips");
    if (!filterBar) {
      const parentPanel = document.getElementById("wizard-step-class");
      if (parentPanel) {
        filterBar = document.createElement("div");
        filterBar.id = "wizard-class-faction-chips";
        filterBar.className = "chips-scroll-bar flex gap-1.5 overflow-x-auto py-1 mb-1 justify-center";
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

    // Iniezione frecce fluttuanti nel container esterno
    const outerStage = stage.closest(".coverflow-stage-outer");
    if (outerStage && !document.getElementById("arrows-step-1")) {
      const arrowWrap = document.createElement("div");
      arrowWrap.id = "arrows-step-1";
      arrowWrap.className = "absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30";
      arrowWrap.innerHTML = `
        <button onclick="Rules2Wizard.navigateInfiniteCards(1, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
        <button onclick="Rules2Wizard.navigateInfiniteCards(1, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
      `;
      outerStage.appendChild(arrowWrap);
    }

    // Render Carte Moverina: L'immagine tocca il bordo superiore, testata in sovraimpressione
    stage.innerHTML = classes.map((cls, idx) => {
      const isSelected = (this.state.activeClassIndex === idx);
      const pol = String(cls.sottocategoria || "Destra").toLowerCase();
      const forVal = Number(cls.forza || 10);
      const desVal = Number(cls.destrezza || 10);
      const intVal = Number(cls.intelligenza || 10);
      const startingLoot = cls.equipLoot || "Pugni nudi";

      return `
        <div id="class-card-${idx}" onclick="Rules2Wizard.selectClassByIndex(${idx})" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
          <!-- FASCIA 2: Media a tutto campo superiore (da Y=0 della carta) -->
          <div class="tcg-card-media">
            <!-- FASCIA 1: Testata Fluttuante Trasparente in Sovraimpressione -->
            <div class="tcg-card-header">
              <h4 class="tcg-card-title">${cls.emoji || '🥋'} ${cls.nome}</h4>
              <span class="tcg-card-faction-badge ${pol}">${pol.toUpperCase()}</span>
            </div>
            
            <img src="${cls.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
            
            ${(cls.citazione && cls.citazione !== "—") ? `
              <div class="tcg-card-quote-overlay">
                <div class="tcg-card-quote-text">“${cls.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                <div class="tcg-card-quote-author">${cls.autoreCitazione || 'LA FAZIONE'}</div>
              </div>
            ` : ''}
          </div>

          <!-- FASCIA 3: Piastra Statistiche con Modificatori D20 -->
          <div class="tcg-stats-plate">
            <span>🥊 FOR <b>${forVal}</b> (${Rules2_FormatMod(forVal)})</span>
            <span>🤸 DES <b>${desVal}</b> (${Rules2_FormatMod(desVal)})</span>
            <span>🧠 INT <b>${intVal}</b> (${Rules2_FormatMod(intVal)})</span>
          </div>

          <!-- FASCIA 4: Descrizione Narrativa (Fino a 8-9 righe distese) -->
          <p class="tcg-card-desc">${cls.descrizione || cls.testo || ''}</p>

          <!-- FASCIA 5: Piede Scheda con Dotazione, PV e Oro (Pura Vetrina, Zero Bottoni) -->
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

    // Slot Azione Decisionale sottostante alla carta
    let actionSlot = document.getElementById("wizard-action-slot-step-1");
    if (!actionSlot) {
      actionSlot = document.createElement("div");
      actionSlot.id = "wizard-action-slot-step-1";
      actionSlot.className = "scene-actions-area";
      outerStage.parentNode.insertBefore(actionSlot, outerStage.nextSibling);
    }
    const currentClass = classes[this.state.activeClassIndex] || classes[0];
    actionSlot.innerHTML = `
      <div class="actions-grid-1">
        <button onclick="Rules2Wizard.confirmStep1()" class="scene-action-btn font-black text-xs">
          <span>Scegli Classe: <b>${currentClass ? currentClass.nome : 'Avventuriero'}</b></span>
          <span>›</span>
        </button>
      </div>
    `;

    this.syncLiveHUD();
  },

  selectClassByIndex: function(idx) {
    this.state.activeClassIndex = idx;
    const list = this.getFilteredClasses();
    this.state.chosenClass = list[idx] || this.state.classes[idx];

    if (!this.state.isVeteran && this.state.chosenClass) {
      this.state.startingGold = Number(this.state.chosenClass.oro || 40);
      this.state.currentGold = this.state.startingGold;
      this.syncGold();
    }

    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
    this.renderStep1();
    this.scrollToIndex('wizard-classes-stage', idx);
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ & TALENTI (TESTO NARRATIVO + EFFETTO + SLOT SPESA ESTERNO)
  // --------------------------------------------------------------------------
  setAbilityCategoryFilter: function(cat) {
    this.state.abilityCategoryFilter = cat;
    this.state.activeAbilityIndex = 0;
    this.renderStep2();
  },

  renderStep2: function() {
    const stage = document.getElementById("wizard-abilities-stage");
    if (!stage) return;

    let abilities = this.getFilteredAbilities();
    const filter = this.state.abilityCategoryFilter || "tutti";
    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    // Micro-Chip compatti
    let filterBar = document.getElementById("wizard-abilities-filter-chips");
    if (!filterBar) {
      const parentPanel = document.getElementById("wizard-step-abilities");
      if (parentPanel) {
        filterBar = document.createElement("div");
        filterBar.id = "wizard-abilities-filter-chips";
        filterBar.className = "chips-scroll-bar flex gap-1.5 overflow-x-auto py-1 mb-1 justify-center";
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

    // Frecce fluttuanti
    const outerStage = stage.closest(".coverflow-stage-outer");
    if (outerStage && !document.getElementById("arrows-step-2")) {
      const arrowWrap = document.createElement("div");
      arrowWrap.id = "arrows-step-2";
      arrowWrap.className = "absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30";
      arrowWrap.innerHTML = `
        <button onclick="Rules2Wizard.navigateInfiniteCards(2, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
        <button onclick="Rules2Wizard.navigateInfiniteCards(2, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
      `;
      outerStage.appendChild(arrowWrap);
    }

    stage.innerHTML = abilities.map((abl, idx) => {
      // 🔒 Alone bianco platino sull'indice della carta attiva al centro!
      const isSelected = (this.state.activeAbilityIndex === idx);
      const isLearned = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);
      const perkText = Rules2_FormatHumanEffect(abl.requisitiCodificati || abl.effettoCodificato, userFaction);
      const loreText = abl.descrizione || abl.testo || "";

      return `
        <div id="abilities-card-${idx}" onclick="Rules2Wizard.selectAbilityByIndex(${idx})" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
          <!-- FASCIA 2: Media a Schermo Pieno con Testata Sovrimpressa -->
          <div class="tcg-card-media">
            <!-- FASCIA 1: Testata Fluttuante Trasparente -->
            <div class="tcg-card-header">
              <h4 class="tcg-card-title">${abl.emoji || '⚡'} ${abl.nome}</h4>
              <span class="tcg-card-faction-badge ${isCompatible ? 'destra' : 'sinistra'}">${(abl.categoria || 'Talento').toUpperCase()}</span>
            </div>

            ${abl.mediaUrl ? `<img src="${abl.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(abl.nome)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-black text-6xl drop-shadow(0 0 10px rgba(56,189,248,0.5))">${abl.emoji || '⚡'}</div>`}
            
            <div class="tcg-card-quote-overlay">
              <div class="tcg-card-quote-text">“${abl.citazione || 'La disciplina del molo non ammette errori.'}”</div>
              <div class="tcg-card-quote-author">${abl.autoreCitazione || 'IL VETERANO'}</div>
            </div>
          </div>

          <!-- FASCIA 3: Piastra Requisiti & Costo -->
          <div class="tcg-stats-plate">
            <span>✨ <b>${abl.costoPX || 100} PX</b></span>
            <span>🎯 <b>${isCompatible ? 'Compatibile' : 'Vincolato'}</b></span>
            <span>⚡ <b>${isLearned ? 'Appreso ✓' : 'Disponibile'}</b></span>
          </div>

          <!-- FASCIA 4: Testo Narrativo + Effetto Meccanico Codificato -->
          <div class="tcg-card-desc">
            ${loreText ? `<p class="mb-1 text-slate-300 leading-snug">${loreText}</p>` : ''}
            <div class="text-[11px] text-sky-300 font-bold">${perkText}</div>
          </div>

          <!-- FASCIA 5: Piede Scheda di Sola Lettura (Zero Bottoni Spremuti) -->
          <div class="tcg-card-footer">
            <div class="tcg-card-loot">${abl.sottocategoria || 'Abilità'}</div>
            <div class="tcg-card-vitals">
              <span class="badge badge-xs ${isLearned ? 'badge-warning text-black font-black' : 'badge-ghost text-slate-400 font-bold'}">
                ${isLearned ? 'IN USO' : 'DISPONIBILE'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Slot Decisionale di Spesa sotto la carta
    let actionSlot = document.getElementById("wizard-action-slot-step-2");
    if (!actionSlot) {
      actionSlot = document.createElement("div");
      actionSlot.id = "wizard-action-slot-step-2";
      actionSlot.className = "scene-actions-area";
      outerStage.parentNode.insertBefore(actionSlot, outerStage.nextSibling);
    }

    const currentAbl = abilities[this.state.activeAbilityIndex] || abilities[0];
    if (currentAbl) {
      const isLearned = this.state.chosenAbilities.includes(currentAbl.id);
      const cost = Number(currentAbl.costoPX || 100);
      const canAfford = (this.state.remainingPx >= cost);
      const req = String(currentAbl.requisitiCodificati || currentAbl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);

      let btnHtml = "";
      if (isLearned) {
        btnHtml = `
          <button onclick="Rules2Wizard.toggleAbility('${currentAbl.id}')" class="scene-action-btn border-amber-400/50 text-amber-300 font-black justify-between">
            <span>✓ TALENTO APPRESO</span>
            <span class="text-[10px] font-normal underline">Rimborsa +${cost} PX</span>
          </button>
        `;
      } else if (!isCompatible) {
        btnHtml = `
          <button disabled class="scene-action-btn opacity-40 justify-center text-slate-400 cursor-not-allowed">
            🔒 VINCOLATO A ${userFaction.toUpperCase() === 'DESTRA' ? 'SINISTRA' : 'DESTRA'}
          </button>
        `;
      } else if (!canAfford) {
        btnHtml = `
          <button disabled class="scene-action-btn opacity-40 justify-center text-slate-400 cursor-not-allowed">
            🔒 PX INSUFFICIENTI (Mancano ${cost - this.state.remainingPx} PX)
          </button>
        `;
      } else {
        btnHtml = `
          <button onclick="Rules2Wizard.toggleAbility('${currentAbl.id}')" class="scene-action-btn border-sky-400 text-sky-300 font-black justify-between">
            <span>✨ APPRENDI: <b>${currentAbl.nome}</b></span>
            <span>-${cost} PX</span>
          </button>
        `;
      }
      actionSlot.innerHTML = `<div class="actions-grid-1">${btnHtml}</div>`;
    }

    this.syncLiveHUD();
  },

  selectAbilityByIndex: function(idx) {
    this.state.activeAbilityIndex = idx;
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
    this.renderStep2();
    this.scrollToIndex('wizard-abilities-stage', idx);
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
  // STEP 3: EMPORIO (MOVERINA 5 FASCE - CITAZIONE & SLOT COMPRA SOTTO)
  // --------------------------------------------------------------------------
  renderStep3: function() {
    this.syncGold();
    this.filterShop(this.state.shopCategory || "ARMI");
  },

  filterShop: function(cat) {
    this.syncGold();
    this.state.shopCategory = cat;
    this.state.activeShopIndex = 0;

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(cat.toUpperCase());
        btn.classList.toggle("active", isAct);
      });
    }

    const stage = document.getElementById("wizard-shop-stage");
    if (!stage) return;

    const filtered = this.getFilteredShopItems();

    // Frecce fluttuanti
    const outerStage = stage.closest(".coverflow-stage-outer");
    if (outerStage && !document.getElementById("arrows-step-3")) {
      const arrowWrap = document.createElement("div");
      arrowWrap.id = "arrows-step-3";
      arrowWrap.className = "absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30";
      arrowWrap.innerHTML = `
        <button onclick="Rules2Wizard.navigateInfiniteCards(3, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
        <button onclick="Rules2Wizard.navigateInfiniteCards(3, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
      `;
      outerStage.appendChild(arrowWrap);
    }

    stage.innerHTML = filtered.map((it, idx) => {
      // 🔒 Alone bianco platino sulla carta attiva
      const isSelected = (this.state.activeShopIndex === idx);
      const price = Math.abs(Number(it.costoOro || it.costo || 15));
      const inBag = (this.state.boughtItems || []).filter(b => b.id === it.id || b.nome === it.nome).length;

      return `
        <div id="shop-card-${idx}" onclick="Rules2Wizard.selectShopItemByIndex(${idx})" class="coverflow-card tcg-card relative ${isSelected ? 'selected' : ''}">
          <!-- FASCIA 2: Media a Schermo Pieno con Testata Sovrimpressa -->
          <div class="tcg-card-media">
            <!-- FASCIA 1: Testata Fluttuante Trasparente -->
            <div class="tcg-card-header">
              <h4 class="tcg-card-title">${it.emoji || '📦'} ${it.nome}</h4>
              <span class="tcg-card-faction-badge destra">${this.state.shopCategory}</span>
            </div>

            <img src="${it.mediaUrl || 'https://image.pollinations.ai/prompt/noir-black-market-item-docks?width=600&height=400&nologo=true'}" class="tcg-card-img" alt="${Rules2_SafeAttr(it.nome)}" loading="lazy">
            <div class="tcg-card-quote-overlay">
              <div class="tcg-card-quote-text">“${it.citazione || 'Fornitura pulita, nessun seriale registrato.'}”</div>
              <div class="tcg-card-quote-author">${it.autoreCitazione || 'CICCIO IL RICETTATORE'}</div>
            </div>
          </div>

          <!-- FASCIA 3: Piastra Metrica Tattica -->
          <div class="tcg-stats-plate">
            <span>💰 <b>${price} 🟡</b></span>
            <span>💥 <b>${it.danno ? '+' + it.danno : '—'}</b></span>
            <span>❤️ <b>${it.pv ? '+' + it.pv : '—'}</b></span>
          </div>

          <!-- FASCIA 4: Descrizione Tattica Distesa -->
          <p class="tcg-card-desc">${it.descrizione || it.testo || 'Nessuna specifica aggiuntiva nel registro di banchina.'}</p>

          <!-- FASCIA 5: Piede Scheda Pulito (Il bottone compra è esterno) -->
          <div class="tcg-card-footer">
            <div class="tcg-card-loot font-bold">${price} ORO</div>
            <div class="tcg-card-vitals">
              ${inBag > 0 ? `<span class="badge badge-xs badge-warning font-mono font-black">x${inBag} NELLO ZAINO</span>` : '<span class="text-slate-500 font-mono text-[10px]">NON ACQUISTATO</span>'}
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Slot Decisionale di Spesa sotto la carta Emporio
    let actionSlot = document.getElementById("wizard-action-slot-step-3");
    if (!actionSlot) {
      actionSlot = document.createElement("div");
      actionSlot.id = "wizard-action-slot-step-3";
      actionSlot.className = "scene-actions-area";
      outerStage.parentNode.insertBefore(actionSlot, outerStage.nextSibling);
    }

    const currentItem = filtered[this.state.activeShopIndex] || filtered[0];
    if (currentItem) {
      const price = Math.abs(Number(currentItem.costoOro || currentItem.costo || 15));
      const canAfford = (this.state.currentGold >= price);
      const inBag = (this.state.boughtItems || []).filter(b => b.id === currentItem.id || b.nome === currentItem.nome).length;

      let btnHtml = "";
      if (!canAfford) {
        btnHtml = `
          <button disabled class="scene-action-btn opacity-40 justify-center text-slate-400 cursor-not-allowed">
            🔒 ORO INSUFFICIENTE (Mancano ${price - this.state.currentGold} 🟡)
          </button>
        `;
      } else {
        btnHtml = `
          <button onclick="Rules2Wizard.buyItem('${currentItem.id}', ${price})" class="scene-action-btn border-amber-400/50 text-amber-300 font-black justify-between">
            <span>🛒 COMPRA: <b>${currentItem.nome}</b></span>
            <span>-${price} 🟡 ${inBag > 0 ? `(Hai: x${inBag})` : ''}</span>
          </button>
        `;
      }
      actionSlot.innerHTML = `<div class="actions-grid-1">${btnHtml}</div>`;
    }

    this.updateBackpackSummary();
    this.syncLiveHUD();
  },

  selectShopItemByIndex: function(idx) {
    this.state.activeShopIndex = idx;
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
    this.filterShop(this.state.shopCategory);
    this.scrollToIndex('wizard-shop-stage', idx);
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
    tgHaptic("selection");
    this.filterShop(this.state.shopCategory);
    wizardNotify("Zaino svuotato e oro rimborsato.", "info");
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
  // STEP 4: CONSACRAZIONE (CARTA DEFINITIVA MOVERINA DELL'EROE)
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
    let totPV = Number(cls.pv || 25);

    this.state.boughtItems.forEach(item => {
      if (item.forza) effFor += Number(item.forza);
      if (item.destrezza) effDes += Number(item.destrezza);
      if (item.intelligenza) effInt += Number(item.intelligenza);
      if (item.pv) totPV += Number(item.pv);
    });

    const container = document.getElementById("wizard-step-name");
    if (!container) return;

    // Carta Moverina definitiva dell'Eroe consacrato
    container.innerHTML = `
      <!-- Input Nome dell'Eroe -->
      <div class="p-2 rounded-xl bg-slate-900 border border-white/10 mb-2 w-full max-w-[300px] mx-auto">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[9.5px] font-mono text-sky-400 font-bold uppercase tracking-wider">Nome dell'Eroe</label>
          <button onclick="Rules2Wizard.randomizeHeroName()" class="text-[10px] text-amber-300 font-mono hover:underline flex items-center gap-1 font-bold">
            🎲 Nome da Bisca
          </button>
        </div>
        <input id="wizard-hero-name-input" type="text" value="${heroName}" oninput="Rules2Wizard.updateHeroName(this.value)" class="input input-bordered input-xs w-full bg-slate-950 text-white font-bold text-xs focus:border-sky-400">
      </div>

      <!-- LA CARTA MOVERINA CONSACRATA -->
      <div class="coverflow-card tcg-card selected max-w-[300px] mx-auto shadow-2xl">
        <!-- FASCIA 2: Media a tutto campo con Testata Sovrimpressa -->
        <div class="tcg-card-media">
          <!-- FASCIA 1: Testata Fluttuante Trasparente -->
          <div class="tcg-card-header">
            <h4 class="tcg-card-title truncate" id="final-card-title">${cls.emoji || '🥋'} ${heroName}</h4>
            <span class="tcg-card-faction-badge ${pol}">${pol.toUpperCase()}</span>
          </div>

          <img src="${cls.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(cls.nome)}">
          <div class="tcg-card-quote-overlay">
            <div class="tcg-card-quote-text">“${cls.citazione || 'Pronto a scendere sui pontili della Darsena.'}”</div>
            <div class="tcg-card-quote-author">${cls.autoreCitazione || 'CONSACRAZIONE'}</div>
          </div>
        </div>

        <!-- FASCIA 3: Piastra Statistiche con Bonus Derivati -->
        <div class="tcg-stats-plate">
          <span>🥊 FOR <b>${effFor}</b> (${Rules2_FormatMod(effFor)})</span>
          <span>🤸 DES <b>${effDes}</b> (${Rules2_FormatMod(effDes)})</span>
          <span>🧠 INT <b>${effInt}</b> (${Rules2_FormatMod(effInt)})</span>
        </div>

        <!-- FASCIA 4: Descrizione Narrativa -->
        <p class="tcg-card-desc">
          Agente consacrato di classe <b>${cls.nome}</b>. Equipaggiato per l'inchiesta con dotazione clandestina e ${this.state.chosenAbilities.length} talenti appresi.
        </p>

        <!-- FASCIA 5: Dotazione Finale e Vitali -->
        <div class="tcg-card-footer">
          <div class="tcg-card-loot truncate">🎒 ${startingGear} + ${this.state.boughtItems.length}</div>
          <div class="tcg-card-vitals">
            <span class="tcg-pv-badge">❤️ ${totPV} PV</span>
            <span class="tcg-gold-badge">🟡 ${this.state.currentGold} ORO</span>
          </div>
        </div>
      </div>

      <!-- Pulsanti di revisione discreti -->
      <div class="flex items-center justify-center gap-2 mt-2 font-mono text-[9.5px]">
        <button onclick="Rules2Wizard.goToStep(1)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Classe</button>
        <button onclick="Rules2Wizard.goToStep(2)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Talenti</button>
        <button onclick="Rules2Wizard.goToStep(3)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Emporio</button>
      </div>
    `;

    this.syncLiveHUD();
  },

  updateHeroName: function(val) {
    if (val && val.trim()) {
      this.state.heroName = val.trim();
      const title = document.getElementById("final-card-title");
      if (title && this.state.chosenClass) {
        title.textContent = `${this.state.chosenClass.emoji || '🥋'} ${this.state.heroName}`;
      }
      this.syncLiveHUD();
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
    const title = document.getElementById("final-card-title");
    if (title && this.state.chosenClass) {
      title.textContent = `${this.state.chosenClass.emoji || '🥋'} ${this.state.heroName}`;
    }
    this.syncLiveHUD();
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
// 4. ESPOSIZIONE GLOBALE
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
  wizardGoToStep: (s) => Rules2Wizard.goToStep(s),
  navigateInfiniteCards: (s, d) => Rules2Wizard.navigateInfiniteCards(s, d)
});
