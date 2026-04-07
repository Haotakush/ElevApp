/**
 * ElevApp — Module Journal Sanitaire
 * Tous les types d'entrées conformes à l'arrêté du 19 juin 2025
 */

const Health = (() => {
  'use strict';

  let currentFilter = '';

  // ---- Vue Journal global ----
  async function renderJournal() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">📋</span> Journal sanitaire</div>

      <!-- Filtres -->
      <div class="filters-bar" id="health-filters">
        <button class="filter-chip ${!currentFilter ? 'active' : ''}" data-value="">Tout</button>
        ${Object.entries(Utils.TYPES_SANTE).map(([key, info]) =>
          `<button class="filter-chip ${currentFilter === key ? 'active' : ''}" data-value="${key}">${info.icon} ${info.label}</button>`
        ).join('')}
      </div>

      <div id="health-list">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    // Event: filtres
    document.getElementById('health-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      currentFilter = chip.dataset.value;
      document.querySelectorAll('#health-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadJournal();
    });

    await loadJournal();
  }

  async function loadJournal() {
    const uid = Auth.getUid();
    const listEl = document.getElementById('health-list');
    if (!uid || !listEl) return;

    try {
      let entries = await DB.getAllHealthEntries(uid);

      if (currentFilter) {
        entries = entries.filter(e => e.type === currentFilter);
      }

      if (entries.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">Aucune entrée</div>
            <div class="empty-desc">Ajoutez un événement sanitaire pour commencer</div>
            <button class="btn btn-primary" data-nav="health-form">+ Nouvelle entrée</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `<div class="timeline">
        ${entries.map(entry => {
          const typeInfo = Utils.TYPES_SANTE[entry.type] || { label: entry.type, icon: '📝' };
          const date = Utils.formatDate(entry.date);
          const isAlert = entry.rappelDate && Utils.isExpired(entry.rappelDate);

          return `
            <div class="timeline-item ${isAlert ? 'alert' : ''}">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                <div style="flex:1;cursor:pointer;" data-nav="animal-detail" data-params='{"id":"${entry.animalId}"}'>
                  <div class="timeline-date">${date}</div>
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div class="timeline-type">${typeInfo.icon} ${typeInfo.label}</div>
                    <span class="badge badge-blue" style="font-size:0.65rem;">${Utils.escapeHtml(entry.animalNom || '')}</span>
                  </div>
                  <div class="timeline-title">${Utils.escapeHtml(entry.titre)}</div>
                  ${entry.details ? `<div class="timeline-details">${Utils.escapeHtml(entry.details).substring(0, 100)}${entry.details.length > 100 ? '...' : ''}</div>` : ''}
                  ${isAlert ? `<div class="timeline-details" style="color:var(--red);">⏰ Rappel dépassé : ${Utils.formatDate(entry.rappelDate)}</div>` : ''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;margin-top:2px;">
                  <button data-nav="health-form" data-params='{"animalId":"${entry.animalId}","entryId":"${entry.id}"}' data-stop="true"
                    style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;color:var(--primary);">
                    ✏️
                  </button>
                  <button data-action="delete-health-entry-journal" data-animal-id="${entry.animalId}" data-entry-id="${entry.id}" data-stop="true"
                    style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;color:var(--red);">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>`;

    } catch (err) {
      console.error('Erreur chargement journal', err);
      listEl.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  // ---- Formulaire d'entrée sanitaire ----
  async function renderForm(preAnimalId, entryId, preType) {
    const uid = Auth.getUid();
    const isEdit = !!entryId;

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'entrée' : 'Nouvelle entrée sanitaire', preAnimalId ? 'animal-detail' : 'health', preAnimalId ? {id: preAnimalId} : {})}
      <div class="skeleton skeleton-card"></div>
    `);

    // Charger les animaux pour le select
    const animals = await DB.getAnimals(uid, {});
    const activeAnimals = animals.filter(a => a.statut === 'actif');

    // Charger l'entrée si edit
    let entry = {};
    if (isEdit && preAnimalId) {
      entry = (await DB.getHealthEntries(uid, preAnimalId)).find(e => e.id === entryId) || {};
    }

    const selectedType = preType || entry.type || '';
    const selectedAnimal = preAnimalId || entry.animalId || '';
    const selectedAnimalObj = animals.find(a => a.id === selectedAnimal);

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'entrée' : 'Nouvelle entrée sanitaire', preAnimalId ? 'animal-detail' : 'health', preAnimalId ? {id: preAnimalId} : {})}

      <form id="health-form">
        <!-- Animal -->
        <div class="form-group">
          <label class="form-label" for="health-animal">Animal <span class="required">*</span></label>
          <select class="form-select" id="health-animal" required ${preAnimalId ? 'disabled' : ''}>
            <option value="">Choisir un animal...</option>
            ${activeAnimals.map(a =>
              `<option value="${a.id}" ${a.id === selectedAnimal ? 'selected' : ''}>${Utils.getEspeceEmoji(a.espece)} ${Utils.escapeHtml(a.nom)}</option>`
            ).join('')}
          </select>
          ${preAnimalId ? `<input type="hidden" id="health-animal-hidden" value="${preAnimalId}">` : ''}
        </div>

        <!-- Type -->
        <div class="form-group">
          <label class="form-label" for="health-type">Type d'entrée <span class="required">*</span></label>
          <select class="form-select" id="health-type" required>
            <option value="">Choisir le type...</option>
            ${Object.entries(Utils.TYPES_SANTE).map(([key, info]) =>
              `<option value="${key}" ${key === selectedType ? 'selected' : ''}>${info.icon} ${info.label}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Date -->
        <div class="form-group">
          <label class="form-label" for="health-date">Date <span class="required">*</span></label>
          <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="health-date" required value="${entry.date ? Utils.formatDateInput(entry.date) : Utils.todayInput()}">
        </div>

        <!-- Titre -->
        <div class="form-group">
          <label class="form-label" for="health-titre" id="health-titre-label">Titre / Résumé court <span class="required">*</span></label>
          <input class="form-input" type="text" id="health-titre" required value="${Utils.escapeHtml(entry.titre || '')}" placeholder="Ex: Vaccin CHPPIL, Vermifuge Milbemax...">
        </div>

        <!-- Détails -->
        <div class="form-group">
          <label class="form-label" for="health-details" id="health-details-label">Détails</label>
          <textarea class="form-textarea" id="health-details" rows="3" placeholder="Description complète...">${Utils.escapeHtml(entry.details || '')}</textarea>
        </div>

        <!-- Vétérinaire -->
        <div class="form-group">
          <label class="form-label" for="health-veto">Vétérinaire</label>
          <input class="form-input" type="text" id="health-veto" value="${Utils.escapeHtml(entry.vetoNom || '')}" placeholder="Nom du vétérinaire (optionnel)">
        </div>

        <!-- Champs conditionnels -->
        <div id="health-conditional-fields"></div>

        <!-- Date rappel -->
        <div class="form-group" id="health-rappel-group">
          <label class="form-label" for="health-rappel">Date de rappel</label>
          <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="health-rappel" value="${entry.rappelDate ? Utils.formatDateInput(entry.rappelDate) : ''}">
          <div class="form-hint">Sera notifié sur le dashboard</div>
        </div>

        <!-- Upload document -->
        <div class="form-group">
          <label class="form-label">Documents (ordonnance, CR signé...)</label>
          <input type="file" id="health-docs" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="form-input" style="padding:10px;">
          <div class="form-hint">PDF, images ou documents</div>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">${isEdit ? 'Enregistrer' : 'Ajouter l\'entrée'}</button>
      </form>
    `);

    // ---- Champs conditionnels selon le type ----
    const typeSelect = document.getElementById('health-type');
    typeSelect.addEventListener('change', () => {
      updateConditionalFields(selectedAnimalObj);
      updateLabelsForType();
    });
    updateConditionalFields(selectedAnimalObj);
    updateLabelsForType();

    // ---- Submit ----
    document.getElementById('health-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const animalId = document.getElementById('health-animal-hidden')?.value || document.getElementById('health-animal').value;
      if (!animalId) {
        UI.toast('Veuillez sélectionner un animal', 'error');
        return;
      }

      const type = document.getElementById('health-type').value;
      const dateVal = document.getElementById('health-date').value;
      const rappelVal = document.getElementById('health-rappel').value;

      const data = {
        type: type,
        date: firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(dateVal)),
        titre: document.getElementById('health-titre').value.trim(),
        details: document.getElementById('health-details').value.trim(),
        vetoNom: document.getElementById('health-veto').value.trim(),
        rappelDate: rappelVal ? firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(rappelVal)) : null,
        documentsURLs: [],
        metadata: getConditionalData(type)
      };

      try {
        // Upload documents
        const docsInput = document.getElementById('health-docs');
        if (docsInput.files.length > 0) {
          for (const file of docsInput.files) {
            const url = await DB.uploadDocument(uid, animalId, file);
            data.documentsURLs.push(url);
          }
        }

        if (isEdit) {
          await DB.updateHealthEntry(uid, animalId, entryId, data);
          UI.toast('Entrée mise à jour', 'success');
        } else {
          await DB.addHealthEntry(uid, animalId, data);
          UI.toast('Entrée ajoutée', 'success');
        }

        // Si chirurgie de stérilisation, proposer de mettre à jour le statut reproducteur
        if (type === 'chirurgie') {
          const chirType = document.getElementById('cond-chirurgie-type')?.value;
          if (chirType === 'sterilisation') {
            await DB.updateAnimal(uid, animalId, { statutReproducteur: 'steriliseChirurgical' });
            UI.toast('Statut reproducteur mis à jour', 'success');
          }
        }

        // Si décès, mettre à jour le statut de l'animal
        if (type === 'deces' || type === 'euthanasie') {
          await DB.updateAnimal(uid, animalId, { statut: 'decede' });
        }

        // Si réforme
        if (type === 'reforme') {
          await DB.updateAnimal(uid, animalId, { statut: 'reforme' });
        }

        UI.navigateTo('animal-detail', { id: animalId });
      } catch (err) {
        console.error('Erreur sauvegarde entrée sanitaire', err);
        UI.toast('Erreur de sauvegarde', 'error');
      }
    });
  }

  function updateConditionalFields(animalObj) {
    const type = document.getElementById('health-type').value;
    const container = document.getElementById('health-conditional-fields');
    const espece = animalObj?.espece || document.getElementById('health-animal')?.selectedOptions[0]?.textContent?.includes('🐕') ? 'canin' : 'felin';

    let html = '';

    switch (type) {
      case 'vaccin':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-vaccin-nom">Nom du vaccin</label>
              <input class="form-input" type="text" id="cond-vaccin-nom" placeholder="Ex: CHPPIL, Leucofeligen...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="cond-vaccin-lot">N° de lot</label>
                <input class="form-input" type="text" id="cond-vaccin-lot" placeholder="N° lot">
              </div>
              <div class="form-group">
                <label class="form-label" for="cond-vaccin-rappel">Rappel dans (mois)</label>
                <input class="form-input" type="number" id="cond-vaccin-rappel" min="1" max="36" value="12" placeholder="12">
              </div>
            </div>
          </div>
        `;
        // Auto-calcul rappel
        setTimeout(() => {
          const rappelMois = document.getElementById('cond-vaccin-rappel');
          if (rappelMois) {
            rappelMois.addEventListener('change', () => {
              const dateVal = document.getElementById('health-date').value;
              if (dateVal && rappelMois.value) {
                const rappelDate = Utils.addMonths(new Date(dateVal), parseInt(rappelMois.value));
                document.getElementById('health-rappel').value = Utils.formatDateInput(rappelDate);
              }
            });
            // Trigger initial
            rappelMois.dispatchEvent(new Event('change'));
          }
        }, 50);
        break;

      case 'traitement':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-trait-med">Médicament</label>
              <input class="form-input" type="text" id="cond-trait-med" placeholder="Nom du médicament">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-trait-poso">Posologie</label>
              <input class="form-input" type="text" id="cond-trait-poso" placeholder="Ex: 1 comprimé / jour pendant 5 jours">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-trait-datefin">Date de fin du traitement</label>
              <input class="form-input" type="date" id="cond-trait-datefin">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-trait-ordo">N° ordonnance</label>
              <input class="form-input" type="text" id="cond-trait-ordo" placeholder="Optionnel">
            </div>
          </div>
        `;
        break;

      case 'prophylaxie':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-prophy-type">Type de prophylaxie</label>
              <select class="form-select" id="cond-prophy-type">
                <option value="vermifuge">Vermifuge</option>
                <option value="antiparasitaire">Antiparasitaire externe</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-prophy-produit">Produit</label>
              <input class="form-input" type="text" id="cond-prophy-produit" placeholder="Nom du produit">
            </div>
          </div>
        `;
        break;

      case 'chirurgie':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-chirurgie-type">Type de chirurgie</label>
              <select class="form-select" id="cond-chirurgie-type">
                <option value="sterilisation">Stérilisation</option>
                <option value="cesarienne">Césarienne</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-chirurgie-notes">Notes opératoires</label>
              <textarea class="form-textarea" id="cond-chirurgie-notes" rows="2" placeholder="Détails de l'intervention"></textarea>
            </div>
          </div>
        `;
        break;

      case 'visite_veto':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-visite-cr">Compte-rendu de visite</label>
              <textarea class="form-textarea" id="cond-visite-cr" rows="4" placeholder="Compte-rendu détaillé de la visite sanitaire..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-visite-modif">Propositions de modification du règlement</label>
              <textarea class="form-textarea" id="cond-visite-modif" rows="2" placeholder="Optionnel"></textarea>
            </div>
          </div>
        `;
        break;

      case 'symptome':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-sympt-comm">Commémoratifs</label>
              <textarea class="form-textarea" id="cond-sympt-comm" rows="2" placeholder="Historique et contexte"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-sympt-exam">Examens complémentaires</label>
              <textarea class="form-textarea" id="cond-sympt-exam" rows="2" placeholder="Examens réalisés"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-sympt-diag">Diagnostic</label>
              <input class="form-input" type="text" id="cond-sympt-diag" placeholder="Diagnostic posé">
            </div>
          </div>
        `;
        break;

      case 'isolement':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-iso-motif">Motif de l'isolement</label>
              <input class="form-input" type="text" id="cond-iso-motif" placeholder="Raison de l'isolement">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-iso-duree">Durée prévue</label>
              <input class="form-input" type="text" id="cond-iso-duree" placeholder="Ex: 10 jours">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-iso-justif">Justification</label>
              <textarea class="form-textarea" id="cond-iso-justif" rows="2" placeholder="Justification médicale"></textarea>
            </div>
          </div>
        `;
        break;

      case 'hebergement_indiv':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-heb-raison">Raison comportementale</label>
              <textarea class="form-textarea" id="cond-heb-raison" rows="2" placeholder="Raison de l'hébergement individuel"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-heb-justif">Justification</label>
              <textarea class="form-textarea" id="cond-heb-justif" rows="2" placeholder="Justification détaillée"></textarea>
            </div>
          </div>
        `;
        break;

      case 'vice_redhibitoire': {
        const vices = Utils.VICES_REDHIBITOIRES[espece] || Utils.VICES_REDHIBITOIRES.canin;
        html = `
          <div class="card mb-2" style="background:var(--red-light);">
            <div class="form-group">
              <label class="form-label" for="cond-vice-maladie">Maladie</label>
              <select class="form-select" id="cond-vice-maladie">
                ${vices.map(v => `<option value="${v}">${v}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-toggle">
                <input type="checkbox" id="cond-vice-apres-vente">
                <span>Signalement après vente</span>
              </label>
            </div>
          </div>
        `;
        break;
      }

      case 'suspicion_maladie':
        html = `
          <div class="card mb-2" style="background:var(--red-light);">
            <div class="form-group">
              <label class="form-label" for="cond-susp-details">Détails de la suspicion</label>
              <textarea class="form-textarea" id="cond-susp-details" rows="3" placeholder="Maladie suspectée, symptômes observés..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-susp-actions">Actions prises</label>
              <textarea class="form-textarea" id="cond-susp-actions" rows="2" placeholder="Mesures mises en place"></textarea>
            </div>
          </div>
        `;
        break;

      case 'deces':
      case 'euthanasie':
        html = `
          <div class="card mb-2" style="background:var(--red-light);">
            <div class="form-group">
              <label class="form-label" for="cond-deces-cause">${type === 'euthanasie' ? 'Motif médical' : 'Cause du décès'}</label>
              <textarea class="form-textarea" id="cond-deces-cause" rows="2" placeholder="${type === 'euthanasie' ? 'Motif de l\'euthanasie' : 'Cause de la mort'}"></textarea>
            </div>
          </div>
        `;
        break;

      case 'autopsie':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-autopsie-cr">Compte-rendu signé par le vétérinaire</label>
              <textarea class="form-textarea" id="cond-autopsie-cr" rows="4" placeholder="Résultats de l'autopsie..."></textarea>
            </div>
            <div class="form-hint">Pensez à joindre le document signé ci-dessous</div>
          </div>
        `;
        break;

      case 'eval_comportementale':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-group">
              <label class="form-label" for="cond-eval-resultat">Résultat de l'évaluation</label>
              <textarea class="form-textarea" id="cond-eval-resultat" rows="3" placeholder="Résultats et conclusions"></textarea>
            </div>
            <div class="form-hint">Pensez à joindre la copie de l'évaluation</div>
          </div>
        `;
        break;

      case 'reforme':
        html = `
          <div class="card mb-2" style="background:var(--orange-light);">
            <div class="form-group">
              <label class="form-label" for="cond-reforme-motif">Motif de la réforme</label>
              <textarea class="form-textarea" id="cond-reforme-motif" rows="2" placeholder="Raison de la réforme"></textarea>
            </div>
            <div class="form-group">
              <label class="form-toggle">
                <input type="checkbox" id="cond-reforme-ci">
                <span>Attestation CI stérilisation (si cession)</span>
              </label>
            </div>
          </div>
        `;
        break;

      case 'mise_bas':
        html = `
          <div class="card mb-2" style="background:var(--green-light);">
            <div class="form-hint mb-1" style="color:var(--text-primary);font-weight:700;">
              🍼 Art. 26 — Max. 3 mises bas par période de 2 ans
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="cond-portee-nb">Nombre de petits nés</label>
                <input class="form-input" type="number" id="cond-portee-nb" min="0" max="20" placeholder="Ex: 5">
              </div>
              <div class="form-group">
                <label class="form-label" for="cond-portee-vivants">Dont vivants</label>
                <input class="form-input" type="number" id="cond-portee-vivants" min="0" max="20" placeholder="Ex: 5">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-portee-pere">Père de la portée</label>
              <input class="form-input" type="text" id="cond-portee-pere" placeholder="Nom ou n° identification du père">
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-portee-observations">Observations</label>
              <textarea class="form-textarea" id="cond-portee-observations" rows="2" placeholder="Déroulement de la mise bas, complications éventuelles..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-toggle">
                <input type="checkbox" id="cond-portee-cesarienne">
                <span>Mise bas par césarienne</span>
              </label>
            </div>
          </div>
        `;
        break;

      case 'examen_pre_repro':
        html = `
          <div class="card mb-2" style="background:var(--blue-light);">
            <div class="form-hint mb-1" style="color:var(--text-primary);font-weight:700;">
              🔬 Art. 26 — Obligatoire pour les chiennes dès 8 ans et chattes dès 6 ans
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-prerepro-resultat">Conclusion du vétérinaire</label>
              <select class="form-select" id="cond-prerepro-resultat">
                <option value="apte">Apte à la reproduction — pas de contre-indication</option>
                <option value="inapte">Inapte — contre-indication médicale</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="cond-prerepro-details">Détails de l'examen</label>
              <textarea class="form-textarea" id="cond-prerepro-details" rows="3" placeholder="Examens réalisés, observations cliniques..."></textarea>
            </div>
            <div class="form-hint">Le vétérinaire doit confirmer par écrit l'absence de contre-indication. Pensez à joindre le document signé ci-dessous.</div>
          </div>
        `;
        break;

      case 'pesee':
        html = `
          <div class="card mb-2" style="background:var(--accent-light);">
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label class="form-label" for="cond-pesee-poids">Poids <span class="required">*</span></label>
                <input class="form-input" type="number" id="cond-pesee-poids" min="0" step="0.1" placeholder="Ex: 4.5">
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label" for="cond-pesee-unite">Unité</label>
                <select class="form-select" id="cond-pesee-unite">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
            </div>
            <div class="form-hint">Ce poids sera affiché dans la courbe de poids de l'animal.</div>
          </div>
        `;
        // Auto-remplissage du titre quand le poids change
        setTimeout(() => {
          const poidsInput = document.getElementById('cond-pesee-poids');
          const uniteInput = document.getElementById('cond-pesee-unite');
          const titreInput = document.getElementById('health-titre');
          function updateTitrePesee() {
            const p = poidsInput?.value;
            const u = uniteInput?.value || 'kg';
            if (p && titreInput) titreInput.value = `Pesée — ${p} ${u}`;
          }
          poidsInput?.addEventListener('input', updateTitrePesee);
          uniteInput?.addEventListener('change', updateTitrePesee);
        }, 50);
        break;
    }

    container.innerHTML = html;
  }

  function getConditionalData(type) {
    const metadata = {};

    switch (type) {
      case 'vaccin':
        metadata.nomVaccin = document.getElementById('cond-vaccin-nom')?.value || '';
        metadata.lot = document.getElementById('cond-vaccin-lot')?.value || '';
        metadata.rappelMois = parseInt(document.getElementById('cond-vaccin-rappel')?.value) || 12;
        break;
      case 'traitement':
        metadata.medicament = document.getElementById('cond-trait-med')?.value || '';
        metadata.posologie = document.getElementById('cond-trait-poso')?.value || '';
        metadata.dateFin = document.getElementById('cond-trait-datefin')?.value || '';
        metadata.ordonnance = document.getElementById('cond-trait-ordo')?.value || '';
        break;
      case 'prophylaxie':
        metadata.typeProphylaxie = document.getElementById('cond-prophy-type')?.value || '';
        metadata.produit = document.getElementById('cond-prophy-produit')?.value || '';
        break;
      case 'chirurgie':
        metadata.typeChirurgie = document.getElementById('cond-chirurgie-type')?.value || '';
        metadata.notesOperatoires = document.getElementById('cond-chirurgie-notes')?.value || '';
        break;
      case 'visite_veto':
        metadata.compteRendu = document.getElementById('cond-visite-cr')?.value || '';
        metadata.propositionsModif = document.getElementById('cond-visite-modif')?.value || '';
        break;
      case 'symptome':
        metadata.commemoratifs = document.getElementById('cond-sympt-comm')?.value || '';
        metadata.examens = document.getElementById('cond-sympt-exam')?.value || '';
        metadata.diagnostic = document.getElementById('cond-sympt-diag')?.value || '';
        break;
      case 'isolement':
        metadata.motif = document.getElementById('cond-iso-motif')?.value || '';
        metadata.duree = document.getElementById('cond-iso-duree')?.value || '';
        metadata.justification = document.getElementById('cond-iso-justif')?.value || '';
        break;
      case 'hebergement_indiv':
        metadata.raison = document.getElementById('cond-heb-raison')?.value || '';
        metadata.justification = document.getElementById('cond-heb-justif')?.value || '';
        break;
      case 'vice_redhibitoire':
        metadata.maladie = document.getElementById('cond-vice-maladie')?.value || '';
        metadata.signalementApresVente = document.getElementById('cond-vice-apres-vente')?.checked || false;
        break;
      case 'suspicion_maladie':
        metadata.details = document.getElementById('cond-susp-details')?.value || '';
        metadata.actions = document.getElementById('cond-susp-actions')?.value || '';
        break;
      case 'deces':
      case 'euthanasie':
        metadata.cause = document.getElementById('cond-deces-cause')?.value || '';
        break;
      case 'autopsie':
        metadata.compteRendu = document.getElementById('cond-autopsie-cr')?.value || '';
        break;
      case 'eval_comportementale':
        metadata.resultat = document.getElementById('cond-eval-resultat')?.value || '';
        break;
      case 'reforme':
        metadata.motif = document.getElementById('cond-reforme-motif')?.value || '';
        metadata.attestationCISterilisation = document.getElementById('cond-reforme-ci')?.checked || false;
        break;
      case 'mise_bas':
        metadata.nbNes = parseInt(document.getElementById('cond-portee-nb')?.value) || 0;
        metadata.nbVivants = parseInt(document.getElementById('cond-portee-vivants')?.value) || 0;
        metadata.perePortee = document.getElementById('cond-portee-pere')?.value || '';
        metadata.observations = document.getElementById('cond-portee-observations')?.value || '';
        metadata.parCesarienne = document.getElementById('cond-portee-cesarienne')?.checked || false;
        break;
      case 'examen_pre_repro':
        metadata.resultat = document.getElementById('cond-prerepro-resultat')?.value || '';
        metadata.details = document.getElementById('cond-prerepro-details')?.value || '';
        break;
      case 'pesee': {
        const poidsRaw = parseFloat(document.getElementById('cond-pesee-poids')?.value);
        const unite = document.getElementById('cond-pesee-unite')?.value || 'kg';
        // Stocker toujours en grammes pour les courbes
        metadata.poids = isNaN(poidsRaw) ? null : (unite === 'g' ? poidsRaw : poidsRaw * 1000);
        metadata.poidsAffiche = poidsRaw;
        metadata.poidsUnite = unite;
        break;
      }
    }

    return metadata;
  }

  function updateLabelsForType() {
    const type = document.getElementById('health-type').value;
    const titreLabel = document.getElementById('health-titre-label');
    const titreInput = document.getElementById('health-titre');
    const detailsLabel = document.getElementById('health-details-label');
    const detailsInput = document.getElementById('health-details');

    if (!titreLabel || !titreInput) return;

    const config = {
      vaccin: { titre: 'Nom du vaccin', placeholder: 'Ex: CHPPIL, Leucofeligen, Purevax RC...', details: 'Observations', detailsPlaceholder: 'Réaction, remarques...' },
      traitement: { titre: 'Nom du traitement', placeholder: 'Ex: Vermifuge Milbemax, Antibiotique...', details: 'Observations', detailsPlaceholder: 'Réaction, évolution...' },
      prophylaxie: { titre: 'Type de prophylaxie', placeholder: 'Ex: Vermifuge, Antiparasitaire...', details: 'Observations', detailsPlaceholder: 'Remarques...' },
      chirurgie: { titre: 'Type de chirurgie', placeholder: 'Ex: Stérilisation, Césarienne...', details: 'Compte-rendu', detailsPlaceholder: 'Détails de l\'intervention...' },
      visite_veto: { titre: 'Objet de la visite', placeholder: 'Ex: Visite sanitaire annuelle', details: 'Compte-rendu', detailsPlaceholder: 'Observations du vétérinaire...' },
      mise_bas: { titre: 'Portée de', placeholder: 'Ex: Portée de Boune x Rex', details: 'Déroulement', detailsPlaceholder: 'Déroulement de la mise bas...' },
      examen_pre_repro: { titre: 'Objet de l\'examen', placeholder: 'Ex: Examen pré-reproduction', details: 'Résultats', detailsPlaceholder: 'Résultats et observations cliniques...' },
      symptome: { titre: 'Symptôme observé', placeholder: 'Ex: Boiterie, Toux, Diarrhée...', details: 'Description', detailsPlaceholder: 'Description détaillée des symptômes...' },
      deces: { titre: 'Cause du décès', placeholder: 'Ex: Arrêt cardiaque, Maladie...', details: 'Circonstances', detailsPlaceholder: 'Circonstances du décès...' },
      euthanasie: { titre: 'Motif de l\'euthanasie', placeholder: 'Ex: Souffrance chronique...', details: 'Circonstances', detailsPlaceholder: 'Détails et justification médicale...' },
      isolement: { titre: 'Motif de l\'isolement', placeholder: 'Ex: Suspicion de teigne...', details: 'Mesures prises', detailsPlaceholder: 'Mesures sanitaires mises en place...' },
      pesee: { titre: 'Pesée', placeholder: 'Sera rempli automatiquement...', details: 'Observations', detailsPlaceholder: 'Remarques (état corporel, contexte...)' }
    };

    const c = config[type] || { titre: 'Titre / Résumé court', placeholder: 'Ex: Vaccin CHPPIL, Vermifuge Milbemax...', details: 'Détails', detailsPlaceholder: 'Description complète...' };

    titreLabel.innerHTML = `${c.titre} <span class="required">*</span>`;
    titreInput.placeholder = c.placeholder;
    if (detailsLabel) detailsLabel.textContent = c.details;
    if (detailsInput) detailsInput.placeholder = c.detailsPlaceholder;
  }

  function _deleteEntry(animalId, entryId) {
    UI.confirmModal('Supprimer cette entrée sanitaire ?', async () => {
      const uid = Auth.getUid();
      await DB.deleteHealthEntry(uid, animalId, entryId);
      UI.toast('Entrée supprimée', 'success');
      renderJournal();
    });
  }

  return { renderJournal, renderForm, _deleteEntry };
})();
