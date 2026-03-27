/**
 * ElevApp — Module Portées & Mariages
 * Gestion complète des matings (mariages) et litters (portées) avec chiots/chatons individuels
 * Conforme à l'Arrêté du 19 juin 2025
 */

const Portees = (() => {
  'use strict';

  let currentFilter = ''; // 'gestation', 'nee', 'vendue', 'archivee', or ''

  // ---- LIST PAGE ----
  async function renderList() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">🍼</span> Portées & Mariages</div>

      <!-- Filtres tab chips -->
      <div class="filters-bar" id="portees-filters">
        <button class="filter-chip ${!currentFilter ? 'active' : ''}" data-value="">Toutes</button>
        <button class="filter-chip ${currentFilter === 'gestation' ? 'active' : ''}" data-value="gestation">En gestation</button>
        <button class="filter-chip ${currentFilter === 'nee' ? 'active' : ''}" data-value="nee">Nées</button>
        <button class="filter-chip ${currentFilter === 'sevree' ? 'active' : ''}" data-value="sevree">Sevrées</button>
      </div>

      <div id="portees-list">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>

      <button class="btn btn-primary btn-block mt-3 mb-3" data-nav="portee-form">+ Nouvelle portée</button>
    `);

    // Event: filtres
    document.getElementById('portees-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      currentFilter = chip.dataset.value;
      document.querySelectorAll('#portees-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadPorteesList();
    });

    await loadPorteesList();
  }

  async function loadPorteesList() {
    const uid = Auth.getUid();
    const listEl = document.getElementById('portees-list');
    if (!uid || !listEl) return;

    try {
      // Tout en parallèle
      const [portees, animals, externes] = await Promise.all([
        getPortees(uid, currentFilter || undefined),
        DB.getAnimals(uid),
        typeof Externes !== 'undefined' ? Externes.getExternes(uid) : Promise.resolve([])
      ]);

      let filteredPortees = portees;

      if (filteredPortees.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🍼</div>
            <div class="empty-title">Aucune portée enregistrée</div>
            <div class="empty-desc">Commencez par enregistrer un mariage et une portée</div>
            <button class="btn btn-primary" data-nav="portee-form">+ Nouvelle portée</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filteredPortees.map(portee => renderPorteeCard(portee, animals, externes)).join('');

      // Events: click carte
      listEl.querySelectorAll('.portee-card').forEach(card => {
        card.addEventListener('click', () => {
          UI.navigateTo('portee-detail', { id: card.dataset.id });
        });
      });

    } catch (err) {
      console.error('Erreur chargement portées', err);
      listEl.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderPorteeCard(portee, animals, externes) {
    const mere = animals.find(a => a.id === portee.mereId);
    const pere = portee.pereId
      ? animals.find(a => a.id === portee.pereId)
      : (portee.pereExterneId ? externes.find(e => e.id === portee.pereExterneId) : null);

    const mereName = mere ? Utils.escapeHtml(mere.nom) : '—';
    const pereName = pere
      ? Utils.escapeHtml(pere.nom)
      : (portee.pereNomLibre ? Utils.escapeHtml(portee.pereNomLibre) + ' 🔗' : '—');

    const statusBadge = getStatutBadge(portee.statut);
    const nbChiots = portee.chiots ? portee.chiots.length : 0;

    let additionalInfo = '';
    if (portee.statut === 'gestation' && portee.datePrevue) {
      const countdown = Utils.daysBetween(new Date(), Utils.formatDateISO(portee.datePrevue));
      additionalInfo = `<div class="card-meta" style="margin-top:8px;">📅 Naissance prévue le ${Utils.formatDate(portee.datePrevue)} (${countdown} j.)</div>`;
    } else if (portee.statut !== 'gestation' && portee.dateNaissance) {
      const especePortee = portee.espece || mere?.espece || 'canin';
      const petit = especePortee === 'felin' ? 'chaton' : 'chiot';
      const petits = especePortee === 'felin' ? 'chatons' : 'chiots';
      additionalInfo = `<div class="card-meta" style="margin-top:8px;">🎂 ${nbChiots} ${nbChiots > 1 ? petits : petit} nés le ${Utils.formatDate(portee.dateNaissance)}</div>`;
    }

    return `
      <div class="card portee-card mb-1" data-id="${portee.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div class="animal-name">🐾 ${mereName} ✕ ${pereName}</div>
            <div class="card-meta" style="margin-top:4px;">
              ${statusBadge}
            </div>
            ${additionalInfo}
          </div>
        </div>
      </div>
    `;
  }

  // ---- FORM PAGE ----
  async function renderForm(porteeId) {
    const uid = Auth.getUid();
    const isEdit = !!porteeId;

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier portée' : 'Nouvelle portée', 'portees')}
      <div class="skeleton skeleton-card"></div>
    `);

    const [animals, portee] = await Promise.all([
      DB.getAnimals(uid),
      isEdit ? getPortee(uid, porteeId) : null
    ]);

    const externes = typeof Externes !== 'undefined' ? await Externes.getExternes(uid) : [];

    // Espèce du profil éleveur
    const STATUTS_STERILISES = ['steriliseChirurgical', 'steriliseChimique'];
    const especeProfil = typeof Auth !== 'undefined' ? Auth.getEspeceElevee() : 'canin';

    // selectedMereObj DOIT être défini avant les filtres mâles
    const selectedMere = portee?.mereId || '';
    const selectedMereObj = animals.find(a => a.id === selectedMere);
    const espece = portee?.espece || selectedMereObj?.espece || especeProfil || 'canin';

    // Filter females for mere selection (actives, non stérilisées, même espèce que profil)
    const femelles = animals.filter(a =>
      a.sexe === 'femelle' &&
      a.statut === 'actif' &&
      !STATUTS_STERILISES.includes(a.statutReproducteur) &&
      a.espece === (especeProfil || 'canin')
    );

    // Filter males (actifs, non stérilisés, même espèce que la mère sélectionnée)
    const allMales = animals.filter(a =>
      a.sexe === 'male' &&
      a.statut === 'actif' &&
      !STATUTS_STERILISES.includes(a.statutReproducteur)
    );
    const males = allMales.filter(a => a.espece === espece);

    const showPorteeSection = portee && portee.statut !== 'gestation';
    const selectedPereType = (portee?.pereExterneId || portee?.pereNomLibre) ? 'externe' : 'interne';

    let html = `
      ${UI.pageHeader(isEdit ? 'Modifier portée' : 'Nouvelle portée', 'portees')}

      <form id="portee-form">
        <!-- SECTION 1: LE MARIAGE -->
        <div class="section-title"><span class="section-icon">💑</span> Le mariage</div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="portee-mere">Mère <span class="required">*</span></label>
            <select class="form-select" id="portee-mere" required ${isEdit ? 'disabled' : ''}>
              <option value="">Choisir une mère...</option>
              ${femelles.map(f => `
                <option value="${f.id}" ${f.id === selectedMere ? 'selected' : ''}>
                  ${Utils.getEspeceEmoji(f.espece)} ${Utils.escapeHtml(f.nom)}
                </option>
              `).join('')}
            </select>
            ${isEdit ? `<input type="hidden" id="portee-mere-hidden" value="${selectedMere}">` : ''}
          </div>

          <div class="form-group">
            <label class="form-label">Père <span class="required">*</span></label>
            <div class="radio-group" style="display:flex;gap:10px;margin-bottom:8px;">
              <label style="display:flex;align-items:center;gap:4px;">
                <input type="radio" name="pere-type" value="interne" ${selectedPereType === 'interne' ? 'checked' : ''} onchange="document.getElementById('pere-interne-group').style.display='block';document.getElementById('pere-externe-group').style.display='none';document.getElementById('portee-pere-externe').value='';">
                Interne
              </label>
              <label style="display:flex;align-items:center;gap:4px;">
                <input type="radio" name="pere-type" value="externe" ${selectedPereType === 'externe' ? 'checked' : ''} onchange="document.getElementById('pere-interne-group').style.display='none';document.getElementById('pere-externe-group').style.display='block';document.getElementById('portee-pere').value='';">
                Externe
              </label>
            </div>
          </div>

          <div class="form-group" id="pere-interne-group" style="display:${selectedPereType === 'interne' ? 'block' : 'none'};">
            <label class="form-label" for="portee-pere">Père interne <span class="required">*</span></label>
            <select class="form-select" id="portee-pere">
              <option value="">Choisir un père...</option>
              ${males.map(m => `
                <option value="${m.id}" ${portee?.pereId === m.id ? 'selected' : ''}>
                  ${Utils.getEspeceEmoji(m.espece)} ${Utils.escapeHtml(m.nom)}
                </option>
              `).join('')}
            </select>
          </div>

          <div id="pere-externe-group" style="display:${selectedPereType === 'externe' ? 'block' : 'none'};">
            <div class="form-group">
              <label class="form-label" for="portee-pere-nom-libre">Nom du père <span class="required">*</span></label>
              <input class="form-input" type="text" id="portee-pere-nom-libre" placeholder="ex : Rocky de la Meute d'Or" value="${Utils.escapeHtml(portee?.pereNomLibre || '')}">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="form-group" style="margin:0;">
                <label class="form-label" for="portee-pere-race-libre">Race (optionnel)</label>
                <input class="form-input" type="text" id="portee-pere-race-libre" placeholder="ex : Berger Belge" value="${Utils.escapeHtml(portee?.pereRaceLibre || '')}">
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label" for="portee-pere-puce-libre">Puce / LOF (optionnel)</label>
                <input class="form-input" type="text" id="portee-pere-puce-libre" placeholder="ex : 250269802345678" value="${Utils.escapeHtml(portee?.perePuceLibre || '')}">
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-date-accouplement">Date d'accouplement <span class="required">*</span></label>
            <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="portee-date-accouplement" required value="${portee?.dateAccouplement ? Utils.formatDateInput(portee.dateAccouplement) : ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-duree-gestation">Durée de gestation (jours)</label>
            <input class="form-input" type="number" id="portee-duree-gestation" min="50" max="90" value="${portee?.dureeGestation || (espece === 'canin' ? 63 : 65)}" placeholder="${espece === 'canin' ? '63' : '65'}">
            <div class="form-hint">Par défaut ${espece === 'canin' ? '63 jours (canin)' : '65 jours (félin)'} — modifiable selon la race</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-date-prevue">Date prévue de naissance <span class="required">*</span></label>
            <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="portee-date-prevue" required value="${portee?.datePrevue ? Utils.formatDateInput(portee.datePrevue) : ''}">
            <div class="form-hint" id="date-prevue-hint">Calculée automatiquement ou saisissez directement</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-date-naissance">Date de naissance réelle</label>
            <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="portee-date-naissance" value="${portee?.dateNaissance ? Utils.formatDateInput(portee.dateNaissance) : ''}">
            <div class="form-hint">Remplir ce champ basculera automatiquement le statut en <strong>Née</strong> 🍼</div>
          </div>

          <!-- POIDS FEMELLE -->
          <div class="section-title" style="margin-top:8px;"><span class="section-icon">⚖️</span> Poids de la mère</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="portee-poids-saillie">À la saillie (kg)</label>
              <input class="form-input" type="number" id="portee-poids-saillie" min="0" step="0.1" placeholder="ex : 12.5" value="${portee?.poidsSaillie || ''}">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="portee-poids-terme">À terme (kg)</label>
              <input class="form-input" type="number" id="portee-poids-terme" min="0" step="0.1" placeholder="ex : 15.2" value="${portee?.poidsTerme || ''}">
            </div>
          </div>
          <div class="form-hint" id="prise-poids-hint" style="margin-top:4px;margin-bottom:10px;">
            ${portee?.poidsSaillie && portee?.poidsTerme
              ? `📈 Prise de poids : +${(parseFloat(portee.poidsTerme) - parseFloat(portee.poidsSaillie)).toFixed(1)} kg`
              : '📈 Prise de poids calculée automatiquement'}
          </div>
        </div>

        <!-- SECTION 2: LA PORTÉE (shown conditionally) -->
        ${showPorteeSection ? `
        <div class="section-title"><span class="section-icon">📊</span> La portée</div>
        <div class="card mb-2">
          <div style="display:none;"><!-- dateNaissance déjà au-dessus --></div>

          <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="form-group">
              <label class="form-label" for="portee-nb-total">Total</label>
              <input class="form-input" type="number" id="portee-nb-total" min="0" value="${portee?.nbTotal || 0}" readonly style="background:var(--bg-light);cursor:default;">
            </div>
            <div class="form-group">
              <label class="form-label" for="portee-nb-vivants">Vivants</label>
              <input class="form-input" type="number" id="portee-nb-vivants" min="0" value="${portee?.nbVivants || 0}" readonly style="background:var(--bg-light);cursor:default;">
            </div>
            <div class="form-group">
              <label class="form-label" for="portee-nb-morts">Morts-nés</label>
              <input class="form-input" type="number" id="portee-nb-morts" min="0" value="${portee?.nbMorts || 0}" readonly style="background:var(--bg-light);cursor:default;">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-statut">Statut de la portée</label>
            <select class="form-select" id="portee-statut">
              <option value="gestation" ${portee?.statut === 'gestation' ? 'selected' : ''}>En gestation</option>
              <option value="nee" ${portee?.statut === 'nee' ? 'selected' : ''}>Née</option>
              <option value="sevree" ${portee?.statut === 'sevree' ? 'selected' : ''}>Sevrée</option>
              <option value="vendue" ${portee?.statut === 'vendue' ? 'selected' : ''}>Vendue</option>
              <option value="archivee" ${portee?.statut === 'archivee' ? 'selected' : ''}>Archivée</option>
            </select>
          </div>

          <!-- MISE BAS DÉTAILS -->
          <div class="section-title" style="margin-top:8px;"><span class="section-icon">🏥</span> Mise bas</div>

          <div class="form-group">
            <label class="form-label" for="portee-type-mise-bas">Type de mise bas</label>
            <select class="form-select" id="portee-type-mise-bas">
              <option value="" ${!portee?.typeMiseBas ? 'selected' : ''}>— Non renseigné —</option>
              <option value="naturelle" ${portee?.typeMiseBas === 'naturelle' ? 'selected' : ''}>Naturelle</option>
              <option value="cesarienne" ${portee?.typeMiseBas === 'cesarienne' ? 'selected' : ''}>Césarienne</option>
              <option value="naturelle_cesarienne" ${portee?.typeMiseBas === 'naturelle_cesarienne' ? 'selected' : ''}>Naturelle + Césarienne</option>
              <option value="avortement" ${portee?.typeMiseBas === 'avortement' ? 'selected' : ''}>Avortement</option>
              <option value="vide" ${portee?.typeMiseBas === 'vide' ? 'selected' : ''}>Vide (aucun petit né)</option>
              <option value="cesarienne_sterilisation" ${portee?.typeMiseBas === 'cesarienne_sterilisation' ? 'selected' : ''}>Césarienne + Stérilisation</option>
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label class="form-label" for="portee-heure-debut">Heure de début</label>
              <input class="form-input" type="time" id="portee-heure-debut" value="${portee?.heureDebutMiseBas || ''}">
            </div>
            <div class="form-group">
              <label class="form-label" for="portee-heure-fin">Heure de fin</label>
              <input class="form-input" type="time" id="portee-heure-fin" value="${portee?.heureFinMiseBas || ''}">
            </div>
          </div>
          <div class="form-hint" id="duree-mise-bas-hint" style="margin-top:-8px;margin-bottom:10px;">
            ${portee?.heureDebutMiseBas && portee?.heureFinMiseBas ? `⏱️ Durée : ${calculerDureeMiseBas(portee.heureDebutMiseBas, portee.heureFinMiseBas)}` : '⏱️ Durée calculée automatiquement'}
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-difficultes">Difficultés / Observations mise bas</label>
            <textarea class="form-textarea" id="portee-difficultes" rows="2" placeholder="${espece === 'felin' ? 'Dystocie, chaton en mal présentation...' : 'Dystocie, chiot en mal présentation...'}">${Utils.escapeHtml(portee?.difficultes || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-notes">Notes / Observations</label>
            <textarea class="form-textarea" id="portee-notes" rows="2" placeholder="Observations complémentaires sur la portée...">${Utils.escapeHtml(portee?.notes || '')}</textarea>
          </div>
        </div>
        ` : ''}

        <!-- SECTION 3: CHIOTS/CHATONS -->
        <div class="section-title"><span class="section-icon">${espece === 'canin' ? '🐕' : '🐈'}</span> ${espece === 'canin' ? 'Chiots' : 'Chatons'}</div>
        <div id="chiots-list" class="card mb-2">
          <!-- Rows will be inserted here -->
        </div>
        <button type="button" class="btn btn-secondary btn-block mb-3" id="add-chiot-btn">
          + Ajouter un ${espece === 'canin' ? 'chiot' : 'chaton'}
        </button>

        <button type="submit" class="btn btn-primary btn-block mb-3">${isEdit ? 'Enregistrer' : 'Créer la portée'}</button>
      </form>
    `;

    UI.setContent(html);

    // Populate chiots if editing
    const chiotsList = document.getElementById('chiots-list');
    if (portee?.chiots && portee.chiots.length > 0) {
      portee.chiots.forEach((chiot, idx) => {
        addChiotRow(idx, chiot, espece);
      });
    } else {
      // Add one empty row by default
      addChiotRow(0, {}, espece);
    }

    // ---- Event: Date accouplement ou durée -> recalc date prévue ----
    function recalcDatePrevue() {
      const dateAccoupStr = document.getElementById('portee-date-accouplement').value;
      const duree = parseInt(document.getElementById('portee-duree-gestation').value) || (espece === 'canin' ? 63 : 65);
      if (dateAccoupStr) {
        const dateAccoup = new Date(dateAccoupStr);
        const datePrevue = calculerDatePrevueJours(dateAccoup, duree);
        const dateStr = Utils.formatDateISO(datePrevue);
        document.getElementById('portee-date-prevue').value = dateStr;
        document.getElementById('date-prevue-hint').textContent = `Naissance prévue le ${Utils.formatDate(datePrevue)} (${duree} jours)`;
      }
    }
    document.getElementById('portee-date-accouplement').addEventListener('change', recalcDatePrevue);
    document.getElementById('portee-duree-gestation').addEventListener('input', (e) => {
      e.target.dataset.modified = '1';
      recalcDatePrevue();
    });

    // Trigger initial calculation if editing
    if (portee?.dateAccouplement) {
      const dateAccoup = Utils.formatDateISO(portee.dateAccouplement);
      document.getElementById('portee-date-accouplement').value = dateAccoup;
      recalcDatePrevue();
    }

    // ---- Event: Changement de mère → filtre les pères par espèce ----
    document.getElementById('portee-mere')?.addEventListener('change', (e) => {
      const mereId = e.target.value;
      const mere = animals.find(a => a.id === mereId);
      const especeMere = mere?.espece || 'canin';

      // Mise à jour du select père interne
      const pereSelect = document.getElementById('portee-pere');
      if (pereSelect) {
        const currentPere = pereSelect.value;
        const malesFiltres = allMales.filter(a => a.espece === especeMere);
        pereSelect.innerHTML = `<option value="">Choisir un père...</option>` +
          malesFiltres.map(m => `
            <option value="${m.id}" ${m.id === currentPere && mere?.espece === especeMere ? 'selected' : ''}>
              ${Utils.getEspeceEmoji(m.espece)} ${Utils.escapeHtml(m.nom)}
            </option>`).join('');
        if (malesFiltres.length === 0) {
          pereSelect.innerHTML = `<option value="">Aucun mâle ${especeMere === 'felin' ? 'félin' : 'canin'} enregistré</option>`;
        }
      }

      // Mise à jour durée gestation par défaut
      const dureeInput = document.getElementById('portee-duree-gestation');
      if (dureeInput && !dureeInput.dataset.modified) {
        dureeInput.value = especeMere === 'felin' ? 65 : 63;
        dureeInput.placeholder = especeMere === 'felin' ? '65' : '63';
        recalcDatePrevue();
      }

      // Mise à jour titre section chiots/chatons + bouton ajouter
      const sectionTitre = document.querySelector('#chiots-list')?.closest('.card')?.previousElementSibling;
      if (sectionTitre && sectionTitre.classList.contains('section-title')) {
        sectionTitre.innerHTML = `<span class="section-icon">${especeMere === 'felin' ? '🐈' : '🐕'}</span> ${especeMere === 'felin' ? 'Chatons' : 'Chiots'}`;
      }
      const addBtn = document.getElementById('add-chiot-btn');
      if (addBtn) addBtn.textContent = `+ Ajouter un ${especeMere === 'felin' ? 'chaton' : 'chiot'}`;
    });

    // ---- Event: Calcul prise de poids femelle ----
    function updatePrisePoids() {
      const saillie = parseFloat(document.getElementById('portee-poids-saillie')?.value);
      const terme = parseFloat(document.getElementById('portee-poids-terme')?.value);
      const hint = document.getElementById('prise-poids-hint');
      if (hint) {
        if (!isNaN(saillie) && !isNaN(terme)) {
          const diff = (terme - saillie).toFixed(1);
          const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
          hint.innerHTML = `📈 Prise de poids : <strong style="color:${color}">${diff >= 0 ? '+' : ''}${diff} kg</strong>`;
        } else {
          hint.textContent = '📈 Prise de poids calculée automatiquement';
        }
      }
    }
    document.getElementById('portee-poids-saillie')?.addEventListener('input', updatePrisePoids);
    document.getElementById('portee-poids-terme')?.addEventListener('input', updatePrisePoids);

    // ---- Event: Calcul durée mise bas ----
    function updateDureeMiseBas() {
      const debut = document.getElementById('portee-heure-debut')?.value;
      const fin = document.getElementById('portee-heure-fin')?.value;
      const hint = document.getElementById('duree-mise-bas-hint');
      if (hint) {
        const duree = calculerDureeMiseBas(debut, fin);
        hint.textContent = duree ? `⏱️ Durée : ${duree}` : '⏱️ Durée calculée automatiquement';
      }
    }
    document.getElementById('portee-heure-debut')?.addEventListener('change', updateDureeMiseBas);
    document.getElementById('portee-heure-fin')?.addEventListener('change', updateDureeMiseBas);

    // ---- Event: Add chiot button ----
    document.getElementById('add-chiot-btn').addEventListener('click', (e) => {
      e.preventDefault();
      const idx = chiotsList.querySelectorAll('.chiot-row').length;
      addChiotRow(idx, {}, espece);
    });

    // ---- Event: Supprimer chiot (délégation sur le conteneur) ----
    chiotsList.addEventListener('click', (e) => {
      const btn = e.target.closest('.chiot-remove-btn');
      if (btn) btn.closest('.chiot-row').remove();
    });

    // ---- Submit ----
    document.getElementById('portee-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const mereId = document.getElementById('portee-mere-hidden')?.value || document.getElementById('portee-mere').value;
      if (!mereId) {
        UI.toast('Veuillez sélectionner une mère', 'error');
        return;
      }

      const pereType = document.querySelector('input[name="pere-type"]:checked')?.value;
      const pereId = pereType === 'interne' ? document.getElementById('portee-pere').value : null;
      const pereExterneId = null; // Plus utilisé — remplacé par champs libres
      const pereNomLibre = pereType === 'externe' ? document.getElementById('portee-pere-nom-libre').value.trim() : '';
      const pereRaceLibre = pereType === 'externe' ? document.getElementById('portee-pere-race-libre').value.trim() : '';
      const perePuceLibre = pereType === 'externe' ? document.getElementById('portee-pere-puce-libre').value.trim() : '';

      if (!pereId && !pereNomLibre) {
        UI.toast('Veuillez renseigner le père (interne ou nom du père externe)', 'error');
        return;
      }

      const dateAccoupStr = document.getElementById('portee-date-accouplement').value;
      if (!dateAccoupStr) {
        UI.toast('Veuillez sélectionner une date d\'accouplement', 'error');
        return;
      }

      const dureeGestation = parseInt(document.getElementById('portee-duree-gestation')?.value) || (espece === 'canin' ? 63 : 65);
      let datePrevueStr = document.getElementById('portee-date-prevue').value;
      // Fallback : recalculer si le champ n'a pas été rempli
      if (!datePrevueStr && dateAccoupStr) {
        const dateAccoupFallback = new Date(dateAccoupStr);
        dateAccoupFallback.setDate(dateAccoupFallback.getDate() + dureeGestation);
        datePrevueStr = dateAccoupFallback.toISOString().split('T')[0];
        const el = document.getElementById('portee-date-prevue');
        if (el) el.value = datePrevueStr;
      }
      if (!datePrevueStr) {
        UI.toast('Impossible de calculer la date prévue, vérifiez la date d\'accouplement', 'error');
        return;
      }
      const dateNaissanceStr = document.getElementById('portee-date-naissance')?.value;

      // Collect chiots
      const chiots = [];
      document.querySelectorAll('.chiot-row').forEach((row, idx) => {
        const nomEl = row.querySelector('.chiot-nom');
        const sexeEl = row.querySelector('.chiot-sexe');
        const couleurEl = row.querySelector('.chiot-couleur');
        const poidsEl = row.querySelector('.chiot-poids');
        const heureEl = row.querySelector('.chiot-heure');
        const puceEl = row.querySelector('.chiot-puce');
        const statutEl = row.querySelector('.chiot-statut');

        const nom = nomEl?.value.trim();
        if (!nom) return; // Skip empty rows

        chiots.push({
          id: generateChiotId(),
          nom: nom,
          sexe: sexeEl?.value || 'male',
          couleurRobe: couleurEl?.value.trim() || '',
          poids: poidsEl?.value.trim() || '',
          heure: heureEl?.value || '',
          puce: puceEl?.value.trim() || '',
          statut: statutEl?.value || 'elevage',
          notes: ''
        });
      });

      if (chiots.length === 0 && showPorteeSection) {
        UI.toast('Veuillez ajouter au moins un chiot/chaton', 'error');
        return;
      }

      const data = {
        mereId: mereId,
        pereId: pereId,
        pereExterneId: pereExterneId,
        pereNomLibre: pereNomLibre,
        pereRaceLibre: pereRaceLibre,
        perePuceLibre: perePuceLibre,
        dureeGestation: dureeGestation,
        dateAccouplement: firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(dateAccoupStr)),
        datePrevue: firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(datePrevueStr)),
        dateNaissance: dateNaissanceStr ? firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(dateNaissanceStr)) : null,
        // Basculement automatique : si une date de naissance réelle est renseignée
        // et que le statut est encore "gestation", on passe automatiquement en "née"
        statut: (() => {
          const statutManuel = document.getElementById('portee-statut')?.value || 'gestation';
          if (dateNaissanceStr && statutManuel === 'gestation') return 'nee';
          return statutManuel;
        })(),
        nbTotal: chiots.length,
        nbVivants: document.getElementById('portee-nb-vivants')?.value ? parseInt(document.getElementById('portee-nb-vivants').value) : chiots.length,
        nbMorts: document.getElementById('portee-nb-morts')?.value ? parseInt(document.getElementById('portee-nb-morts').value) : 0,
        poidsSaillie: document.getElementById('portee-poids-saillie')?.value ? parseFloat(document.getElementById('portee-poids-saillie').value) : null,
        poidsTerme: document.getElementById('portee-poids-terme')?.value ? parseFloat(document.getElementById('portee-poids-terme').value) : null,
        typeMiseBas: document.getElementById('portee-type-mise-bas')?.value || '',
        heureDebutMiseBas: document.getElementById('portee-heure-debut')?.value || '',
        heureFinMiseBas: document.getElementById('portee-heure-fin')?.value || '',
        dureeMiseBas: calculerDureeMiseBas(
          document.getElementById('portee-heure-debut')?.value,
          document.getElementById('portee-heure-fin')?.value
        ) || '',
        espece: espece,
        difficultes: document.getElementById('portee-difficultes')?.value.trim() || '',
        notes: document.getElementById('portee-notes')?.value.trim() || '',
        chiots: chiots
      };

      try {
        if (isEdit) {
          await updatePortee(uid, porteeId, data);
          UI.toast('Portée mise à jour', 'success');
        } else {
          await addPortee(uid, data);
          UI.toast('Portée créée', 'success');
        }
        UI.navigateTo('portees');
      } catch (err) {
        console.error('Erreur sauvegarde portée', err);
        UI.toast('Erreur de sauvegarde', 'error');
      }
    });
  }

  function addChiotRow(index, chiot = {}, espece = 'canin') {
    const chiotsList = document.getElementById('chiots-list');
    const rowId = `chiot-${index}-${Date.now()}`;

    const row = document.createElement('div');
    row.className = 'chiot-row';
    row.setAttribute('data-index', index);
    row.innerHTML = `
      <div style="background:var(--bg-light);padding:12px;border-radius:6px;margin-bottom:8px;border-left:4px solid var(--accent);">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="${rowId}-nom">Nom <span class="required">*</span></label>
            <input class="form-input chiot-nom" type="text" id="${rowId}-nom" placeholder="Ex: Max, Luna..." value="${Utils.escapeHtml(chiot.nom || '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="${rowId}-sexe">Sexe</label>
            <select class="form-select chiot-sexe" id="${rowId}-sexe">
              <option value="male" ${chiot.sexe === 'male' ? 'selected' : ''}>♂ Mâle</option>
              <option value="femelle" ${chiot.sexe === 'femelle' ? 'selected' : ''}>♀ Femelle</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="${rowId}-couleur">Couleur robe</label>
            <input class="form-input chiot-couleur" type="text" id="${rowId}-couleur" placeholder="Ex: Noir et blanc..." value="${Utils.escapeHtml(chiot.couleurRobe || '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="${rowId}-poids">Poids naissance (g)</label>
            <input class="form-input chiot-poids" type="number" id="${rowId}-poids" min="0" placeholder="Ex: 350" value="${chiot.poids || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="${rowId}-heure">Heure naissance</label>
            <input class="form-input chiot-heure" type="time" id="${rowId}-heure" value="${chiot.heure || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="${rowId}-statut">Statut</label>
            <select class="form-select chiot-statut" id="${rowId}-statut">
              <option value="elevage" ${chiot.statut === 'elevage' ? 'selected' : ''}>En élevage</option>
              <option value="reserve" ${chiot.statut === 'reserve' ? 'selected' : ''}>Réservé</option>
              <option value="vendu" ${chiot.statut === 'vendu' ? 'selected' : ''}>Vendu</option>
              <option value="cede" ${chiot.statut === 'cede' ? 'selected' : ''}>Cédé</option>
              <option value="decede" ${chiot.statut === 'decede' ? 'selected' : ''}>Décédé</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="${rowId}-puce">Identification (puce/tatouage)</label>
          <input class="form-input chiot-puce" type="text" id="${rowId}-puce" placeholder="N° de puce (15 chiffres) ou tatouage" value="${Utils.escapeHtml(chiot.puce || '')}">
        </div>

        <button type="button" class="btn btn-sm btn-secondary chiot-remove-btn" style="margin-top:8px;">🗑️ Supprimer</button>
      </div>
    `;

    chiotsList.appendChild(row);
  }

  // ---- DETAIL PAGE ----
  async function renderDetail(porteeId) {
    UI.setContent(`
      ${UI.pageHeader('Détail portée', 'portees')}
      <div class="skeleton skeleton-card"></div>
    `);

    const uid = Auth.getUid();
    const portee = await getPortee(uid, porteeId);

    if (!portee) {
      UI.setContent(`
        ${UI.pageHeader('Portée introuvable', 'portees')}
        <p class="text-center text-muted">La portée n'a pas pu être trouvée</p>
      `);
      return;
    }

    const [mere, pere, animals, externes] = await Promise.all([
      DB.getAnimal(uid, portee.mereId),
      portee.pereId ? DB.getAnimal(uid, portee.pereId) : (portee.pereExterneId && typeof Externes !== 'undefined' ? Externes.getExterne(uid, portee.pereExterneId) : null),
      DB.getAnimals(uid),
      typeof Externes !== 'undefined' ? Externes.getExternes(uid) : []
    ]);

    const mereName = mere ? Utils.escapeHtml(mere.nom) : '—';
    const pereName = pere
      ? Utils.escapeHtml(pere.nom)
      : (portee.pereNomLibre ? Utils.escapeHtml(portee.pereNomLibre) : '—');
    const pereEstExterneLibre = !portee.pereId && !portee.pereExterneId && portee.pereNomLibre;

    const statusBadge = getStatutBadge(portee.statut);
    const espece = portee.espece || mere?.espece || 'canin';

    let gestationInfo = '';
    if (portee.statut === 'gestation' && portee.datePrevue) {
      const countdown = Utils.daysBetween(new Date(), Utils.formatDateISO(portee.datePrevue));
      const daysLabel = countdown > 0 ? `dans ${countdown} j.` : 'en retard';
      gestationInfo = `
        <div class="card mb-2" style="background:var(--accent-light);border-left:4px solid var(--accent);">
          <div class="section-title" style="font-size:0.9rem;margin:0;">📅 Gestation</div>
          <div style="margin-top:8px;">
            <p><strong>Date d'accouplement:</strong> ${Utils.formatDate(portee.dateAccouplement)}</p>
            <p><strong>Naissance prévue:</strong> ${Utils.formatDate(portee.datePrevue)} (${daysLabel})</p>
          </div>
        </div>
      `;
    }

    let naissanceInfo = '';
    if (portee.statut !== 'gestation' && portee.dateNaissance) {
      naissanceInfo = `
        <div class="card mb-2" style="background:var(--success-light);border-left:4px solid var(--success);">
          <div class="section-title" style="font-size:0.9rem;margin:0;">🎂 Naissance</div>
          <div style="margin-top:8px;">
            <p><strong>Date:</strong> ${Utils.formatDate(portee.dateNaissance)}</p>
            <p><strong>Total:</strong> ${portee.nbTotal || 0} ${espece === 'felin' ? (portee.nbTotal > 1 ? 'chatons' : 'chaton') : (portee.nbTotal > 1 ? 'chiots' : 'chiot')}</p>
            <p><strong>Vivants:</strong> ${portee.nbVivants || 0} | <strong>Morts-nés:</strong> ${portee.nbMorts || 0}</p>
            ${portee.poidsSaillie || portee.poidsTerme ? `
            <p><strong>Poids mère :</strong>
              ${portee.poidsSaillie ? `saillie ${portee.poidsSaillie} kg` : ''}
              ${portee.poidsSaillie && portee.poidsTerme ? ' → ' : ''}
              ${portee.poidsTerme ? `terme ${portee.poidsTerme} kg` : ''}
              ${portee.poidsSaillie && portee.poidsTerme ? `<span style="color:var(--green);font-weight:700;"> (+${(portee.poidsTerme - portee.poidsSaillie).toFixed(1)} kg)</span>` : ''}
            </p>` : ''}
            ${portee.typeMiseBas ? `<p><strong>Type :</strong> ${{
              naturelle: 'Naturelle',
              cesarienne: 'Césarienne',
              naturelle_cesarienne: 'Naturelle + Césarienne',
              avortement: 'Avortement',
              vide: 'Vide',
              cesarienne_sterilisation: 'Césarienne + Stérilisation'
            }[portee.typeMiseBas] || portee.typeMiseBas}</p>` : ''}
            ${portee.heureDebutMiseBas ? `<p><strong>Début :</strong> ${portee.heureDebutMiseBas}${portee.heureFinMiseBas ? ` → ${portee.heureFinMiseBas}` : ''}${portee.dureeMiseBas ? ` <span style="color:var(--text-muted);font-size:0.85rem;">(${portee.dureeMiseBas})</span>` : ''}</p>` : ''}
            ${portee.difficultes ? `<p><strong>Difficultés :</strong> ${Utils.escapeHtml(portee.difficultes)}</p>` : ''}
          </div>
        </div>
      `;
    }

    let html = `
      ${UI.pageHeader(`Portée de ${mereName} ✕ ${pereName}`, 'portees')}

      <div style="margin-bottom:12px;">
        ${statusBadge}
      </div>

      <!-- Gestation info -->
      ${gestationInfo}

      <!-- Naissance info -->
      ${naissanceInfo}

      <!-- Parents -->
      <div class="section-title" style="margin-top:12px;">👨‍👩‍👧 Parents</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="card" style="cursor:pointer;" data-nav="animal-detail" data-params='{"id":"${portee.mereId}"}'>
          <div style="font-size:0.8rem;color:var(--text-muted);">Mère</div>
          <div style="font-weight:600;margin-top:4px;">${mereName}</div>
        </div>
        ${pere ? `
        <div class="card" style="cursor:pointer;" data-nav="animal-detail" data-params='{"id":"${pere.id}"}'>
          <div style="font-size:0.8rem;color:var(--text-muted);">Père</div>
          <div style="font-weight:600;margin-top:4px;">${pereName}</div>
        </div>
        ` : pereEstExterneLibre ? `
        <div class="card">
          <div style="font-size:0.8rem;color:var(--text-muted);">Père extérieur</div>
          <div style="font-weight:600;margin-top:4px;">${pereName}</div>
          ${portee.pereRaceLibre ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${Utils.escapeHtml(portee.pereRaceLibre)}</div>` : ''}
          ${portee.perePuceLibre ? `<div style="font-size:0.78rem;color:var(--text-muted);">🔖 ${Utils.escapeHtml(portee.perePuceLibre)}</div>` : ''}
        </div>
        ` : '<div class="card" style="background:var(--bg-light);"><div style="font-size:0.8rem;color:var(--text-muted);">Père</div><div style="font-weight:600;margin-top:4px;color:var(--text-muted);">—</div></div>'}
      </div>

      <!-- Chiots -->
      <div class="section-title" style="margin-top:12px;">🐾 ${espece === 'canin' ? 'Chiots' : 'Chatons'}</div>
      <div id="chiots-detail-list">
        ${(portee.chiots || []).map((chiot, idx) => renderChiotDetail(chiot, porteeId)).join('')}
      </div>

      <!-- Suivi des pesées -->
      ${portee.statut !== 'gestation' && (portee.chiots || []).length > 0 ? `
      <div class="section-title" style="margin-top:12px;">⚖️ Suivi des pesées</div>
      <div id="poids-section">
        ${renderPoidsSuivi(portee)}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;" id="add-pesee-btn">+ Ajouter une pesée</button>
        <button class="btn btn-secondary" style="flex:1;" id="export-poids-pdf-btn">📄 Exporter PDF</button>
      </div>
      <div id="pesee-form" style="display:none;"></div>
      ` : ''}

      <!-- Actions -->
      <div style="margin-top:16px;display:flex;gap:8px;flex-direction:column;">
        <button class="btn btn-secondary btn-block" data-nav="portee-form" data-params='{"id":"${porteeId}"}'>✏️ Modifier</button>
        ${portee.statut === 'gestation' ? `
        <button class="btn btn-secondary btn-block" id="enregistrer-naissance-btn">📝 Enregistrer la naissance</button>
        ` : ''}
        <button class="btn btn-danger btn-block" id="supprimer-portee-btn">🗑️ Supprimer</button>
      </div>
    `;

    UI.setContent(html);

    // ---- Event: Ajouter une pesée ----
    document.getElementById('add-pesee-btn')?.addEventListener('click', () => {
      const formEl = document.getElementById('pesee-form');
      if (!formEl) return;
      if (formEl.style.display !== 'none') { formEl.style.display = 'none'; return; }
      const chiots = portee.chiots || [];
      formEl.style.display = 'block';
      formEl.innerHTML = `
        <div class="card mb-2" style="border-left:3px solid var(--orange);">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;">⚖️ Nouvelle pesée</div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-control" id="pesee-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          ${chiots.map(ch => `
            <div class="form-group">
              <label class="form-label">${Utils.escapeHtml(ch.nom)} ${ch.sexe === 'male' ? '♂' : '♀'}</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" class="form-control pesee-input" data-id="${ch.id}" data-nom="${Utils.escapeHtml(ch.nom)}" min="0" step="1" placeholder="grammes" style="flex:1;">
                <span style="font-size:0.8rem;color:var(--text-muted);">g</span>
              </div>
            </div>
          `).join('')}
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary btn-sm" id="save-pesee-btn" style="flex:1;">✅ Enregistrer</button>
            <button class="btn btn-secondary btn-sm" id="cancel-pesee-btn">Annuler</button>
          </div>
        </div>
      `;
      document.getElementById('cancel-pesee-btn').addEventListener('click', () => { formEl.style.display = 'none'; });
      document.getElementById('save-pesee-btn').addEventListener('click', async () => {
        const dateVal = document.getElementById('pesee-date').value;
        if (!dateVal) { UI.toast('Date requise', 'error'); return; }
        const pesees = [];
        document.querySelectorAll('.pesee-input').forEach(inp => {
          if (inp.value) pesees.push({ chiotId: inp.dataset.id, nom: inp.dataset.nom, poids: parseInt(inp.value) });
        });
        if (pesees.length === 0) { UI.toast('Au moins un poids requis', 'error'); return; }
        try {
          const existing = portee.poidsSuivi || [];
          const newEntry = { date: dateVal, pesees };
          const updated = [...existing.filter(e => e.date !== dateVal), newEntry]
            .sort((a, b) => a.date < b.date ? -1 : 1);
          await updatePortee(uid, porteeId, { poidsSuivi: updated });
          portee.poidsSuivi = updated;
          document.getElementById('poids-section').innerHTML = renderPoidsSuivi(portee);
          formEl.style.display = 'none';
          UI.toast('Pesée enregistrée', 'success');
          attachPoidsCharts(portee);
        } catch (e) {
          UI.toast('Erreur sauvegarde', 'error');
        }
      });
    });

    // Charts poids
    if (portee.poidsSuivi?.length > 1) attachPoidsCharts(portee);

    // ---- Event: Export PDF poids ----
    document.getElementById('export-poids-pdf-btn')?.addEventListener('click', () => {
      exportPoidsPDF(portee, mereName, espece);
    });

    // ---- Event: Enregistrer la naissance ----
    const naissanceBtn = document.getElementById('enregistrer-naissance-btn');
    if (naissanceBtn) {
      naissanceBtn.addEventListener('click', () => {
        UI.navigateTo('portee-form', { id: porteeId });
      });
    }

    // ---- Event: Supprimer ----
    document.getElementById('supprimer-portee-btn').addEventListener('click', () => {
      UI.confirmModal('Êtes-vous sûr de vouloir supprimer cette portée ?', async () => {
        try {
          await deletePortee(uid, porteeId);
          UI.toast('Portée supprimée', 'success');
          UI.navigateTo('portees');
        } catch (err) {
          console.error('Erreur suppression portée', err);
          UI.toast('Erreur de suppression', 'error');
        }
      });
    });
  }

  function renderChiotDetail(chiot, porteeId) {
    const sexSymbol = chiot.sexe === 'male' ? '♂' : '♀';
    const statusBadge = getChiotStatutBadge(chiot.statut);

    return `
      <div class="card mb-2" style="border-left:4px solid var(--accent);">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div class="animal-name">${Utils.escapeHtml(chiot.nom)} ${sexSymbol}</div>
            <div class="card-meta" style="margin-top:4px;">
              ${statusBadge}
            </div>
            ${chiot.couleurRobe ? `<div class="card-meta">🎨 ${Utils.escapeHtml(chiot.couleurRobe)}</div>` : ''}
            ${chiot.poids ? `<div class="card-meta">⚖️ ${Utils.escapeHtml(chiot.poids)}g</div>` : ''}
            ${chiot.heure ? `<div class="card-meta">🕐 ${Utils.escapeHtml(chiot.heure)}</div>` : ''}
            ${chiot.puce ? `<div class="card-meta">🔖 ${Utils.escapeHtml(chiot.puce)}</div>` : '<div class="card-meta" style="color:var(--text-muted);">🔖 Identification à compléter</div>'}
          </div>
          <button class="btn btn-sm btn-secondary" data-nav="cession-form" data-params='{"porteeId":"${porteeId}","chiotId":"${chiot.id}"}'>📜</button>
        </div>
      </div>
    `;
  }

  // ---- DB HELPERS ----

  function porteeRef(uid) {
    return db.collection('users').doc(uid).collection('portees');
  }

  let db = null;

  // Initialize with Firestore instance
  function init(firestore) {
    db = firestore;
  }

  async function getPortees(uid, statut) {
    if (!db) return [];

    let snapshot = await db.collection('users').doc(uid).collection('portees').get();
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (statut) {
      results = results.filter(p => p.statut === statut);
    }

    // Sort by date descending
    results.sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return db2 - da;
    });

    return results;
  }

  async function getPortee(uid, porteeId) {
    if (!db) return null;
    const doc = await db.collection('users').doc(uid).collection('portees').doc(porteeId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function addPortee(uid, data) {
    if (!db) throw new Error('DB not initialized');
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const docData = { ...data, createdAt: now, updatedAt: now };
    const ref = await db.collection('users').doc(uid).collection('portees').add(docData);
    return ref.id;
  }

  async function updatePortee(uid, porteeId, data) {
    if (!db) throw new Error('DB not initialized');
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(uid).collection('portees').doc(porteeId).update({ ...data, updatedAt: now });
  }

  async function deletePortee(uid, porteeId) {
    if (!db) throw new Error('DB not initialized');
    await db.collection('users').doc(uid).collection('portees').doc(porteeId).delete();
  }

  // ---- HELPER FUNCTIONS ----

  function generateChiotId() {
    return 'chiot_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function exportPoidsPDF(portee, mereName, espece) {
    const suivi = portee.poidsSuivi || [];
    const chiots = portee.chiots || [];
    if (suivi.length === 0 || chiots.length === 0) {
      UI.toast('Aucune pesée à exporter', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const petit = espece === 'felin' ? 'chaton' : 'chiot';
    const dates = suivi.map(e => e.date).sort();

    chiots.forEach((chiot, pageIdx) => {
      if (pageIdx > 0) doc.addPage();

      const W = 190, margin = 10;
      let y = 15;

      // Header
      doc.setFillColor(230, 160, 60);
      doc.rect(margin, y - 6, W, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`ElevApp — Suivi des pesées`, margin + 3, y);
      y += 12;

      // Infos chiot
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${petit.charAt(0).toUpperCase() + petit.slice(1)} : ${chiot.nom || '—'}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      y += 5;
      doc.text(`Portée de ${mereName} | Né(e) le ${portee.dateNaissance ? Utils.formatDate(portee.dateNaissance) : '—'} | Sexe : ${chiot.sexe === 'male' ? 'Mâle' : 'Femelle'}`, margin, y);
      if (chiot.couleurRobe) { y += 4; doc.text(`Robe : ${chiot.couleurRobe}`, margin, y); }
      y += 8;

      // Tableau des pesées
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      // En-tête tableau
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 4, W, 7, 'F');
      doc.text('Date', margin + 2, y);
      doc.text('Poids (g)', margin + 35, y);
      doc.text('Évolution', margin + 65, y);
      doc.text('Prise totale', margin + 100, y);
      y += 5;
      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 1, margin + W, y - 1);

      doc.setFont('helvetica', 'normal');
      const poidsNaissance = chiot.poids ? parseInt(chiot.poids) : null;

      // Ligne naissance si dispo
      if (poidsNaissance) {
        doc.setTextColor(120, 120, 120);
        doc.text('Naissance', margin + 2, y + 4);
        doc.text(`${poidsNaissance} g`, margin + 35, y + 4);
        doc.text('—', margin + 65, y + 4);
        doc.text('—', margin + 100, y + 4);
        y += 7;
        doc.line(margin, y - 1, margin + W, y - 1);
      }

      doc.setTextColor(40, 40, 40);
      dates.forEach((date, i) => {
        const entry = suivi.find(e => e.date === date);
        const pesee = entry?.pesees?.find(p => p.chiotId === chiot.id);
        if (!pesee) return;

        const prevEntry = i > 0 ? suivi.find(e => e.date === dates[i - 1]) : null;
        const prevPesee = prevEntry?.pesees?.find(p => p.chiotId === chiot.id);
        const refPoids = prevPesee ? prevPesee.poids : poidsNaissance;
        const diff = refPoids !== null ? pesee.poids - refPoids : null;
        const totalDiff = poidsNaissance ? pesee.poids - poidsNaissance : null;

        const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        doc.text(dateStr, margin + 2, y + 4);
        doc.text(`${pesee.poids} g`, margin + 35, y + 4);

        if (diff !== null) {
          doc.setTextColor(diff >= 0 ? 0 : 200, diff >= 0 ? 150 : 0, 0);
          doc.text(`${diff >= 0 ? '+' : ''}${diff} g`, margin + 65, y + 4);
          doc.setTextColor(40, 40, 40);
        } else {
          doc.text('—', margin + 65, y + 4);
        }
        if (totalDiff !== null) {
          doc.setTextColor(totalDiff >= 0 ? 0 : 200, totalDiff >= 0 ? 130 : 0, 0);
          doc.text(`${totalDiff >= 0 ? '+' : ''}${totalDiff} g`, margin + 100, y + 4);
          doc.setTextColor(40, 40, 40);
        } else {
          doc.text('—', margin + 100, y + 4);
        }
        y += 7;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, y - 1, margin + W, y - 1);
      });

      y += 6;

      // Courbe de poids
      const points = [];
      if (poidsNaissance) points.push({ label: 'Nais.', poids: poidsNaissance });
      dates.forEach(date => {
        const entry = suivi.find(e => e.date === date);
        const pesee = entry?.pesees?.find(p => p.chiotId === chiot.id);
        if (pesee) {
          const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          points.push({ label: dateStr, poids: pesee.poids });
        }
      });

      if (points.length >= 2) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Courbe de poids', margin, y);
        y += 6;

        const chartH = 45, chartW = W - 10;
        const chartX = margin + 5, chartY = y;
        const minP = Math.min(...points.map(p => p.poids));
        const maxP = Math.max(...points.map(p => p.poids));
        const range = maxP - minP || 1;

        // Fond
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(220, 220, 220);
        doc.rect(chartX, chartY, chartW, chartH, 'FD');

        // Grille horizontale (3 lignes)
        doc.setDrawColor(235, 235, 235);
        doc.setLineWidth(0.2);
        [0.25, 0.5, 0.75].forEach(ratio => {
          const gy = chartY + chartH * ratio;
          doc.line(chartX, gy, chartX + chartW, gy);
          const val = Math.round(maxP - ratio * range);
          doc.setFontSize(6);
          doc.setTextColor(160, 160, 160);
          doc.text(`${val}g`, chartX - 1, gy + 1, { align: 'right' });
        });

        // Courbe
        doc.setDrawColor(230, 160, 60);
        doc.setLineWidth(0.8);
        const xS = (i) => chartX + (i / (points.length - 1)) * chartW;
        const yS = (p) => chartY + chartH - ((p - minP) / range) * chartH;

        for (let i = 0; i < points.length - 1; i++) {
          doc.line(xS(i), yS(points[i].poids), xS(i + 1), yS(points[i + 1].poids));
        }

        // Points + labels dates
        doc.setFillColor(230, 160, 60);
        points.forEach((pt, i) => {
          const px = xS(i), py = yS(pt.poids);
          doc.circle(px, py, 1, 'F');
          doc.setFontSize(6);
          doc.setTextColor(100, 100, 100);
          doc.text(pt.label, px, chartY + chartH + 4, { align: 'center' });
        });

        y += chartH + 10;
      }

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(`Généré par ElevApp — ${new Date().toLocaleDateString('fr-FR')}`, margin, 290);
    });

    const nomFichier = `pesees_${mereName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomFichier;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
      UI.toast('PDF exporté !', 'success');
    } catch (err) {
      console.error('Erreur export PDF', err);
      UI.toast('Erreur lors de l\'export PDF', 'error');
    }
  }

  function calculerDureeMiseBas(heureDebut, heureFin) {
    if (!heureDebut || !heureFin) return null;
    const [hD, mD] = heureDebut.split(':').map(Number);
    const [hF, mF] = heureFin.split(':').map(Number);
    let totalMin = (hF * 60 + mF) - (hD * 60 + mD);
    if (totalMin < 0) totalMin += 24 * 60; // passage minuit
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
  }

  function calculerDatePrevue(dateAccouplement, espece) {
    return calculerDatePrevueJours(dateAccouplement, espece === 'canin' ? 63 : 65);
  }

  function calculerDatePrevueJours(dateAccouplement, jours) {
    const d = new Date(dateAccouplement);
    d.setDate(d.getDate() + jours);
    return d;
  }

  function getStatutBadge(statut) {
    const badgeClass = {
      'gestation': 'badge-status-gestation',
      'nee': 'badge-status-nee',
      'sevree': 'badge-status-sevree',
      'vendue': 'badge-status-vendue',
      'archivee': 'badge-status-archivee'
    }[statut] || 'badge-blue';

    const labels = {
      'gestation': '🤰 En gestation',
      'nee': '🎂 Née',
      'sevree': '🍖 Sevrée',
      'vendue': '💰 Vendue',
      'archivee': '📦 Archivée'
    };

    return `<span class="badge ${badgeClass}">${labels[statut] || statut}</span>`;
  }

  function getChiotStatutBadge(statut) {
    const badgeClass = {
      'elevage': 'badge-blue',
      'reserve': 'badge-orange',
      'vendu': 'badge-green',
      'cede': 'badge-purple',
      'decede': 'badge-red'
    }[statut] || 'badge-blue';

    const labels = {
      'elevage': '🏠 En élevage',
      'reserve': '⭐ Réservé',
      'vendu': '✅ Vendu',
      'cede': '📤 Cédé',
      'decede': '🕊️ Décédé'
    };

    return `<span class="badge ${badgeClass}">${labels[statut] || statut}</span>`;
  }

  // ---- Rendu tableau des pesées ----
  function renderPoidsSuivi(portee) {
    const suivi = portee.poidsSuivi || [];
    const chiots = portee.chiots || [];
    if (suivi.length === 0) return '<p style="font-size:0.82rem;color:var(--text-muted);padding:8px 0;">Aucune pesée enregistrée. Cliquez sur + pour commencer le suivi.</p>';

    // Construire un tableau croisé : dates × chiots
    const dates = suivi.map(e => e.date).sort();
    const nomsParId = {};
    chiots.forEach(c => { nomsParId[c.id] = c.nom; });

    // Header
    let tableHtml = `<div style="overflow-x:auto;margin-bottom:12px;"><table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
      <thead><tr>
        <th style="text-align:left;padding:4px 6px;border-bottom:2px solid var(--border);color:var(--text-muted);">Date</th>
        ${chiots.map(c => `<th style="text-align:right;padding:4px 6px;border-bottom:2px solid var(--border);">${Utils.escapeHtml(c.nom)}</th>`).join('')}
      </tr></thead><tbody>`;

    // Ligne naissance si au moins un chiot a un poids de naissance
    const hasPoidsNaissance = chiots.some(c => c.poids);
    if (hasPoidsNaissance) {
      tableHtml += `<tr style="background:var(--bg-secondary);border-bottom:2px solid var(--border);">
        <td style="padding:4px 6px;font-weight:700;font-size:0.75rem;color:var(--text-muted);">🍼 Naissance</td>
        ${chiots.map(c => {
          if (!c.poids) return `<td style="text-align:right;padding:4px 6px;color:var(--text-muted);">—</td>`;
          return `<td style="text-align:right;padding:4px 6px;font-weight:700;color:var(--text-muted);">${c.poids}g</td>`;
        }).join('')}
      </tr>`;
    }

    dates.forEach((date, i) => {
      const entry = suivi.find(e => e.date === date);
      const prevEntry = i > 0 ? suivi.find(e => e.date === dates[i - 1]) : null;
      tableHtml += `<tr style="background:${i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'};">
        <td style="padding:4px 6px;font-weight:600;">${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
        ${chiots.map(c => {
          const pesee = entry?.pesees?.find(p => p.chiotId === c.id);
          const prevPesee = prevEntry?.pesees?.find(p => p.chiotId === c.id);
          // Pour la 1ère pesée, utiliser le poids naissance comme référence si dispo
          const refPoids = prevPesee ? prevPesee.poids : (i === 0 && c.poids ? parseInt(c.poids) : null);
          if (!pesee) return `<td style="text-align:right;padding:4px 6px;color:var(--text-muted);">—</td>`;
          const diff = refPoids !== null ? pesee.poids - refPoids : null;
          const diffColor = diff !== null ? (diff >= 0 ? 'var(--green)' : 'var(--red)') : '';
          return `<td style="text-align:right;padding:4px 6px;">
            <strong>${pesee.poids}g</strong>
            ${diff !== null ? `<span style="font-size:0.7rem;color:${diffColor};"> ${diff >= 0 ? '+' : ''}${diff}</span>` : ''}
          </td>`;
        }).join('')}
      </tr>`;
    });

    tableHtml += '</tbody></table></div>';

    // Mini charts SVG par chiot
    const chartsHtml = chiots.map(c => {
      const points = suivi.map(e => {
        const p = e.pesees?.find(p => p.chiotId === c.id);
        return p ? { date: e.date, poids: p.poids } : null;
      }).filter(Boolean);

      if (points.length < 2) return '';

      const W = 160, H = 50, PAD = { top: 8, right: 8, bottom: 12, left: 8 };
      const cW = W - PAD.left - PAD.right;
      const cH = H - PAD.top - PAD.bottom;
      const minP = Math.min(...points.map(p => p.poids));
      const maxP = Math.max(...points.map(p => p.poids));
      const n = points.length;
      const xS = (i) => PAD.left + (i / (n - 1)) * cW;
      const yS = (p) => PAD.top + cH - ((p - minP) / (maxP - minP || 1)) * cH;
      const polyline = points.map((p, i) => `${xS(i).toFixed(1)},${yS(p.poids).toFixed(1)}`).join(' ');

      return `<div style="display:inline-block;margin:4px 6px 4px 0;text-align:center;">
        <div style="font-size:0.7rem;font-weight:700;margin-bottom:2px;">${Utils.escapeHtml(c.nom)}</div>
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;">
          <rect x="${PAD.left}" y="${PAD.top}" width="${cW}" height="${cH}" fill="var(--bg-secondary)" rx="3"/>
          <polygon points="${PAD.left},${PAD.top + cH} ${polyline} ${PAD.left + cW},${PAD.top + cH}" fill="var(--orange)" opacity="0.15"/>
          <polyline points="${polyline}" fill="none" stroke="var(--orange)" stroke-width="1.5" stroke-linejoin="round"/>
          ${points.map((p, i) => `<circle cx="${xS(i).toFixed(1)}" cy="${yS(p.poids).toFixed(1)}" r="2.5" fill="var(--orange)"/>`).join('')}
          <text x="${(PAD.left).toFixed(1)}" y="${(H - 2).toFixed(1)}" font-size="7" fill="var(--text-muted)">${minP}g</text>
          <text x="${(PAD.left + cW).toFixed(1)}" y="${(H - 2).toFixed(1)}" font-size="7" fill="var(--text-muted)" text-anchor="end">${maxP}g</text>
        </svg>
        <div style="font-size:0.7rem;color:var(--text-muted);">${points[points.length-1].poids}g actuel</div>
      </div>`;
    }).join('');

    return tableHtml + (chartsHtml ? `<div style="margin-top:8px;">${chartsHtml}</div>` : '');
  }

  function attachPoidsCharts(portee) {
    const section = document.getElementById('poids-section');
    if (section) section.innerHTML = renderPoidsSuivi(portee);
  }

  // Public API
  return {
    init,
    renderList,
    renderDetail,
    renderForm,
    getPortees,
    getPortee,
    addPortee,
    updatePortee,
    deletePortee
  };
})();
