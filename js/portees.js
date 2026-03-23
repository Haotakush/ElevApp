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

      <button class="btn btn-primary btn-block mt-3 mb-3" onclick="UI.navigateTo('portee-form')">+ Nouvelle portée</button>
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
            <button class="btn btn-primary" onclick="UI.navigateTo('portee-form')">+ Nouvelle portée</button>
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
      additionalInfo = `<div class="card-meta" style="margin-top:8px;">🎂 ${nbChiots} chiot${nbChiots > 1 ? 's' : ''} nés le ${Utils.formatDate(portee.dateNaissance)}</div>`;
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

    // Filter females for mere selection (active, non-sterilisé, canin or felin)
    const femelles = animals.filter(a =>
      a.sexe === 'femelle' &&
      a.statut === 'actif' &&
      a.statutReproducteur === 'nonSterilise'
    );

    // Filter males for pere selection (active, non-sterilisé)
    const males = animals.filter(a =>
      a.sexe === 'male' &&
      a.statut === 'actif' &&
      a.statutReproducteur === 'nonSterilise'
    );

    const selectedMere = portee?.mereId || '';
    const selectedMereObj = animals.find(a => a.id === selectedMere);
    const espece = selectedMereObj?.espece || 'canin';

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
            <input class="form-input" type="date" id="portee-date-accouplement" required value="${portee?.dateAccouplement ? Utils.formatDateISO(portee.dateAccouplement) : ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-duree-gestation">Durée de gestation (jours)</label>
            <input class="form-input" type="number" id="portee-duree-gestation" min="50" max="90" value="${portee?.dureeGestation || (espece === 'canin' ? 63 : 65)}" placeholder="${espece === 'canin' ? '63' : '65'}">
            <div class="form-hint">Par défaut ${espece === 'canin' ? '63 jours (canin)' : '65 jours (félin)'} — modifiable selon la race</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-date-prevue">Date prévue de naissance <span class="required">*</span></label>
            <input class="form-input" type="date" id="portee-date-prevue" required value="${portee?.datePrevue ? Utils.formatDateISO(portee.datePrevue) : ''}">
            <div class="form-hint" id="date-prevue-hint">Calculée automatiquement ou saisissez directement</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="portee-date-naissance">Date de naissance réelle</label>
            <input class="form-input" type="date" id="portee-date-naissance" value="${portee?.dateNaissance ? Utils.formatDateISO(portee.dateNaissance) : ''}">
            <div class="form-hint">Remplir ce champ basculera automatiquement le statut en <strong>Née</strong> 🍼</div>
          </div>
        </div>

        <!-- SECTION 2: LA PORTÉE (shown conditionally) -->
        ${showPorteeSection ? `
        <div class="section-title"><span class="section-icon">📊</span> La portée</div>
        <div class="card mb-2">
          <div style="display:none;"><!-- dateNaissance déjà au-dessus --></div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="portee-nb-total">Nombre total</label>
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

          <div class="form-group">
            <label class="form-label" for="portee-notes">Notes</label>
            <textarea class="form-textarea" id="portee-notes" rows="3" placeholder="Observations sur la portée...">${Utils.escapeHtml(portee?.notes || '')}</textarea>
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
    document.getElementById('portee-duree-gestation').addEventListener('input', recalcDatePrevue);

    // Trigger initial calculation if editing
    if (portee?.dateAccouplement) {
      const dateAccoup = Utils.formatDateISO(portee.dateAccouplement);
      document.getElementById('portee-date-accouplement').value = dateAccoup;
      recalcDatePrevue();
    }

    // ---- Event: Add chiot button ----
    document.getElementById('add-chiot-btn').addEventListener('click', (e) => {
      e.preventDefault();
      const idx = chiotsList.querySelectorAll('.chiot-row').length;
      addChiotRow(idx, {}, espece);
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
        dateAccouplement: firebase.firestore.Timestamp.fromDate(new Date(dateAccoupStr)),
        datePrevue: firebase.firestore.Timestamp.fromDate(new Date(datePrevueStr)),
        dateNaissance: dateNaissanceStr ? firebase.firestore.Timestamp.fromDate(new Date(dateNaissanceStr)) : null,
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

        <button type="button" class="btn btn-sm btn-secondary" onclick="this.closest('.chiot-row').remove();" style="margin-top:8px;">🗑️ Supprimer</button>
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
    const espece = mere?.espece || 'canin';

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
            <p><strong>Total:</strong> ${portee.nbTotal || 0} chiot${portee.nbTotal > 1 ? 's' : ''}</p>
            <p><strong>Vivants:</strong> ${portee.nbVivants || 0} | <strong>Morts-nés:</strong> ${portee.nbMorts || 0}</p>
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
        <div class="card" style="cursor:pointer;" onclick="UI.navigateTo('animal-detail', {id:'${portee.mereId}'})">
          <div style="font-size:0.8rem;color:var(--text-muted);">Mère</div>
          <div style="font-weight:600;margin-top:4px;">${mereName}</div>
        </div>
        ${pere ? `
        <div class="card" style="cursor:pointer;" onclick="UI.navigateTo('animal-detail', {id:'${pere.id}'})">
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
      <button class="btn btn-secondary btn-block mt-2" id="add-pesee-btn">+ Ajouter une pesée</button>
      <div id="pesee-form" style="display:none;"></div>
      ` : ''}

      <!-- Actions -->
      <div style="margin-top:16px;display:flex;gap:8px;flex-direction:column;">
        <button class="btn btn-secondary btn-block" onclick="UI.navigateTo('portee-form', {id:'${porteeId}'})">✏️ Modifier</button>
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
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pesee-form').style.display='none'">Annuler</button>
          </div>
        </div>
      `;
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
          <button class="btn btn-sm btn-secondary" onclick="UI.navigateTo('cession-form', {porteeId:'${porteeId}', chiotId:'${chiot.id}'})">📜</button>
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
