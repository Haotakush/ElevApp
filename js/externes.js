/**
 * ElevApp — Module Animaux Externes
 * Gestion des reproducteurs externes (étalons/femelles d'autres élevages)
 */

const Externes = (() => {
  'use strict';

  let currentFilters = { espece: '' };
  let searchQuery = '';

  // ---- DB Helpers (self-contained) ----

  async function getExternes(uid) {
    const snap = await firebase.firestore().collection('users').doc(uid).collection('externes').orderBy('nom').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getExterne(uid, id) {
    const doc = await firebase.firestore().collection('users').doc(uid).collection('externes').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function addExterne(uid, data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await firebase.firestore().collection('users').doc(uid).collection('externes').add(data);
    return ref.id;
  }

  async function updateExterne(uid, id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await firebase.firestore().collection('users').doc(uid).collection('externes').doc(id).update(data);
  }

  async function deleteExterne(uid, id) {
    await firebase.firestore().collection('users').doc(uid).collection('externes').doc(id).delete();
  }

  // ---- Liste des animaux externes ----
  async function renderList() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">🐾</span> Animaux externes</div>

      <!-- Recherche -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="externe-search" placeholder="Rechercher par nom ou propriétaire..." value="${Utils.escapeHtml(searchQuery)}">
      </div>

      <!-- Filtres -->
      <div class="filters-bar" id="externe-filters">
        <button class="filter-chip ${!currentFilters.espece ? 'active' : ''}" data-filter="espece" data-value="">Tous</button>
        <button class="filter-chip ${currentFilters.espece === 'canin' ? 'active' : ''}" data-filter="espece" data-value="canin">🐕 Canin</button>
        <button class="filter-chip ${currentFilters.espece === 'felin' ? 'active' : ''}" data-filter="espece" data-value="felin">🐈 Félin</button>
      </div>

      <div id="externes-list">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    // Event: recherche
    document.getElementById('externe-search').addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      loadExternesList();
    }));

    // Event: filtres
    document.getElementById('externe-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      const filter = chip.dataset.filter;
      const value = chip.dataset.value;

      // Toggle le filtre
      if (currentFilters[filter] === value) {
        currentFilters[filter] = '';
      } else {
        currentFilters[filter] = value;
      }
      // Update UI filtres
      renderList();
    });

    await loadExternesList();
  }

  async function loadExternesList() {
    const uid = Auth.getUid();
    if (!uid) return;

    const listEl = document.getElementById('externes-list');
    if (!listEl) return;

    try {
      let externes = await getExternes(uid);

      // Filtre espece
      if (currentFilters.espece) {
        externes = externes.filter(e => e.espece === currentFilters.espece);
      }

      // Filtre recherche côté client
      if (searchQuery) {
        externes = externes.filter(e =>
          (e.nom && e.nom.toLowerCase().includes(searchQuery)) ||
          (e.proprietaire && e.proprietaire.nom && e.proprietaire.nom.toLowerCase().includes(searchQuery)) ||
          (e.proprietaire && e.proprietaire.elevage && e.proprietaire.elevage.toLowerCase().includes(searchQuery))
        );
      }

      if (externes.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🐾</div>
            <div class="empty-title">Aucun animal externe</div>
            <div class="empty-desc">Commencez par ajouter un reproducteur externe</div>
            <button class="btn btn-primary" onclick="UI.navigateTo('externe-form')">+ Ajouter un animal</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = externes.map(externe => renderExterneCard(externe)).join('');

      // Events: click carte
      listEl.querySelectorAll('.animal-card').forEach(card => {
        card.addEventListener('click', () => {
          UI.navigateTo('externe-detail', { id: card.dataset.id });
        });
      });

    } catch (err) {
      console.error('Erreur chargement externes', err);
      listEl.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderExterneCard(externe) {
    const photo = externe.photoURL
      ? `<img class="animal-photo" src="${externe.photoURL}" alt="${Utils.escapeHtml(externe.nom)}" loading="lazy">`
      : `<div class="animal-photo-placeholder">${Utils.getEspeceEmoji(externe.espece)}</div>`;

    const raceLabel = externe.race
      ? (externe.raceType && Utils.RACE_TYPES[externe.raceType]
          ? `${Utils.RACE_TYPES[externe.raceType]}${externe.raceType === 'apparence' ? ' ' + Utils.escapeHtml(externe.race) : externe.raceType !== 'nonRace' ? ' — ' + Utils.escapeHtml(externe.race) : ''}`
          : Utils.escapeHtml(externe.race))
      : 'Race non renseignée';

    const ownerLabel = externe.proprietaire
      ? `${Utils.escapeHtml(externe.proprietaire.nom)}${externe.proprietaire.elevage ? ' (' + Utils.escapeHtml(externe.proprietaire.elevage) + ')' : ''}`
      : 'Propriétaire non renseigné';

    return `
      <div class="card animal-card mb-1" data-id="${externe.id}">
        ${photo}
        <div class="animal-info">
          <div class="animal-name">${Utils.escapeHtml(externe.nom)}</div>
          <div class="animal-meta">
            <span>${raceLabel}</span>
          </div>
          <div class="animal-meta" style="margin-top:4px;font-size:0.85rem;color:var(--text-muted);">
            <span>${ownerLabel}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Détail d'un animal externe ----
  async function renderDetail(externeId) {
    UI.setContent(`
      ${UI.pageHeader('Chargement...', 'externes')}
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `);

    const uid = Auth.getUid();
    if (!uid || !externeId) return;

    try {
      const externe = await getExterne(uid, externeId);
      if (!externe) {
        UI.setContent(`${UI.pageHeader('Erreur', 'externes')}<p class="text-center text-muted">Animal externe introuvable</p>`);
        return;
      }

      const raceDisplay = getRaceDisplay(externe);

      const photo = externe.photoURL
        ? `<img src="${externe.photoURL}" alt="${Utils.escapeHtml(externe.nom)}" style="width:100%;max-height:250px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:16px;">`
        : '';

      UI.setContent(`
        ${UI.pageHeader(Utils.escapeHtml(externe.nom), 'externes')}

        ${photo}

        <!-- Infos identité -->
        <div class="section-title"><span class="section-icon">📋</span> Identité</div>
        <div class="card mb-2">
          <div class="info-row">
            <span class="info-label">Espèce</span>
            <span class="info-value">${Utils.getEspeceEmoji(externe.espece)} ${externe.espece === 'canin' ? 'Canin' : 'Félin'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Race</span>
            <span class="info-value">${raceDisplay}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sexe</span>
            <span class="info-value">${Utils.SEXES[externe.sexe] || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date de naissance</span>
            <span class="info-value">${Utils.formatDate(externe.dateNaissance) || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Identification</span>
            <span class="info-value">${Utils.escapeHtml(externe.puce) || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Couleur robe</span>
            <span class="info-value">${Utils.escapeHtml(externe.couleurRobe) || '—'}</span>
          </div>
        </div>

        <!-- Infos propriétaire -->
        ${externe.proprietaire ? `
          <div class="section-title"><span class="section-icon">👤</span> Propriétaire</div>
          <div class="card mb-2">
            <div class="info-row">
              <span class="info-label">Nom</span>
              <span class="info-value">${Utils.escapeHtml(externe.proprietaire.nom) || '—'}</span>
            </div>
            ${externe.proprietaire.elevage ? `<div class="info-row">
              <span class="info-label">Élevage</span>
              <span class="info-value">${Utils.escapeHtml(externe.proprietaire.elevage)}</span>
            </div>` : ''}
            ${externe.proprietaire.telephone ? `<div class="info-row">
              <span class="info-label">Téléphone</span>
              <span class="info-value">${Utils.escapeHtml(externe.proprietaire.telephone)}</span>
            </div>` : ''}
            ${externe.proprietaire.email ? `<div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value"><a href="mailto:${Utils.escapeHtml(externe.proprietaire.email)}">${Utils.escapeHtml(externe.proprietaire.email)}</a></span>
            </div>` : ''}
            ${externe.proprietaire.adresse ? `<div class="info-row">
              <span class="info-label">Adresse</span>
              <span class="info-value">${Utils.escapeHtml(externe.proprietaire.adresse)}</span>
            </div>` : ''}
          </div>
        ` : ''}

        <!-- Infos enregistrement -->
        ${externe.lof ? `
          <div class="section-title"><span class="section-icon">📜</span> Enregistrement</div>
          <div class="card mb-2">
            ${externe.lof.numero ? `<div class="info-row">
              <span class="info-label">Numéro LOF/LOOF</span>
              <span class="info-value">${Utils.escapeHtml(externe.lof.numero)}</span>
            </div>` : ''}
            <div class="info-row">
              <span class="info-label">Confirmé</span>
              <span class="info-value">${externe.lof.confirme ? '✅ Oui' : '❌ Non'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ADN testé</span>
              <span class="info-value">${externe.lof.adn ? '✅ Oui' : '❌ Non'}</span>
            </div>
            ${externe.lof.cotation ? `<div class="info-row">
              <span class="info-label">Cotation</span>
              <span class="info-value">${Utils.escapeHtml(externe.lof.cotation)}</span>
            </div>` : ''}
          </div>
        ` : ''}

        <!-- Notes -->
        ${externe.notes ? `
          <div class="section-title"><span class="section-icon">📝</span> Notes</div>
          <div class="card mb-2">
            <p style="margin:0;white-space:pre-wrap;">${Utils.escapeHtml(externe.notes)}</p>
          </div>
        ` : ''}

        <!-- Boutons éditer / supprimer -->
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="UI.navigateTo('externe-form', {id:'${externeId}'})">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" id="delete-externe-btn">🗑️</button>
        </div>

        <div class="mb-3"></div>
      `);

      // Delete
      document.getElementById('delete-externe-btn').addEventListener('click', () => {
        UI.confirmModal('Supprimer cet animal externe ?', async () => {
          try {
            await deleteExterne(uid, externeId);
            UI.toast('Animal supprimé', 'success');
            UI.navigateTo('externes');
          } catch (e) {
            UI.toast('Erreur de suppression', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Erreur chargement externe', err);
      UI.setContent(`${UI.pageHeader('Erreur', 'externes')}<p class="text-center text-muted">Erreur de chargement</p>`);
    }
  }

  function getRaceDisplay(externe) {
    if (!externe.race) return '—';
    if (externe.raceType === 'lof') return `${Utils.escapeHtml(externe.race)} (LOF)`;
    if (externe.raceType === 'loof') return `${Utils.escapeHtml(externe.race)} (LOOF)`;
    if (externe.raceType === 'apparence') return `d'apparence ${Utils.escapeHtml(externe.race)}`;
    if (externe.raceType === 'nonRace') return "N'appartient pas à une race";
    return Utils.escapeHtml(externe.race);
  }

  // ---- Formulaire animal externe ----
  async function renderForm(externeId) {
    const isEdit = !!externeId;
    const uid = Auth.getUid();

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'animal' : 'Nouvel animal externe', isEdit ? 'externe-detail' : 'externes')}
      <div class="skeleton skeleton-card"></div>
    `);

    let externe = {};
    if (isEdit) {
      externe = await getExterne(uid, externeId) || {};
    }

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'animal' : 'Nouvel animal externe', isEdit ? 'externe-detail' : 'externes')}

      <form id="externe-form">
        <!-- Photo -->
        <div class="form-group" style="display:flex;justify-content:center;">
          <div class="photo-upload" id="photo-upload">
            ${externe.photoURL
              ? `<img src="${externe.photoURL}" alt="Photo" id="photo-preview">`
              : `<div class="upload-placeholder" id="photo-placeholder">
                  <span class="upload-icon">📷</span>
                  <span>Ajouter photo</span>
                </div>`
            }
            <input type="file" accept="image/*" id="photo-input">
          </div>
        </div>

        <!-- Section: Identité -->
        <div class="section-title"><span class="section-icon">📋</span> Identité</div>

        <!-- Espèce -->
        <div class="form-group">
          <label class="form-label" for="ext-espece">Espèce <span class="required">*</span></label>
          <select class="form-select" id="ext-espece" required>
            <option value="">Choisir...</option>
            <option value="canin" ${externe.espece === 'canin' ? 'selected' : ''}>🐕 Canin</option>
            <option value="felin" ${externe.espece === 'felin' ? 'selected' : ''}>🐈 Félin</option>
          </select>
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label" for="ext-nom">Nom <span class="required">*</span></label>
          <input class="form-input" type="text" id="ext-nom" required value="${Utils.escapeHtml(externe.nom || '')}" placeholder="Nom de l'animal">
        </div>

        <!-- Race -->
        <div class="form-group">
          <label class="form-label" for="ext-race">Race</label>
          <input class="form-input" type="text" id="ext-race" value="${Utils.escapeHtml(externe.race || '')}" placeholder="Race">
        </div>

        <!-- Type racial -->
        <div class="form-group">
          <label class="form-label" for="ext-raceType">Type racial</label>
          <select class="form-select" id="ext-raceType">
            <option value="">Choisir...</option>
            <option value="lof" ${externe.raceType === 'lof' ? 'selected' : ''}>De race (LOF)</option>
            <option value="loof" ${externe.raceType === 'loof' ? 'selected' : ''}>De race (LOOF)</option>
            <option value="apparence" ${externe.raceType === 'apparence' ? 'selected' : ''}>D'apparence</option>
            <option value="nonRace" ${externe.raceType === 'nonRace' ? 'selected' : ''}>N'appartient pas à une race</option>
          </select>
          <div class="form-hint" id="raceType-hint"></div>
        </div>

        <!-- Sexe -->
        <div class="form-group">
          <label class="form-label" for="ext-sexe">Sexe <span class="required">*</span></label>
          <select class="form-select" id="ext-sexe" required>
            <option value="">Choisir...</option>
            <option value="male" ${externe.sexe === 'male' ? 'selected' : ''}>♂ Mâle</option>
            <option value="femelle" ${externe.sexe === 'femelle' ? 'selected' : ''}>♀ Femelle</option>
          </select>
        </div>

        <!-- Date naissance -->
        <div class="form-group">
          <label class="form-label" for="ext-dateNaissance">Date de naissance</label>
          <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="ext-dateNaissance" value="${externe.dateNaissance ? Utils.formatDateInput(externe.dateNaissance) : ''}">
        </div>

        <!-- Identification -->
        <div class="form-group">
          <label class="form-label" for="ext-puce">N° d'identification</label>
          <input class="form-input" type="text" id="ext-puce" value="${Utils.escapeHtml(externe.puce || '')}" placeholder="Puce ou tatouage">
          <div class="form-error" id="puce-error">Format invalide (puce: 15 chiffres, tatouage: 3-10 caractères alphanumériques)</div>
        </div>

        <!-- Couleur robe -->
        <div class="form-group">
          <label class="form-label" for="ext-couleur">Couleur de la robe</label>
          <input class="form-input" type="text" id="ext-couleur" value="${Utils.escapeHtml(externe.couleurRobe || '')}" placeholder="Ex: noir et blanc, tricolore...">
        </div>

        <!-- Section: Propriétaire -->
        <div class="section-title"><span class="section-icon">👤</span> Propriétaire</div>

        <!-- Propriétaire Nom -->
        <div class="form-group">
          <label class="form-label" for="prop-nom">Nom <span class="required">*</span></label>
          <input class="form-input" type="text" id="prop-nom" required value="${Utils.escapeHtml(externe.proprietaire?.nom || '')}" placeholder="Nom du propriétaire">
        </div>

        <!-- Propriétaire Élevage -->
        <div class="form-group">
          <label class="form-label" for="prop-elevage">Élevage/Affixe</label>
          <input class="form-input" type="text" id="prop-elevage" value="${Utils.escapeHtml(externe.proprietaire?.elevage || '')}" placeholder="Nom de l'élevage">
        </div>

        <!-- Propriétaire Téléphone -->
        <div class="form-group">
          <label class="form-label" for="prop-tel">Téléphone</label>
          <input class="form-input" type="tel" id="prop-tel" value="${Utils.escapeHtml(externe.proprietaire?.telephone || '')}" placeholder="Numéro de téléphone">
        </div>

        <!-- Propriétaire Email -->
        <div class="form-group">
          <label class="form-label" for="prop-email">Email</label>
          <input class="form-input" type="email" id="prop-email" value="${Utils.escapeHtml(externe.proprietaire?.email || '')}" placeholder="Adresse email">
          <div class="form-error" id="email-error">Email invalide</div>
        </div>

        <!-- Propriétaire Adresse -->
        <div class="form-group">
          <label class="form-label" for="prop-adresse">Adresse</label>
          <textarea class="form-textarea" id="prop-adresse" rows="2" placeholder="Adresse complète">${Utils.escapeHtml(externe.proprietaire?.adresse || '')}</textarea>
        </div>

        <!-- Section: Enregistrement -->
        <div class="section-title"><span class="section-icon">📜</span> Enregistrement</div>

        <!-- LOF/LOOF Numéro -->
        <div class="form-group">
          <label class="form-label" for="lof-numero">Numéro LOF/LOOF</label>
          <input class="form-input" type="text" id="lof-numero" value="${Utils.escapeHtml(externe.lof?.numero || '')}" placeholder="Numéro d'enregistrement">
        </div>

        <!-- LOF/LOOF Confirmé -->
        <div class="form-group">
          <label class="form-toggle">
            <input type="checkbox" id="lof-confirme" ${externe.lof?.confirme ? 'checked' : ''}>
            <span>Enregistrement confirmé</span>
          </label>
        </div>

        <!-- LOF/LOOF ADN -->
        <div class="form-group">
          <label class="form-toggle">
            <input type="checkbox" id="lof-adn" ${externe.lof?.adn ? 'checked' : ''}>
            <span>ADN testé</span>
          </label>
        </div>

        <!-- LOF/LOOF Cotation -->
        <div class="form-group">
          <label class="form-label" for="lof-cotation">Cotation</label>
          <input class="form-input" type="text" id="lof-cotation" value="${Utils.escapeHtml(externe.lof?.cotation || '')}" placeholder="Ex: Excellent, Très bon...">
        </div>

        <!-- Section: Notes -->
        <div class="section-title"><span class="section-icon">📝</span> Notes</div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label" for="ext-notes">Notes</label>
          <textarea class="form-textarea" id="ext-notes" rows="3" placeholder="Remarques, antécédents...">${Utils.escapeHtml(externe.notes || '')}</textarea>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">${isEdit ? 'Enregistrer' : 'Ajouter l\'animal'}</button>
      </form>
    `);

    // ---- Type racial conditionnel selon espèce ----
    const especeSelect = document.getElementById('ext-espece');
    const raceTypeSelect = document.getElementById('ext-raceType');
    function updateRaceTypeOptions() {
      const espece = especeSelect.value;
      const options = raceTypeSelect.querySelectorAll('option');
      options.forEach(opt => {
        if (opt.value === 'lof') opt.style.display = espece === 'felin' ? 'none' : '';
        if (opt.value === 'loof') opt.style.display = espece === 'canin' ? 'none' : '';
      });
    }
    especeSelect.addEventListener('change', updateRaceTypeOptions);
    updateRaceTypeOptions();

    // ---- Hint type racial ----
    raceTypeSelect.addEventListener('change', () => {
      const hint = document.getElementById('raceType-hint');
      const race = document.getElementById('ext-race').value;
      const val = raceTypeSelect.value;
      if (val && Utils.RACE_TYPES[val]) {
        hint.textContent = val === 'apparence' ? `d'apparence ${race || '...'}` : Utils.RACE_TYPES[val];
      } else {
        hint.textContent = '';
      }
    });

    // ---- Photo ----
    let photoBlob = null;
    const photoInput = document.getElementById('photo-input');
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photoBlob = await Utils.compressImage(file);
        const url = URL.createObjectURL(photoBlob);
        const upload = document.getElementById('photo-upload');
        upload.innerHTML = `<img src="${url}" alt="Photo" id="photo-preview"><input type="file" accept="image/*" id="photo-input">`;
        document.getElementById('photo-input').addEventListener('change', arguments.callee);
      } catch (err) {
        UI.toast('Erreur de compression de la photo', 'error');
      }
    });

    // ---- Validation puce en temps réel ----
    document.getElementById('ext-puce').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const err = document.getElementById('puce-error');
      if (val && !Utils.validatePuce(val)) {
        e.target.classList.add('error');
        err.classList.add('visible');
      } else {
        e.target.classList.remove('error');
        err.classList.remove('visible');
      }
    });

    // ---- Validation email en temps réel ----
    document.getElementById('prop-email').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const err = document.getElementById('email-error');
      if (val && !Utils.validateEmail(val)) {
        e.target.classList.add('error');
        err.classList.add('visible');
      } else {
        e.target.classList.remove('error');
        err.classList.remove('visible');
      }
    });

    // ---- Submit ----
    document.getElementById('externe-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const puce = document.getElementById('ext-puce').value.trim();
      const email = document.getElementById('prop-email').value.trim();

      // Validation puce
      if (puce && !Utils.validatePuce(puce)) {
        document.getElementById('puce-error').classList.add('visible');
        document.getElementById('ext-puce').classList.add('error');
        return;
      }

      // Validation email
      if (email && !Utils.validateEmail(email)) {
        document.getElementById('email-error').classList.add('visible');
        document.getElementById('prop-email').classList.add('error');
        return;
      }

      const data = {
        nom: document.getElementById('ext-nom').value.trim(),
        espece: document.getElementById('ext-espece').value,
        race: document.getElementById('ext-race').value.trim(),
        raceType: document.getElementById('ext-raceType').value,
        sexe: document.getElementById('ext-sexe').value,
        puce: puce,
        couleurRobe: document.getElementById('ext-couleur').value.trim(),
        dateNaissance: document.getElementById('ext-dateNaissance').value
          ? firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(document.getElementById('ext-dateNaissance').value))
          : null,
        proprietaire: {
          nom: document.getElementById('prop-nom').value.trim(),
          elevage: document.getElementById('prop-elevage').value.trim(),
          telephone: document.getElementById('prop-tel').value.trim(),
          email: email,
          adresse: document.getElementById('prop-adresse').value.trim()
        },
        lof: {
          numero: document.getElementById('lof-numero').value.trim(),
          confirme: document.getElementById('lof-confirme').checked,
          adn: document.getElementById('lof-adn').checked,
          cotation: document.getElementById('lof-cotation').value.trim()
        },
        notes: document.getElementById('ext-notes').value.trim(),
        photoURL: externe.photoURL || null
      };

      try {
        let id = externeId;
        if (isEdit) {
          await updateExterne(uid, externeId, data);
        } else {
          id = await addExterne(uid, data);
        }

        // Upload photo si nouvelle
        if (photoBlob) {
          const url = await uploadExternePhoto(uid, id, photoBlob);
          await updateExterne(uid, id, { photoURL: url });
        }

        UI.toast(isEdit ? 'Animal mis à jour' : 'Animal ajouté', 'success');
        UI.navigateTo('externe-detail', { id });
      } catch (err) {
        console.error('Erreur sauvegarde externe', err);
        UI.toast('Erreur de sauvegarde', 'error');
      }
    });
  }

  // ---- Photo upload helper ----
  async function uploadExternePhoto(uid, externeId, photoBlob) {
    const timestamp = Date.now();
    const path = `users/${uid}/externes/${externeId}/photo_${timestamp}`;
    const storageRef = firebase.storage().ref(path);
    await storageRef.put(photoBlob);
    return await storageRef.getDownloadURL();
  }

  return { renderList, renderDetail, renderForm, getExternes, getExterne };
})();
