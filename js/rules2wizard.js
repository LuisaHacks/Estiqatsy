// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2wizard.js (VERSIONE 34.0 - STABLE CAROUSEL, AUTO-EQUIP & MONUMENTAL STEP 4)
// LAYER: WIZARD MOUNT ENGINE, IN-PLACE UPDATES & AUTO-EQUIP PROTOCOL
// NOTE: ZERO CAROUSEL RESETS, HUMAN ITEM LOOKUP & FLAWLESS STEP 4 GEOMETRY
// ============================================================================

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
  if (!rawEffect || rawEffect === "—" || rawEffect === "-") return "";
  const tags = String(rawEffect).split(/[,|]/);
  const out = [];

  for (let t of tags) {
    const tag = t.trim();
    if (!tag || tag === "—") continue;

    if (tag === "TASTO:ZOMBI_ABILITA") out.push("🧟 <b>Necromanzia:</b> Costa 1 PV per rianimare un nemico come Zombi (Danno x2).");
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Usa 1 dose di droga per rianimare uno Zombi.");
    else if (tag.startsWith("CLASSE:")) out.push(`⚖️ <b>Affinità ${tag.replace("CLASSE:", "")}:</b> Bonus fazione attivo.`);
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 costante a tutti i tiri D20 ed Eventi.");
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT contro ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente sull'inchiesta.");
    else if (tag.startsWith("SINTESI:")) out.push(`⚗️ <b>Laboratorio:</b> Sintetizza sostanze (${tag.replace("SINTESI:", "")}).`);
    else if (tag.startsWith("PASSIVO:INGREDIENTE_")) out.push("🧪 <b>Materia Prima:</b> Reagente per sintesi.");
    else if (tag.startsWith("PASSIVO:OGGETTO_")) out.push("🧰 <b>Strumento Speciale:</b> Sblocca varchi o controlli correlati.");
    else out.push(`⚡ <b>Proprietà:</b> ${tag.replace(/_/g, " ")}`);
  }

  return out.join("<br>");
}

function Rules2_SafeAttr(str) {
  if (!str) return "";
  return String(str).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

function Rules2_ResolveItemName(idOrName, catalog = []) {
  if (!idOrName || idOrName === "—" || idOrName === "-") return "";
  const clean = String(idOrName).trim();
  const list = catalog.length > 0 ? catalog : (typeof Rules2Wizard !== "undefined" ? Rules2Wizard.state.shopCatalog : []);
  const found = list.find(x => x.id === clean || x.nome?.toLowerCase() === clean.toLowerCase());
  if (found) {
    const emoji = (found.emoji && found.emoji !== "—" && found.emoji !== "-") ? found.emoji + " " : "";
    return emoji + found.nome;
  }
  return clean;
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
    this.updateShopActionSlot();
  },

  syncLiveHUD: function() {
    const cls = this.state.chosenClass;
    const hudContainer = document.getElementById("wizard-live-hud");
    if (!hudContainer) return;

    const heroName = this.state.heroName || (cls ? cls.nome : "Avventuriero");
    const avatarEmoji = cls ? (cls.emoji || "👤") : "👤";
    
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

    hudContainer.className = "hud-cockpit-48px";
    hudContainer.innerHTML = `
      <div class="flex items-center justify-between w-full min-w-0 leading-none">
        <div class="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
          <span class="text-sm shrink-0">${avatarEmoji}</span>
          <span class="text-xs font-black text-white truncate max-w-[130px]">${heroName}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
          <span class="text-sky-300 font-bold whitespace-nowrap">✨ ${this.state.remainingPx} PX</span>
          <span class="text-amber-300 font-bold whitespace-nowrap">🟡 ${this.state.currentGold} ORO</span>
        </div>
      </div>

      <div class="flex items-center justify-between w-full pt-1 mt-0.5 border-t border-white/5 text-[9.5px] font-mono leading-none">
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

  updateFooterDock: function(stepNum) {
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
      <div class="wizard-footer-step-controls">
        <button onclick="Rules2Wizard.prevStep(${stepNum - 1})" class="btn btn-xs btn-ghost text-slate-400 ${stepNum === 1 ? 'invisible pointer-events-none' : ''} px-2">
          ‹ Indietro
        </button>

        <div class="flex items-center gap-1.5">
          ${[1, 2, 3, 4].map(n => `
            <div onclick="Rules2Wizard.goToStep(${n})" class="flex items-center gap-1 cursor-pointer ${n === stepNum ? 'opacity-100' : 'opacity-40'}">
              <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${n === stepNum ? 'bg-sky-400 text-slate-950 shadow-md' : (n < stepNum ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300')}">${n}</span>
              ${n < 4 ? '<span class="text-slate-600 text-[10px]">—</span>' : ''}
            </div>
          `).join('')}
        </div>

        <button onclick="${ctaAction}" class="btn btn-wizard-cta">
          ${ctaLabel}
        </button>
      </div>
    `;
  },

  showStep: function(stepNum) {
    this.state.step = stepNum;
    this.syncLiveHUD();
    this.updateFooterDock(stepNum);

    const mount = document.getElementById("wizard-stage-mount");
    if (!mount) return;
    mount.innerHTML = "";

    if (stepNum === 1) this.renderStep1(mount);
    else if (stepNum === 2) this.renderStep2(mount);
    else if (stepNum === 3) this.renderStep3(mount);
    else if (stepNum === 4) this.renderStep4(mount);

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  scrollToIndex: function(stageId, index) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const cards = stage.querySelectorAll(".tcg-card");
    if (cards && cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  },

  bindScrollDetection: function(stageId, step) {
    const stage = document.getElementById(stageId);
    if (!stage || stage._hasSwipeObserver) return;
    stage._hasSwipeObserver = true;

    let timer = null;
    stage.addEventListener("scroll", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const cards = stage.querySelectorAll(".tcg-card");
        if (!cards || cards.length === 0) return;
        const stageCenter = stage.getBoundingClientRect().left + stage.offsetWidth / 2;

        let closestIdx = 0;
        let minDistance = Infinity;

        cards.forEach((card, idx) => {
          const rect = card.getBoundingClientRect();
          const cardCenter = rect.left + rect.width / 2;
          const dist = Math.abs(stageCenter - cardCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        if (step === 1 && this.state.activeClassIndex !== closestIdx) {
          this.selectClassByIndex(closestIdx, false);
        } else if (step === 2 && this.state.activeAbilityIndex !== closestIdx) {
          this.selectAbilityByIndex(closestIdx, false);
        } else if (step === 3 && this.state.activeShopIndex !== closestIdx) {
          this.selectShopItemByIndex(closestIdx, false);
        }
      }, 70);
    }, { passive: true });
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
      this.selectClassByIndex(nextIdx, true);
    } else if (step === 2) {
      const list = this.getFilteredAbilities();
      if (list.length <= 1) return;
      const nextIdx = (this.state.activeAbilityIndex + direction + list.length) % list.length;
      this.selectAbilityByIndex(nextIdx, true);
    } else if (step === 3) {
      const list = this.getFilteredShopItems();
      if (list.length <= 1) return;
      const nextIdx = (this.state.activeShopIndex + direction + list.length) % list.length;
      this.selectShopItemByIndex(nextIdx, true);
    }
  },

  // --------------------------------------------------------------------------
  // STEP 1: SCELTA CLASSE
  // --------------------------------------------------------------------------
  setClassFactionFilter: function(faction) {
    this.state.classFactionFilter = faction;
    this.state.activeClassIndex = 0;
    this.showStep(1);
  },

  renderStep1: function(mount) {
    const factionSet = {};
    (this.state.classes || []).forEach(c => {
      const f = String(c.sottocategoria || "").trim();
      if (f && f !== "—" && f !== "-") factionSet[f] = true;
    });
    const factions = ["tutte", ...Object.keys(factionSet)];
    const currentFilter = this.state.classFactionFilter || "tutte";
    const classes = this.getFilteredClasses();

    mount.innerHTML = `
      <div id="wizard-class-faction-chips" class="chips-scroll-bar flex gap-1.5 overflow-x-auto py-1 mb-1 justify-start w-full">
        ${factions.map(f => `
          <button onclick="Rules2Wizard.setClassFactionFilter('${f}')" class="rpg-category-chip ${currentFilter.toLowerCase() === f.toLowerCase() ? 'active' : ''}">
            ${f.toUpperCase()}
          </button>
        `).join("")}
      </div>

      <div class="coverflow-stage-outer relative flex-1 min-h-0 w-full">
        <div class="absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30">
          <button onclick="Rules2Wizard.navigateInfiniteCards(1, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
          <button onclick="Rules2Wizard.navigateInfiniteCards(1, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
        </div>

        <div class="coverflow-stage-wrapper flex gap-3 overflow-x-auto py-1" id="wizard-classes-stage">
          ${classes.map((cls, idx) => {
            const isSelected = (this.state.activeClassIndex === idx);
            const subCat = String(cls.sottocategoria || "").trim();
            const forVal = Number(cls.forza || 10);
            const desVal = Number(cls.destrezza || 10);
            const intVal = Number(cls.intelligenza || 10);
            const startingLoot = Rules2_ResolveItemName(cls.equipLoot, this.state.shopCatalog) || "Dotazione Iniziale";

            return `
              <div id="class-card-${idx}" onclick="Rules2Wizard.selectClassByIndex(${idx}, true)" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
                <div class="tcg-card-media">
                  <div class="tcg-card-header">
                    <h4 class="tcg-card-title truncate">${cls.emoji ? cls.emoji + ' ' : ''}${cls.nome}</h4>
                    ${subCat ? `<span class="tcg-card-faction-badge ${subCat.toLowerCase()}">${subCat.toUpperCase()}</span>` : ''}
                  </div>
                  <img src="${cls.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(cls.nome)}" loading="lazy">
                  ${(cls.citazione && cls.citazione !== "—" && cls.citazione !== "-") ? `
                    <div class="tcg-card-quote-overlay">
                      <div class="tcg-card-quote-text">“${cls.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                      ${cls.autoreCitazione ? `<div class="tcg-card-quote-author">${cls.autoreCitazione}</div>` : ''}
                    </div>
                  ` : ''}
                </div>

                <div class="tcg-stats-plate">
                  <span>🥊 FOR <b>${forVal}</b> (${Rules2_FormatMod(forVal)})</span>
                  <span>🤸 DES <b>${desVal}</b> (${Rules2_FormatMod(desVal)})</span>
                  <span>🧠 INT <b>${intVal}</b> (${Rules2_FormatMod(intVal)})</span>
                </div>

                <p class="tcg-card-desc">${cls.descrizione || cls.testo || ''}</p>

                <div class="tcg-card-footer">
                  <div class="tcg-card-loot" title="${Rules2_SafeAttr(startingLoot)}">🎒 ${startingLoot}</div>
                  <div class="tcg-card-vitals">
                    <span class="tcg-pv-badge">❤️ ${cls.pv} PV</span>
                    <span class="tcg-gold-badge">🟡 ${cls.oro} ORO</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    this.bindScrollDetection("wizard-classes-stage", 1);
  },

  selectClassByIndex: function(idx, shouldScroll = true) {
    this.state.activeClassIndex = idx;
    const list = this.getFilteredClasses();
    this.state.chosenClass = list[idx] || this.state.classes[idx];

    if (!this.state.isVeteran && this.state.chosenClass) {
      this.state.startingGold = Number(this.state.chosenClass.oro || 40);
      this.state.currentGold = this.state.startingGold;
      this.syncGold();
    }

    tgHaptic("selection");
    
    const stage = document.getElementById("wizard-classes-stage");
    if (stage) {
      const cards = stage.querySelectorAll(".tcg-card");
      cards.forEach((c, i) => c.classList.toggle("selected", i === idx));
    }

    if (shouldScroll) {
      this.scrollToIndex('wizard-classes-stage', idx);
    }
  },

  // --------------------------------------------------------------------------
  // STEP 2: ABILITÀ & TALENTI (AGGIORNAMENTO SUL POSTO SENZA SCATTI)
  // --------------------------------------------------------------------------
  setAbilityCategoryFilter: function(cat) {
    this.state.abilityCategoryFilter = cat;
    this.state.activeAbilityIndex = 0;
    this.showStep(2);
  },

  renderStep2: function(mount) {
    const catSet = {};
    (this.state.abilities || []).forEach(a => {
      const c = String(a.categoria || "").trim();
      if (c && c !== "—" && c !== "-") catSet[c] = true;
    });
    const categories = ["tutti", ...Object.keys(catSet)];
    const currentFilter = this.state.abilityCategoryFilter || "tutti";
    const abilities = this.getFilteredAbilities();
    const userFaction = String(this.state.chosenClass?.sottocategoria || "").toLowerCase();

    mount.innerHTML = `
      <div id="wizard-abilities-filter-chips" class="chips-scroll-bar flex gap-1.5 overflow-x-auto py-1 mb-1 justify-start w-full">
        ${categories.map(c => `
          <button onclick="Rules2Wizard.setAbilityCategoryFilter('${c}')" class="rpg-category-chip ${currentFilter.toLowerCase() === c.toLowerCase() ? 'active' : ''}">
            ${c.toUpperCase()}
          </button>
        `).join("")}
      </div>

      <div class="coverflow-stage-outer relative flex-1 min-h-0 w-full">
        <div class="absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30">
          <button onclick="Rules2Wizard.navigateInfiniteCards(2, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
          <button onclick="Rules2Wizard.navigateInfiniteCards(2, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
        </div>

        <div class="coverflow-stage-wrapper flex gap-3 overflow-x-auto py-1" id="wizard-abilities-stage">
          ${abilities.map((abl, idx) => {
            const isSelected = (this.state.activeAbilityIndex === idx);
            const isLearned = this.state.chosenAbilities.includes(abl.id);
            const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
            const isCompatible = req.includes("tutti") || (userFaction && req.includes(userFaction));
            const perkText = Rules2_FormatHumanEffect(abl.requisitiCodificati || abl.effettoCodificato, userFaction);
            const loreText = abl.descrizione || abl.testo || "";

            return `
              <div id="abilities-card-${idx}" onclick="Rules2Wizard.selectAbilityByIndex(${idx}, true)" class="coverflow-card tcg-card ${isSelected ? 'selected' : ''}">
                <div class="tcg-card-media">
                  <div class="tcg-card-header">
                    <h4 class="tcg-card-title truncate">${abl.emoji ? abl.emoji + ' ' : ''}${abl.nome}</h4>
                    <span class="tcg-card-faction-badge ${isCompatible ? 'destra' : 'sinistra'}">${(abl.categoria || 'Talento').toUpperCase()}</span>
                  </div>
                  ${abl.mediaUrl ? `<img src="${abl.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(abl.nome)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-black text-6xl text-sky-400">${abl.emoji || '⚡'}</div>`}
                  ${(abl.citazione && abl.citazione !== "—" && abl.citazione !== "-") ? `
                    <div class="tcg-card-quote-overlay">
                      <div class="tcg-card-quote-text">“${abl.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                      ${abl.autoreCitazione ? `<div class="tcg-card-quote-author">${abl.autoreCitazione}</div>` : ''}
                    </div>
                  ` : ''}
                </div>

                <div class="tcg-stats-plate">
                  <span>✨ <b>${abl.costoPX || 100} PX</b></span>
                  <span>🎯 <b>${isCompatible ? 'Compatibile' : 'Vincolato'}</b></span>
                  <span>⚡ <b>${isLearned ? 'Appreso ✓' : 'Disponibile'}</b></span>
                </div>

                <div class="tcg-card-desc">
                  ${loreText ? `<p class="mb-1 text-slate-300 leading-snug">${loreText}</p>` : ''}
                  ${perkText ? `<div class="text-[11px] text-sky-300 font-bold">${perkText}</div>` : ''}
                </div>

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
          }).join("")}
        </div>
      </div>

      <div id="wizard-action-slot-step-2" class="scene-actions-area w-full max-w-[310px] mx-auto flex justify-center">
        <!-- Aggiornato sul posto da updateAbilityActionSlot() -->
      </div>
    `;

    this.updateAbilityActionSlot();
    this.bindScrollDetection("wizard-abilities-stage", 2);
  },

  updateAbilityActionSlot: function() {
    const slot = document.getElementById("wizard-action-slot-step-2");
    if (!slot) return;

    const abilities = this.getFilteredAbilities();
    const currentAbl = abilities[this.state.activeAbilityIndex] || abilities[0];
    const userFaction = String(this.state.chosenClass?.sottocategoria || "").toLowerCase();

    if (!currentAbl) { slot.innerHTML = ""; return; }

    const isLearned = this.state.chosenAbilities.includes(currentAbl.id);
    const cost = Number(currentAbl.costoPX || 100);
    const canAfford = (this.state.remainingPx >= cost);
    const req = String(currentAbl.requisitiCodificati || currentAbl.effettoCodificato || "tutti").toLowerCase();
    const isCompatible = req.includes("tutti") || (userFaction && req.includes(userFaction));

    let btnHtml = "";
    if (isLearned) {
      btnHtml = `
        <button onclick="Rules2Wizard.toggleAbility('${currentAbl.id}')" class="scene-action-btn border-amber-400/50 text-amber-300 font-black justify-between">
          <span>✓ APPRESO</span>
          <span class="text-[10px] font-normal underline">Rimborsa +${cost} PX</span>
        </button>
      `;
    } else if (!isCompatible) {
      btnHtml = `
        <button disabled class="scene-action-btn opacity-40 justify-center text-slate-400 cursor-not-allowed">
          🔒 REQUISITI NON SODDISFATTI
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
    slot.innerHTML = `<div class="actions-grid-1 w-full">${btnHtml}</div>`;
  },

  selectAbilityByIndex: function(idx, shouldScroll = true) {
    this.state.activeAbilityIndex = idx;
    tgHaptic("selection");
    
    // Aggiorna sul posto la classe selected senza distruggere il carosello
    const stage = document.getElementById("wizard-abilities-stage");
    if (stage) {
      const cards = stage.querySelectorAll(".tcg-card");
      cards.forEach((c, i) => c.classList.toggle("selected", i === idx));
    }
    
    this.updateAbilityActionSlot();

    if (shouldScroll) {
      this.scrollToIndex('wizard-abilities-stage', idx);
    }
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

    this.syncLiveHUD();
    this.updateAbilityActionSlot();

    // Aggiorna lo stato visivo della carta attiva senza ricaricare lo step
    const stage = document.getElementById("wizard-abilities-stage");
    if (stage) {
      const activeCard = stage.querySelector(`#abilities-card-${this.state.activeAbilityIndex}`);
      if (activeCard) {
        const isNowLearned = this.state.chosenAbilities.includes(ablId);
        const badge = activeCard.querySelector(".tcg-card-vitals span");
        if (badge) {
          badge.className = `badge badge-xs ${isNowLearned ? 'badge-warning text-black font-black' : 'badge-ghost text-slate-400 font-bold'}`;
          badge.textContent = isNowLearned ? 'IN USO' : 'DISPONIBILE';
        }
      }
    }
  },

  // --------------------------------------------------------------------------
  // STEP 3: EMPORIO (AGGIORNAMENTI SUL POSTO: ZERO RESET ALLA CARTA 0!)
  // --------------------------------------------------------------------------
  filterShop: function(cat) {
    this.syncGold();
    this.state.shopCategory = cat;
    this.state.activeShopIndex = 0;
    this.showStep(3);
  },

  renderStep3: function(mount) {
    const categories = ["ARMI", "VEICOLI", "STRUMENTI", "CURE", "DROGHE", "TALISMANI"];
    const currentCat = this.state.shopCategory || "ARMI";
    const filtered = this.getFilteredShopItems();

    mount.innerHTML = `
      <div id="wizard-shop-category-chips" class="chips-scroll-bar flex gap-1.5 overflow-x-auto py-1 mb-1 justify-start w-full">
        ${categories.map(c => `
          <button onclick="Rules2Wizard.filterShop('${c}')" class="rpg-category-chip ${currentCat === c ? 'active' : ''}">
            ${RULES2_SHOP_CATEGORIES[c]?.emoji || '📦'} ${RULES2_SHOP_CATEGORIES[c]?.label || c}
          </button>
        `).join("")}
      </div>

      <div class="coverflow-stage-outer relative flex-1 min-h-0 w-full">
        <div class="absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none z-30">
          <button onclick="Rules2Wizard.navigateInfiniteCards(3, -1)" class="carousel-arrow-btn" title="Precedente">‹</button>
          <button onclick="Rules2Wizard.navigateInfiniteCards(3, 1)" class="carousel-arrow-btn" title="Successiva">›</button>
        </div>

        <div class="coverflow-stage-wrapper flex gap-3 overflow-x-auto py-1" id="wizard-shop-stage">
          ${filtered.map((it, idx) => {
            const isSelected = (this.state.activeShopIndex === idx);
            const price = Math.abs(Number(it.costoOro || it.costo || 15));
            const inBag = (this.state.boughtItems || []).filter(b => b.id === it.id || b.nome === it.nome).length;

            return `
              <div id="shop-card-${idx}" onclick="Rules2Wizard.selectShopItemByIndex(${idx}, true)" class="coverflow-card tcg-card relative ${isSelected ? 'selected' : ''}">
                <div class="tcg-card-media">
                  <div class="tcg-card-header">
                    <h4 class="tcg-card-title truncate">${it.emoji ? it.emoji + ' ' : ''}${it.nome}</h4>
                    <span class="tcg-card-faction-badge destra">${currentCat}</span>
                  </div>
                  <img src="${it.mediaUrl || 'https://image.pollinations.ai/prompt/dark-noir-rpg-equipment-item?width=600&height=400&nologo=true'}" class="tcg-card-img" alt="${Rules2_SafeAttr(it.nome)}" loading="lazy">
                  ${(it.citazione && it.citazione !== "—" && it.citazione !== "-") ? `
                    <div class="tcg-card-quote-overlay">
                      <div class="tcg-card-quote-text">“${it.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                      ${it.autoreCitazione ? `<div class="tcg-card-quote-author">${it.autoreCitazione}</div>` : ''}
                    </div>
                  ` : ''}
                </div>

                <div class="tcg-stats-plate">
                  <span>💰 <b>${price} 🟡</b></span>
                  <span>💥 <b>${it.danno ? '+' + it.danno : '—'}</b></span>
                  <span>❤️ <b>${it.pv ? '+' + it.pv : '—'}</b></span>
                </div>

                <p class="tcg-card-desc">${it.descrizione || it.testo || ''}</p>

                <div class="tcg-card-footer">
                  <div class="tcg-card-loot font-bold">${price} ORO</div>
                  <div class="tcg-card-vitals" id="shop-card-vitals-${idx}">
                    ${inBag > 0 ? `<span class="badge badge-xs badge-warning font-mono font-black">x${inBag} NELLO ZAINO</span>` : '<span class="text-slate-500 font-mono text-[10px]">NON ACQUISTATO</span>'}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div id="wizard-action-slot-step-3" class="scene-actions-area w-full max-w-[310px] mx-auto flex justify-center">
        <!-- Aggiornato sul posto da updateShopActionSlot() -->
      </div>
    `;

    this.updateShopActionSlot();
    this.bindScrollDetection("wizard-shop-stage", 3);
  },

  updateShopActionSlot: function() {
    const slot = document.getElementById("wizard-action-slot-step-3");
    if (!slot) return;

    const filtered = this.getFilteredShopItems();
    const currentItem = filtered[this.state.activeShopIndex] || filtered[0];

    if (!currentItem) { slot.innerHTML = ""; return; }

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
    slot.innerHTML = `<div class="actions-grid-1 w-full">${btnHtml}</div>`;
  },

  selectShopItemByIndex: function(idx, shouldScroll = true) {
    this.state.activeShopIndex = idx;
    tgHaptic("selection");
    
    // 🔒 Aggiorna la classe selected SENZA distruggere e ricreare il carosello!
    const stage = document.getElementById("wizard-shop-stage");
    if (stage) {
      const cards = stage.querySelectorAll(".tcg-card");
      cards.forEach((c, i) => c.classList.toggle("selected", i === idx));
    }
    
    this.updateShopActionSlot();

    if (shouldScroll) {
      this.scrollToIndex('wizard-shop-stage', idx);
    }
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
        return wizardNotify("Massimo 1 Veicolo consentito nello zaino!", "warning");
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

    // 🔒 Aggiornamento reattivo senza ricreare la schermata
    this.syncLiveHUD();
    this.updateShopActionSlot();

    const vitalsBox = document.getElementById(`shop-card-vitals-${this.state.activeShopIndex}`);
    if (vitalsBox) {
      const inBag = (this.state.boughtItems || []).filter(b => b.id === item.id || b.nome === item.nome).length;
      vitalsBox.innerHTML = `<span class="badge badge-xs badge-warning font-mono font-black">x${inBag} NELLO ZAINO</span>`;
    }
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
    wizardNotify("Zaino svuotato e oro rimborsato.", "info");
    this.showStep(3);
  },

  // --------------------------------------------------------------------------
  // STEP 4: CONSACRAZIONE MONUMENTALE DELL'EROE & AUTO-EQUIP
  // --------------------------------------------------------------------------
  renderStep4: function(mount) {
    this.syncGold();
    const cls = this.state.chosenClass;
    if (!cls) return;

    const subCat = String(cls.sottocategoria || 'Neutrale').trim();
    const heroName = this.state.heroName || AppState.user?.nome || "Avventuriero";
    const startingGear = Rules2_ResolveItemName(cls.equipLoot, this.state.shopCatalog) || "Dotazione Base";

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

    mount.innerHTML = `
      <!-- Riquadro Nome Equidistante -->
      <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 my-1 w-full max-w-[310px] mx-auto shadow-md">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[9.5px] font-mono text-sky-400 font-bold uppercase tracking-wider">Nome dell'Eroe</label>
          <button onclick="Rules2Wizard.randomizeHeroName()" class="text-[10px] text-amber-300 font-mono hover:underline flex items-center gap-1 font-bold">
            🎲 Casuale
          </button>
        </div>
        <input id="wizard-hero-name-input" type="text" value="${heroName}" oninput="Rules2Wizard.updateHeroName(this.value)" class="input input-bordered input-xs w-full bg-slate-950 text-white font-bold text-xs focus:border-sky-400">
      </div>

      <!-- Carta Monumentale Consacrata -->
      <div class="coverflow-card tcg-card selected monumental max-w-[310px] mx-auto shadow-2xl my-auto">
        <div class="tcg-card-media">
          <div class="tcg-card-header">
            <h4 class="tcg-card-title truncate" id="final-card-title">${cls.emoji ? cls.emoji + ' ' : ''}${heroName}</h4>
            <span class="tcg-card-faction-badge ${subCat.toLowerCase()}">${subCat.toUpperCase()}</span>
          </div>
          <img src="${cls.mediaUrl}" class="tcg-card-img" alt="${Rules2_SafeAttr(cls.nome)}">
          ${(cls.citazione && cls.citazione !== "—" && cls.citazione !== "-") ? `
            <div class="tcg-card-quote-overlay">
              <div class="tcg-card-quote-text">“${cls.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
              ${cls.autoreCitazione ? `<div class="tcg-card-quote-author">${cls.autoreCitazione}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="tcg-stats-plate">
          <span>🥊 FOR <b>${effFor}</b> (${Rules2_FormatMod(effFor)})</span>
          <span>🤸 DES <b>${effDes}</b> (${Rules2_FormatMod(effDes)})</span>
          <span>🧠 INT <b>${effInt}</b> (${Rules2_FormatMod(effInt)})</span>
        </div>

        <p class="tcg-card-desc">${cls.descrizione || cls.testo || ''}</p>

        <div class="tcg-card-footer">
          <div class="tcg-card-loot truncate">🎒 ${startingGear} + ${this.state.boughtItems.length}</div>
          <div class="tcg-card-vitals">
            <span class="tcg-pv-badge">❤️ ${totPV} PV</span>
            <span class="tcg-gold-badge">🟡 ${this.state.currentGold} ORO</span>
          </div>
        </div>
      </div>

      <!-- Scorciatoie Modifica Rapida Equidistanti -->
      <div class="flex items-center justify-center gap-2 my-1 font-mono text-[9.5px]">
        <button onclick="Rules2Wizard.goToStep(1)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Classe</button>
        <button onclick="Rules2Wizard.goToStep(2)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Talenti</button>
        <button onclick="Rules2Wizard.goToStep(3)" class="btn btn-xs btn-outline border-white/20 text-slate-300">✎ Emporio</button>
      </div>
    `;
  },

  updateHeroName: function(val) {
    if (val && val.trim()) {
      this.state.heroName = val.trim();
      const title = document.getElementById("final-card-title");
      if (title && this.state.chosenClass) {
        title.textContent = `${this.state.chosenClass.emoji ? this.state.chosenClass.emoji + ' ' : ''}${this.state.heroName}`;
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
      title.textContent = `${this.state.chosenClass.emoji ? this.state.chosenClass.emoji + ' ' : ''}${this.state.heroName}`;
    }
    this.syncLiveHUD();
    this._syncStepToServer("WIZARD_NOME");
  },

  confirmStep1: function() {
    if (!this.state.chosenClass) return wizardNotify("Scegli una classe prima di avanzare!", "warning");
    tgHaptic("success");
    this._syncStepToServer("WIZARD_ABILITA");
    this.showStep(2);
  },

  confirmStep2: function() {
    if (!this.state.chosenClass) return wizardNotify("Scegli prima una classe!", "warning");
    tgHaptic("success");
    this._syncStepToServer("WIZARD_SHOP");
    this.showStep(3);
  },

  goToStep: function(s) {
    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();
    this.showStep(s);
  },

  nextStep: function(s) {
    if (s === 4) {
      this._syncStepToServer("WIZARD_NOME");
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

  _syncStepToServer: function(faseName) {
    if (!this.state.gameKey) return;
    const heroPayload = {
      subAction: "save_wizard_step",
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      fase: faseName,
      classeId: this.state.chosenClass?.id || "",
      classe: this.state.chosenClass?.nome || "",
      schieramentoPolitico: this.state.chosenClass?.sottocategoria || "Neutrale",
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
        this.showStep(2);
      } else {
        const firstClass = this.state.classes[0] || null;
        this.state.chosenClass = firstClass;
        this.state.remainingPx = 100;
        this.state.startingGold = firstClass ? Number(firstClass.oro || 40) : 40;
        this.state.currentGold = this.state.startingGold;
        this.state.heroName = AppState.user?.nome || "Avventuriero";

        this.syncGold();
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

      if (fase === "WIZARD_ABILITA") this.showStep(2);
      else if (fase === "WIZARD_SHOP") this.showStep(3);
      else if (fase === "WIZARD_NOME") this.showStep(4);
      else this.showStep(1);

    } catch (e) {
      console.error("[Rules2Wizard] Errore ripristino wizard:", e);
      this.open(gameKey, epNum, false, null);
    }
  },

  // 🔒 PROTOCOLLO AUTO-EQUIP: ASSEGNA SUBITO L'ARMA E IL VEICOLO PER NON PERDERE I BONUS STATISTICI
  finalizeHero: function() {
    const input = document.getElementById('wizard-hero-name-input');
    if (input && input.value.trim()) {
      this.state.heroName = input.value.trim();
    }

    // Ricerca automatica della prima arma e del primo veicolo
    const allItems = [...this.state.boughtItems];
    if (this.state.chosenClass?.equipLoot) {
      const startItem = (this.state.shopCatalog || []).find(x => x.id === this.state.chosenClass.equipLoot || x.nome === this.state.chosenClass.equipLoot);
      if (startItem) allItems.unshift(startItem);
    }

    const firstWeapon = allItems.find(x => Rules2_ClassifyEntity(x) === "ARMI");
    const firstVehicle = allItems.find(x => Rules2_ClassifyEntity(x) === "VEICOLI");

    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass?.id || "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      armaAttiva: firstWeapon ? firstWeapon.nome : "",
      veicoloAttivo: firstVehicle ? firstVehicle.nome : "",
      heroName: this.state.heroName,
      avatarUrl: this.state.chosenClass?.mediaUrl || "",
      isVeteran: this.state.isVeteran
    };

    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.executeStartGame === "function") {
      Rules2Engine.executeStartGame(payload, payload.avatarUrl);
    }
  }
};

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
