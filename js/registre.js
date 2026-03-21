/**
 * ElevApp — Module Registre des Entrées / Sorties
 * Art. 7-8 Arrêté du 19 juin 2025
 * Enregistrement obligatoire sous 72h de chaque mouvement
 */

const Registre = (() => {
  'use strict';

  const MOTIFS_ENTREE = {
    naissance: 'Naissance dans l\'élevage',
    achat: 'Achat / Acquisition',
    retour: 'Retour d\'un animal',
    pension: 'Prise en pension',
    autre: 'Autre'
  };

  const MOTIFS_SORTIE = {
    vente: 'Vente',
    don: 'Don',
    deces: 'Décès',
    euthanasie: 'Euthanasie',
    fugue: 'Fugue / Perte',
    pension_fin: 'Fin de pension',
    reforme: 'Réforme',
    autre: 'Autre'
  };

  // ---- Page principale du registre ----
  async function render() {
    UI.setContent(`
      ${UI.pageHeader('Registre Entrées / Sorties')}
      <div id="registre-content">
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const mouvements = await getMouvements(uid);
      const animals = await DB.getAnimals(uid);

      // Vérifier les mouvements en retard (> 72h sans enregistrement)
      const alertes72h = checkMouvementsEnRetard(animals, mouvements);

      document.getElementById('registre-content').innerHTML = `
        ${alertes72h.length > 0 ? `
          <div class="alert-card mb-2" style="border-left: 3px solid var(--red);">
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
              <div class="alert-title">${alertes72h.length} mouvement(s) potentiellement non enregistré(s)</div>
              <div class="alert-desc">L'arrêté impose un enregistrement sous 72h</div>
            </div>
          </div>
        ` : ''}

        <div class="card mb-2">
          <button class="btn btn-primary btn-block" id="btn-nouvelle-entree">
            ➕ Nouvelle entrée d'animal
          </button>
          <button class="btn btn-secondary btn-block mt-1" id="btn-nouvelle-sortie">
            ➖ Nouvelle sortie d'animal
          </button>
        </div>

        <div class="section-title"><span class="section-icon">📋</span> Historique des mouvements</div>

        ${mouvements.length === 0 ? `
          <p class="text-center text-muted" style="font-size:0.85rem;">Aucun mouvement enregistré</p>
        ` : `
          ${mouvements.map(m => {
            const isEntree = m.direction === 'entree';
            const motifLabel = isEntree ? (MOTIFS_ENTREE[m.motif] || m.motif) : (MOTIFS_SORTIE[m.motif] || m.motif);
            const animalNom = m.animalNom || 'Animal inconnu';
            const dateStr = Utils.formatDate(m.date);
            return `
              <div class="card mb-1">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:1.3rem;">${isEntree ? '🟢' : '🔴'}</span>
                  <div style="flex:1;">
                    <div style="font-weight:600;">${isEntree ? 'Entrée' : 'Sortie'} — ${Utils.escapeHtml(animalNom)}</div>
                    <div class="card-subtitle">${dateStr} — ${motifLabel}</div>
                    ${m.destinataire ? `<div class="card-subtitle">Destinataire : ${Utils.escapeHtml(m.destinataire)}</div>` : ''}
                    ${m.adresseDestinataire ? `<div class="card-subtitle">Adresse : ${Utils.escapeHtml(m.adresseDestinataire)}</div>` : ''}
                    ${m.causeDeces ? `<div class="card-subtitle">Cause du décès : ${Utils.escapeHtml(m.causeDeces)}</div>` : ''}
                    ${m.provenance ? `<div class="card-subtitle">Provenance : ${Utils.escapeHtml(m.provenance)}</div>` : ''}
                    ${m.observations ? `<div class="card-subtitle" style="font-style:italic;">${Utils.escapeHtml(m.observations)}</div>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        `}
      `;

      document.getElementById('btn-nouvelle-entree').addEventListener('click', () => renderFormMouvement('entree'));
      document.getElementById('btn-nouvelle-sortie').addEventListener('click', () => renderFormMouvement('sortie'));

    } catch (err) {
      console.error('Erreur registre', err);
      document.getElementById('registre-content').innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  // ---- Formulaire d'ajout de mouvement ----
  async function renderFormMouvement(direction) {
    const uid = Auth.getUid();
    if (!uid) return;

    const animals = await DB.getAnimals(uid);
    const motifs = direction === 'entree' ? MOTIFS_ENTREE : MOTIFS_SORTIE;
    const animauxFiltres = direction === 'entree'
      ? animals // Pour une entrée, on peut aussi réenregistrer un animal existant
      : animals.filter(a => a.statut === 'actif'); // Pour une sortie, seulement les actifs

    UI.setContent(`
      ${UI.pageHeader(direction === 'entree' ? 'Nouvelle entrée' : 'Nouvelle sortie', 'registre')}

      <form id="mouvement-form">
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="mvt-animal">Animal <span class="required">*</span></label>
            <select class="form-select" id="mvt-animal" required>
              <option value="">Choisir un animal...</option>
              ${animauxFiltres.map(a => `
                <option value="${a.id}">
                  ${Utils.escapeHtml(a.nom)} — ${Utils.getEspeceEmoji(a.espece)} ${Utils.escapeHtml(a.race || '')}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="mvt-date">Date du mouvement <span class="required">*</span></label>
            <input class="form-input" type="date" id="mvt-date" required value="${new Date().toISOString().split('T')[0]}">
          </div>

          <div class="form-group">
            <label class="form-label" for="mvt-motif">Motif <span class="required">*</span></label>
            <select class="form-select" id="mvt-motif" required>
              ${Object.entries(motifs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Champs conditionnels sortie -->
        ${direction === 'sortie' ? `
          <div class="card mb-2" id="sortie-details">
            <div class="form-group" id="grp-destinataire">
              <label class="form-label" for="mvt-destinataire">Nom du destinataire</label>
              <input class="form-input" type="text" id="mvt-destinataire" placeholder="Nom et prénom de l'acquéreur">
            </div>
            <div class="form-group" id="grp-adresse-dest">
              <label class="form-label" for="mvt-adresse-dest">Adresse du destinataire</label>
              <textarea class="form-textarea" id="mvt-adresse-dest" rows="2" placeholder="Adresse complète"></textarea>
            </div>
            <div class="form-group" id="grp-cause-deces" style="display:none;">
              <label class="form-label" for="mvt-cause-deces">Cause du décès</label>
              <input class="form-input" type="text" id="mvt-cause-deces" placeholder="Si connue">
            </div>
          </div>
        ` : `
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label" for="mvt-provenance">Provenance</label>
              <input class="form-input" type="text" id="mvt-provenance" placeholder="Élevage d'origine, nom du cédant...">
            </div>
          </div>
        `}

        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="mvt-observations">Observations</label>
            <textarea class="form-textarea" id="mvt-observations" rows="2" placeholder="Remarques complémentaires"></textarea>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">
          ${direction === 'entree' ? '➕ Enregistrer l\'entrée' : '➖ Enregistrer la sortie'}
        </button>
      </form>
    `);

    // Toggle conditionnel décès
    if (direction === 'sortie') {
      document.getElementById('mvt-motif').addEventListener('change', (e) => {
        const isDeces = e.target.value === 'deces' || e.target.value === 'euthanasie';
        const isFugue = e.target.value === 'fugue';
        document.getElementById('grp-cause-deces').style.display = isDeces ? '' : 'none';
        document.getElementById('grp-destinataire').style.display = (isDeces || isFugue) ? 'none' : '';
        document.getElementById('grp-adresse-dest').style.display = (isDeces || isFugue) ? 'none' : '';
      });
    }

    // Submit
    document.getElementById('mouvement-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const animalId = document.getElementById('mvt-animal').value;
      if (!animalId) {
        UI.toast('Veuillez sélectionner un animal', 'error');
        return;
      }

      const animal = animals.find(a => a.id === animalId);
      const motif = document.getElementById('mvt-motif').value;

      const mouvementData = {
        direction: direction,
        animalId: animalId,
        animalNom: animal ? animal.nom : 'Inconnu',
        animalIdentification: animal ? (animal.puce || '') : '',
        date: document.getElementById('mvt-date').value,
        motif: motif,
        observations: document.getElementById('mvt-observations')?.value?.trim() || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (direction === 'sortie') {
        mouvementData.destinataire = document.getElementById('mvt-destinataire')?.value?.trim() || '';
        mouvementData.adresseDestinataire = document.getElementById('mvt-adresse-dest')?.value?.trim() || '';
        mouvementData.causeDeces = document.getElementById('mvt-cause-deces')?.value?.trim() || '';
      } else {
        mouvementData.provenance = document.getElementById('mvt-provenance')?.value?.trim() || '';
      }

      try {
        await addMouvement(uid, mouvementData);

        // Si c'est un décès ou euthanasie, proposer de mettre le statut de l'animal à jour
        if (direction === 'sortie' && (motif === 'deces' || motif === 'euthanasie')) {
          await DB.updateAnimal(uid, animalId, { statut: 'decede' });
        } else if (direction === 'sortie' && (motif === 'vente' || motif === 'don')) {
          await DB.updateAnimal(uid, animalId, { statut: 'cede' });
        } else if (direction === 'sortie' && motif === 'reforme') {
          await DB.updateAnimal(uid, animalId, { statut: 'reforme' });
        }

        UI.toast('Mouvement enregistré !', 'success');
        UI.navigateTo('registre');
      } catch (err) {
        console.error('Erreur enregistrement mouvement', err);
        UI.toast('Erreur lors de l\'enregistrement', 'error');
      }
    });
  }

  // ---- Firestore helpers ----
  function mouvementsRef(uid) {
    return firebase.firestore().collection('users').doc(uid).collection('mouvements');
  }

  async function getMouvements(uid) {
    const snapshot = await mouvementsRef(uid).get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    results.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db2 = b.date ? new Date(b.date) : new Date(0);
      return db2 - da;
    });
    return results;
  }

  async function addMouvement(uid, data) {
    return await mouvementsRef(uid).add(data);
  }

  // ---- Vérification mouvements en retard ----
  function checkMouvementsEnRetard(animals, mouvements) {
    const alertes = [];
    // Vérifier si un animal a le statut "cédé" ou "décédé" mais aucun mouvement de sortie
    const animauxSortis = animals.filter(a => ['cede', 'decede', 'reforme'].includes(a.statut));
    for (const animal of animauxSortis) {
      const mvtSortie = mouvements.find(m => m.animalId === animal.id && m.direction === 'sortie');
      if (!mvtSortie) {
        alertes.push({
          animal: animal.nom,
          message: `${animal.nom} a le statut "${Utils.STATUTS_ANIMAL[animal.statut]}" mais aucune sortie enregistrée`
        });
      }
    }
    return alertes;
  }

  // ---- Export pour PDF ----
  async function getMouvementsForExport(uid) {
    return await getMouvements(uid);
  }

  return { render, renderFormMouvement, getMouvementsForExport };
})();
