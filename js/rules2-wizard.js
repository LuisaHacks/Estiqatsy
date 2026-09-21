// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2-wizard.js
// LAYER 3A: WIZARD CREAZIONE EROE (RULES 2 - COVERFLOW 3D, TALENTI & SHOP RPG)
// ============================================================================

const Rules2Wizard = {
  // Stato runtime isolato del Wizard Rules 2
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
    chosenClass: null,
    chosenAbilities: [],
    boughtItems: [],
    heroName: "",
    remainingPx: 100,
    startingGold: 40,
    currentGold: 40,
    _gesturesInitialized: false
  },

  // --------------------------------------------------------------------------
  // 1. INIZIALIZZAZIONE & APERTURA WIZARD
  // --------------------------------------------------------------------------
  open: async function(gameKey, epNum, isVeteran = false, savedHero = null) {
    try {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("wizard");

      const wizData = await apiCall("game_wizard_data", { gameKey: gameKey });

      this.state.gameKey = gameKey;
      this.state.episodio = epNum;
      this.state.isVeteran = isVeteran;
      this.state.step = 1;

      // Deduplicazione rigida O(N) delle entità caricate da foglio
      this.state.classes = deduplicateEntities(wizData.classes || wizData.classi || []);
      this.state.abilities = deduplicateEntities(wizData.abilities || wizData.abilita || []);

      // Carica ESCLUSIVAMENTE gli equipaggiamenti RPG di gioco (non lo shop e-commerce in Megoin)
      this.state.shopCatalog = deduplicateEntities(
        wizData.shopItems ||
        wizData.equipaggiamenti ||
        wizData.oggetti ||
        (AppState.games.catalog.find(s => s.gameKey === gameKey)?.equipaggiamenti) ||
        []
      );

      this.state.chosenAbilities = [];
      this.state.boughtItems = [];
      this.state.activeClassIndex = 0;

      // Gestione Continuità Veterano vs Nuovo Eroe
      if (isVeteran && savedHero) {
        this.state.chosenClass = {
          id: savedHero.classeId || "CLS_0001_S1_E0",
          nome: savedHero.classe || savedHero.nomeEroe,
          schieramento: savedHero.schieramentoPolitico || "Destra",
          pv: savedHero.pvMax || 25,
          oro: savedHero.oro || 40,
          emoji: "🎖️",
          mediaUrl: savedHero.mediaUrl || "https://image.pollinations.ai/prompt/veteran-coastal-adventurer-portrait?width=800&height=450&nologo=true"
        };
        this.state.heroName = savedHero.nomeEroe;
        this.state.remainingPx = savedHero.px || 0;
        this.state.startingGold = savedHero.oro || 40;
        this.state.currentGold = savedHero.oro || 40;

        this.showStep(2);
        this.renderStep2();
      } else {
        const firstClass = this.state.classes[0] || null;
        this.state.chosenClass = firstClass;
        this.state.remainingPx = 100;
        this.state.startingGold = firstClass ? (firstClass.oro || 40) : 40;
        this.state.currentGold = firstClass ? (firstClass.oro || 40) : 40;

        this.showStep(1);
        this.renderStep1();
      }

      AppRouter.navigate("view-wizard");
    } catch (err) {
      console.error("[Rules2Wizard] Errore di caricamento dati wizard:", err);
      alert("Impossibile caricare il setup di creazione eroe: " + err.message);
    }
  },

  // --------------------------------------------------------------------------
  // 2. PASSO 1: I TAROCCHI DEL SALMASTRO (COVER-FLOW 3D & SPOTLIGHT A 360°)
  // --------------------------------------------------------------------------
  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    const classes = this.state.classes || [];
    if (classes.length === 0) {
      stage.innerHTML = `<div class="text-slate-500 text-xs text-center py-10">Nessun archetipo di classe disponibile nei registri.</div>`;
      return;
    }

    stage.innerHTML = classes.map((cls, idx) => {
      const pol = (cls.sottocategoria || cls.schieramento || "Destra").toLowerCase();
      const isDestra = pol === "destra";

      const forMod = Math.floor(((cls.forza || 10) - 10) / 2);
      const desMod = Math.floor(((cls.destrezza || 10) - 10) / 2);
      const intMod = Math.floor(((cls.intelligenza || 10) - 10) / 2);
      const fmt = v => (v >= 0 ? "+" + v : String(v));

      const cleanQuote = (cls.citazione || "A Viareggio non ci sono eroi: chi non colpisce per primo finisce a fondo.").replace(/^["'“”]+|["'“”]+$/g, "");

      return `
        <div id="coverflow-card-${idx}" onclick="Rules2Wizard.coverflowSelectIndex(${idx})" class="coverflow-card bg-[#0d131f] border border-white/15 overflow-hidden flex flex-col justify-between shadow-2xl">
          
          <!-- Inquadratura Cinema con Banner Citazione Fisso 72px -->
          <div class="relative w-full h-40 sm:h-48 bg-slate-950 overflow-hidden flex-none">
            <img src="${cls.mediaUrl}" class="w-full h-full object-cover object-center" alt="${cls.nome}">
            
            <span class="badge badge-xs ${isDestra ? 'badge-info' : 'badge-error'} font-black uppercase text-[8px] absolute top-2.5 left-2.5 shadow-md">
              ${(cls.sottocategoria || cls.schieramento || 'Destra').toUpperCase()} (+1 Danno)
            </span>

            <div class="absolute top-2.5 right-2.5 flex space-x-1">
              <span class="badge badge-xs bg-black/75 backdrop-blur-md text-rose-300 font-mono font-bold text-[8.5px]">❤️ ${cls.pv} PV</span>
              <span class="badge badge-xs bg-black/75 backdrop-blur-md text-amber-300 font-mono font-bold text-[8.5px]">🟡 ${cls.oro}</span>
            </div>

            <!-- Banner diegetico senza troncamenti forzati -->
            <div class="watermark-cover-banner">
              <span class="text-[9.5px] text-slate-200 italic leading-tight line-clamp-2 pr-2">“${cleanQuote}”</span>
              <span class="text-[8px] text-amber-400 font-bold uppercase shrink-0">${cls.autoreCitazione || 'Darsena'}</span>
            </div>
          </div>

          <!-- Dettagli della Carta (Nascosti su quelle laterali per pulizia grafica) -->
          <div id="coverflow-details-${idx}" class="p-3.5 space-y-2 flex-1 flex flex-col justify-between transition-opacity duration-300">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-xl">${cls.emoji || '🥋'}</span>
                <h4 class="font-black text-sm text-white">${cls.nome}</h4>
              </div>

              <!-- Trittico Modificatori D20 -->
              <div class="grid grid-cols-3 gap-1 py-1 px-2 rounded-xl bg-black/45 border border-white/5 text-center font-mono text-[9px] mt-1.5">
                <div>🥊 FOR <b>${cls.forza || 10}</b> <span class="text-slate-400">(${fmt(forMod)})</span></div>
                <div>🤸 DES <b>${cls.destrezza || 10}</b> <span class="text-slate-400">(${fmt(desMod)})</span></div>
                <div>🧠 INT <b>${cls.intelligenza || 10}</b> <span class="text-slate-400">(${fmt(intMod)})</span></div>
              </div>

              <p class="text-[10px] text-slate-300 leading-relaxed mt-2 line-clamp-4">${cls.testo || cls.descrizione || ''}</p>
            </div>

            <!-- Dotazione & Status Scelta -->
            <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
              <span class="text-slate-400 truncate max-w-[140px]">🎒 ${cls.armaIniziale ? cls.armaIniziale.nome : (cls.equipLoot || 'Pugni nudi')}</span>
              <button class="btn btn-xs btn-primary font-bold px-3 shadow" id="coverflow-action-btn-${idx}">
                Seleziona
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = classes.map((_, i) => `
        <span onclick="Rules2Wizard.coverflowSelectIndex(${i})" class="h-1.5 rounded-full transition-all cursor-pointer ${i === this.state.activeClassIndex ? 'bg-sky-400 w-4 shadow' : 'bg-white/20 w-1.5'}"></span>
      `).join("");
    }

    this.initCoverflowGestures();
    this.updateCoverflowStage();
  },

  updateCoverflowStage: function() {
    const classes = this.state.classes || [];
    const activeIdx = this.state.activeClassIndex;
    const isDesktop = window.innerWidth >= 768;
    const spacing = isDesktop ? 220 : 160;

    classes.forEach((cls, i) => {
      const el = document.getElementById(`coverflow-card-${i}`);
      const btn = document.getElementById(`coverflow-action-btn-${i}`);
      const detailsBox = document.getElementById(`coverflow-details-${i}`);
      if (!el) return;

      const offset = i - activeIdx;
      const absOffset = Math.abs(offset);

      if (absOffset > 2 && !isDesktop) {
        el.style.display = "none";
        return;
      } else {
        el.style.display = "flex";
      }

      const isCenter = (offset === 0);
      const isDestra = (cls.sottocategoria || cls.schieramento || "Destra").toLowerCase() === "destra";

      // PULIZIA VISIVA: i testi e i modificatori compaiono solo sulla carta in primo piano
      if (detailsBox) {
        detailsBox.style.opacity = isCenter ? "1" : "0";
        detailsBox.style.pointerEvents = isCenter ? "auto" : "none";
      }

      const translateX = offset * spacing;
      const rotateY = offset * (isDesktop ? -20 : -15);
      const scale = isCenter ? (isDesktop ? 1.08 : 1.05) : Math.max(0.75, 0.90 - absOffset * 0.08);
      const zIndex = 30 - absOffset * 5;
      const opacity = isCenter ? 1 : Math.max(0.20, 0.45 - absOffset * 0.10);

      el.style.transform = `translateX(${translateX}px) translateZ(${isCenter ? 50 : 0}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.zIndex = zIndex;
      el.style.opacity = opacity;

      // Glow perimetrale completo a 360°
      el.classList.toggle("glow-destra", isCenter && isDestra);
      el.classList.toggle("glow-sinistra", isCenter && !isDestra);

      if (btn) {
        if (isCenter) {
          btn.textContent = "✓ In Uso";
          btn.className = "btn btn-xs btn-success font-black px-3 shadow";
        } else {
          btn.textContent = "Scegli";
          btn.className = "btn btn-xs btn-outline border-white/20 text-slate-400 font-bold px-2";
        }
      }
    });

    this.state.chosenClass = classes[activeIdx];
    this.state.startingGold = classes[activeIdx] ? (classes[activeIdx].oro || 40) : 40;
    this.state.currentGold = classes[activeIdx] ? (classes[activeIdx].oro || 40) : 40;

    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (dotsBox) {
      dotsBox.querySelectorAll("span").forEach((d, i) => {
        d.className = `h-1.5 rounded-full transition-all cursor-pointer ${i === activeIdx ? 'bg-sky-400 w-4 shadow' : 'bg-white/20 w-1.5'}`;
      });
    }

    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  },

  coverflowSelectIndex: function(idx) {
    if (idx === this.state.activeClassIndex) return;
    this.state.activeClassIndex = idx;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  coverflowNext: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex + 1) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  coverflowPrev: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex - 1 + total) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  initCoverflowGestures: function() {
    const stage = document.getElementById("wizard-classes-stage");
    if (!stage || this.state._gesturesInitialized) return;
    this.state._gesturesInitialized = true;

    let touchStartX = 0;
    let touchEndX = 0;

    stage.addEventListener("touchstart", e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    stage.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) Rules2Wizard.coverflowNext();
        else Rules2Wizard.coverflowPrev();
      }
    }, { passive: true });

    stage.addEventListener("wheel", e => {
      if (Math.abs(e.deltaX) > 20 || Math.abs(e.deltaY) > 20) {
        if (e.deltaX > 0 || e.deltaY > 0) Rules2Wizard.coverflowNext();
        else Rules2Wizard.coverflowPrev();
      }
    }, { passive: true });

    window.addEventListener("keydown", e => {
      if (Rules2Wizard.state.step !== 1) return;
      if (e.key === "ArrowRight") Rules2Wizard.coverflowNext();
      else if (e.key === "ArrowLeft") Rules2Wizard.coverflowPrev();
    });
  },

  confirmStep1: function() {
    if (!this.state.chosenClass) {
      alert("Seleziona prima un archetipo di classe!");
      return;
    }
    this.renderStep2();
    this.showStep(2);
  },

  // --------------------------------------------------------------------------
  // 3. PASSO 2: TALENTI CLANDESTINI (INSPECTOR MODALE UNIVERSALE AL TOCCO)
  // --------------------------------------------------------------------------
  renderStep2: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    const budgetBadge = document.getElementById("wizard-px-budget");
    if (!grid) return;

    if (budgetBadge) budgetBadge.textContent = `✨ ${this.state.remainingPx} PX Disponibili`;
    const userFaction = this.state.chosenClass ? (this.state.chosenClass.sottocategoria || this.state.chosenClass.schieramento || "Destra").toLowerCase() : "destra";

    grid.innerHTML = this.state.abilities.map(abl => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);

      return `
        <!-- Il tocco apre l'Inspector con la modale universale polimorfica -->
        <div onclick="Rules2Wizard.inspectAbilityDetail('${abl.id}')" class="p-3 rounded-xl border ${isSelected ? 'border-sky-400 bg-sky-500/15 shadow-md ring-1 ring-sky-400/40' : (isCompatible ? 'border-white/10 bg-surface/70 cursor-pointer hover:bg-surface active:scale-[0.99]' : 'border-white/5 bg-black/40 opacity-40 cursor-not-allowed')} flex items-center justify-between transition-all">
          <div class="overflow-hidden pr-2">
            <div class="flex items-center space-x-2">
              <span class="text-base">${abl.emoji || '⚡'}</span>
              <span class="text-xs font-black text-white truncate">${abl.nome}</span>
            </div>
            <div class="text-[9.5px] text-slate-300 line-clamp-2 mt-1 leading-snug">${abl.testo || abl.descrizione || abl.effettoCodificato || ''}</div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <span class="badge badge-xs ${isSelected ? 'badge-primary' : (isCompatible ? 'badge-ghost border-white/20' : 'badge-neutral')} font-black text-[8px] py-1.5 px-2">
              ${isSelected ? 'ATTIVO ✓' : (isCompatible ? `${abl.costoPX || 100} PX` : '🔒')}
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  // Sfrutta la modale polimorfica universale (#modal-universal-detail)
  inspectAbilityDetail: function(ablId) {
    const abl = this.state.abilities.find(a => a.id === ablId);
    if (!abl) return;

    const userFaction = this.state.chosenClass ? (this.state.chosenClass.sottocategoria || this.state.chosenClass.schieramento || "Destra").toLowerCase() : "destra";
    const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
    const isCompatible = req.includes("tutti") || req.includes(userFaction);
    const isSelected = this.state.chosenAbilities.includes(abl.id);

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("uni-detail-icon", abl.emoji || "⚡");
    s("uni-detail-title", abl.nome);
    s("uni-detail-badge", `ABILITÀ • ${(req.includes("destra") ? "Destra" : (req.includes("sinistra") ? "Sinistra" : "Comune")).toUpperCase()}`);
    s("uni-detail-metrics-label", "EFFETTO TECNICO APPRENDIMENTO");
    s("uni-detail-metrics-value", abl.effettoCodificato || "Nessun modificatore passivo");
    s("uni-detail-lore", abl.testo || abl.descrizione || "Nessuna nota d'archivio.");

    // Immagine/Media (se presente)
    const mediaContainer = document.getElementById("uni-detail-media-container");
    if (mediaContainer) {
      if (abl.mediaUrl && abl.mediaUrl !== "—" && abl.mediaUrl.startsWith("http")) {
        document.getElementById("uni-detail-img").src = abl.mediaUrl;
        mediaContainer.classList.remove("hidden");
      } else {
        mediaContainer.classList.add("hidden");
      }
    }

    // Bottone di Attivazione / Rimozione contestuale
    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (!isCompatible) {
        btn.textContent = `🔒 Talento Riservato a ${userFaction === "destra" ? "Sinistra" : "Destra"}`;
        btn.className = "btn btn-sm btn-outline border-white/10 text-slate-500 cursor-not-allowed w-full";
        btn.onclick = null;
      } else if (isSelected) {
        btn.textContent = "Rimuovi Talento (+100 PX)";
        btn.className = "btn btn-sm btn-error font-bold w-full";
        btn.onclick = () => {
          Rules2Wizard.toggleAbility(abl.id);
          document.getElementById("modal-universal-detail").close();
        };
      } else {
        btn.textContent = "Attiva Talento (-100 PX)";
        btn.className = "btn btn-sm btn-primary font-bold shadow-lg shadow-sky-600/30 w-full";
        btn.onclick = () => {
          Rules2Wizard.toggleAbility(abl.id);
          document.getElementById("modal-universal-detail").close();
        };
      }
    }

    const modal = document.getElementById("modal-universal-detail");
    if (modal) modal.showModal();
  },

  toggleAbility: function(ablId) {
    const idx = this.state.chosenAbilities.indexOf(ablId);
    if (idx !== -1) {
      this.state.chosenAbilities.splice(idx, 1);
      this.state.remainingPx += 100;
    } else {
      if (this.state.remainingPx >= 100) {
        this.state.chosenAbilities.push(ablId);
        this.state.remainingPx -= 100;
      } else {
        alert("Punti Esperienza insufficienti!");
        return;
      }
    }
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.renderStep2();
  },

  confirmStep2: function() {
    this.filterShop(this.state.shopCategory || "ARMI");
    this.showStep(3);
  },

  // --------------------------------------------------------------------------
  // 4. PASSO 3: MERCATO NERO DI CICCIO (SOLO MERCI RPG, NO CORSI/GADGET)
  // --------------------------------------------------------------------------
  _classifyItem: function(item) {
    if (!item) return "STRUMENTI";
    const cat = String(item.categoria || "").toUpperCase();
    const sub = String(item.sottocategoria || "").toUpperCase();
    const name = String(item.nome || "").toLowerCase();

    if (cat.includes("ARMA")) return "ARMI";
    if (cat.includes("VEICOLO")) return "VEICOLI";
    if (cat.includes("TALISMAN")) return "TALISMANI";
    if (cat.includes("CURA") || name.includes("cecina") || name.includes("trabaccolara") || name.includes("fritto") || name.includes("ponce") || name.includes("focaccia")) return "CURE";
    if (cat.includes("DROGA") || cat.includes("INGREDIENTE") || sub.includes("THC") || sub.includes("STIMOLANTE") || sub.includes("ALLUCINOGENO") || sub.includes("TRANQUILLANTE") || sub.includes("OPPIACEO")) return "DROGHE";
    return "STRUMENTI";
  },

  filterShop: function(category) {
    this.state.shopCategory = category;

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll("button").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(category.toUpperCase());
        btn.className = `badge badge-sm ${isAct ? 'badge-info font-black shadow' : 'badge-ghost'} font-bold cursor-pointer transition-all`;
      });
    }

    const goldDisp = document.getElementById("wizard-shop-gold-display");
    if (goldDisp) goldDisp.textContent = `💰 ${this.state.currentGold} 🟡`;

    const container = document.getElementById("wizard-shop-grid");
    if (!container) return;

    const filtered = (this.state.shopCatalog || []).filter(it => this._classifyItem(it).toUpperCase() === category.toUpperCase());

    if (filtered.length === 0) {
      container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">Nessun articolo per il reparto <b>${category}</b> all'Emporio.</div>`;
      return;
    }

    container.innerHTML = filtered.map(it => {
      const price = Math.abs(parseInt(it.costoOro || it.costo || 15, 10)) || 15;
      const canAfford = (this.state.currentGold >= price);

      return `
        <div class="bg-surface/80 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between space-y-2 text-xs shadow-md">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-sm">${it.emoji || '📦'}</span>
              <span class="font-mono text-[9px] text-amber-300 font-bold">${price} 🟡</span>
            </div>
            <div class="font-bold text-white line-clamp-1 mt-1">${it.nome}</div>
            <div class="text-[9.5px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">${it.testo || it.descrizione || ''}</div>
          </div>
          <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} font-bold text-[9px] w-full" ${!canAfford ? 'disabled' : ''}>
            ${canAfford ? 'Acquista' : 'Oro Insufficiente'}
          </button>
        </div>
      `;
    }).join("");

    this.updateBackpackSummary();
  },

  buyItem: function(itemId, price) {
    if (this.state.currentGold < price) {
      alert("Monete d'oro insufficienti!");
      return;
    }

    const item = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    // Regola anti-exploit: un solo veicolo consentito
    if (this._classifyItem(item) === "VEICOLI") {
      const alreadyHasVehicle = this.state.boughtItems.some(x => this._classifyItem(x) === "VEICOLI");
      if (alreadyHasVehicle) {
        alert("Puoi possedere un solo Veicolo nello zaino!");
        return;
      }
    }

    this.state.currentGold -= price;
    this.state.boughtItems.push(item);

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
    this.filterShop(this.state.shopCategory);
  },

  resetShop: function() {
    this.state.currentGold = this.state.startingGold;
    this.state.boughtItems = [];
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.filterShop(this.state.shopCategory);
  },

  updateBackpackSummary: function() {
    const countEl = document.getElementById("wizard-shop-backpack-count");
    if (countEl) {
      const initCount = this.state.chosenClass ? 1 : 0;
      const total = initCount + this.state.boughtItems.length;
      countEl.textContent = `${total} oggetti`;
    }
  },

  // --------------------------------------------------------------------------
  // 5. PASSO 4: BATTESIMO DELL'EROE & RIEPILOGO FINALE
  // --------------------------------------------------------------------------
  renderStep4: function() {
    const cls = this.state.chosenClass;
    if (!cls) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("wizard-class-recap", `${cls.nome} (${cls.sottocategoria || cls.schieramento || 'Destra'})`);
    s("wizard-recap-avatar", cls.emoji || "🥋");
    s("wizard-recap-classname", cls.nome);
    s("wizard-recap-faction", `${(cls.sottocategoria || cls.schieramento || 'Destra').toUpperCase()} (+1 Danno)`);
    s("wizard-recap-pv", `❤️ ${cls.pv || 25} PV`);
    s("wizard-recap-gold", `🟡 ${this.state.currentGold} Oro`);

    const abls = this.state.chosenAbilities.map(id => {
      const a = this.state.abilities.find(x => x.id === id);
      return a ? a.nome : id;
    });
    s("wizard-recap-abilities", abls.length > 0 ? abls.join(", ") : "Nessun talento sbloccato");

    const initGear = cls.armaIniziale ? cls.armaIniziale.nome : (cls.equipLoot || "Pugni nudi");
    const bought = this.state.boughtItems.map(i => i.nome);
    const fullInv = [initGear, ...bought];
    s("wizard-recap-inventory", fullInv.join(", "));

    const nameInput = document.getElementById("wizard-name-input");
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = this.state.isVeteran 
        ? this.state.heroName 
        : (AppState.user ? AppState.user.nome : "Avventuriero");
    }
  },

  useTelegramName: function() {
    const input = document.getElementById("wizard-name-input");
    if (input && AppState.user) input.value = AppState.user.nome;
  },

  finalizeHero: function() {
    const input = document.getElementById("wizard-name-input");
    const defaultName = this.state.isVeteran 
      ? this.state.heroName 
      : (AppState.user ? AppState.user.nome : "Avventuriero");
    const heroName = (input && input.value.trim()) ? input.value.trim() : defaultName;

    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass ? this.state.chosenClass.id : "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      heroName: heroName
    };

    // Passaggio di consegne all'Engine di gioco Rules 2 per avviare la sessione
    const engine = EngineRegistry.get("Rules2");
    if (engine && typeof engine.executeStartGame === "function") {
      engine.executeStartGame(payload);
    } else {
      console.error("[Rules2Wizard] Rules2Engine non trovato in EngineRegistry.");
    }
  },

  // --------------------------------------------------------------------------
  // 6. CONTROLLO PASSI WIZARD (NAVIGAZIONE)
  // --------------------------------------------------------------------------
  nextStep: function(stepNum) {
    this.state.step = stepNum;
    if (stepNum === 4) this.renderStep4();
    this.showStep(stepNum);
  },

  prevStep: function(stepNum) {
    if (this.state.isVeteran && stepNum === 1) return;
    this.state.step = stepNum;
    this.showStep(stepNum);
  },

  showStep: function(stepNum) {
    const s1 = document.getElementById("wizard-step-class");
    const s2 = document.getElementById("wizard-step-abilities");
    const s3 = document.getElementById("wizard-step-shop");
    const s4 = document.getElementById("wizard-step-name");

    if (s1) s1.classList.toggle("hidden", stepNum !== 1);
    if (s2) s2.classList.toggle("hidden", stepNum !== 2);
    if (s3) s3.classList.toggle("hidden", stepNum !== 3);
    if (s4) s4.classList.toggle("hidden", stepNum !== 4);

    for (let i = 1; i <= 4; i++) {
      const ind = document.getElementById(`wiz-step-ind-${i}`);
      if (ind) {
        ind.className = (i === stepNum) 
          ? "font-black text-sky-400" 
          : (i < stepNum ? "text-emerald-400 font-bold" : "text-slate-500");
      }
    }
  }
};

// ----------------------------------------------------------------------------
// 7. ALIASING DIRETTO SU WINDOW.GAMEENGINE
// Mantiene intatta la compatibilità con tutti gli onclick inline di index.html!
// ----------------------------------------------------------------------------
window.GameEngine = window.GameEngine || {};
window.GameEngine.coverflowSelectIndex = (idx) => Rules2Wizard.coverflowSelectIndex(idx);
window.GameEngine.coverflowNext = () => Rules2Wizard.coverflowNext();
window.GameEngine.coverflowPrev = () => Rules2Wizard.coverflowPrev();
window.GameEngine.wizardConfirmStep1 = () => Rules2Wizard.confirmStep1();
window.GameEngine.inspectAbilityDetail = (id) => Rules2Wizard.inspectAbilityDetail(id);
window.GameEngine.wizardToggleAbility = (id) => Rules2Wizard.toggleAbility(id);
window.GameEngine.wizardConfirmStep2 = () => Rules2Wizard.confirmStep2();
window.GameEngine.filterWizardShop = (cat) => Rules2Wizard.filterShop(cat);
window.GameEngine.buyWizardShopItem = (id, p) => Rules2Wizard.buyItem(id, p);
window.GameEngine.resetWizardShop = () => Rules2Wizard.resetShop();
window.GameEngine.wizardNextStep = (s) => Rules2Wizard.nextStep(s);
window.GameEngine.wizardPrevStep = (s) => Rules2Wizard.prevStep(s);
window.GameEngine.wizardUseTelegramName = () => Rules2Wizard.useTelegramName();
window.GameEngine.wizardFinalizeHero = () => Rules2Wizard.finalizeHero();
