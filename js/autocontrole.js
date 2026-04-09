/**
 * ElevApp — Module Autocontrôles
 * Art. 9 Arrêté du 19 juin 2025
 * Grille d'inspection périodique obligatoire
 */

const Autocontrole = (() => {
  'use strict';

  // Grille d'autocontrôle conforme à l'arrêté
  const GRILLE_ITEMS = [
    { id: 'etat_general', categorie: 'Animaux', label: 'État général des animaux (poids, pelage, comportement)' },
    { id: 'alimentation', categorie: 'Animaux', label: 'Alimentation adaptée et eau fraîche à disposition' },
    { id: 'signes_maladie', categorie: 'Animaux', label: 'Absence de signes de maladie ou de blessure' },
    { id: 'parasites', categorie: 'Animaux', label: 'Absence de parasites externes (puces, tiques)' },
    { id: 'sociabilisation', categorie: 'Animaux', label: 'Sociabilisation correcte des animaux' },
    { id: 'proprete_locaux', categorie: 'Locaux', label: 'Propreté générale des locaux d\'hébergement' },
    { id: 'desinfection', categorie: 'Locaux', label: 'Désinfection régulière des surfaces' },
    { id: 'ventilation', categorie: 'Locaux', label: 'Ventilation et température adaptées' },
    { id: 'eclairage', categorie: 'Locaux', label: 'Éclairage naturel ou artificiel suffisant' },
    { id: 'surface', categorie: 'Locaux', label: 'Surface d\'hébergement conforme (min. réglementaire)' },
    { id: 'litiere', categorie: 'Locaux', label: 'Litière / couchage propre et sec' },
    { id: 'espace_exercice', categorie: 'Locaux', label: 'Accès à un espace d\'exercice / aire de détente' },
    { id: 'registre_jour', categorie: 'Registres', label: 'Registre des entrées/sorties à jour' },
    { id: 'registre_sanitaire', categorie: 'Registres', label: 'Registre sanitaire à jour' },
    { id: 'identification', categorie: 'Registres', label: 'Tous les animaux identifiés (puce / tatouage)' },
    { id: 'vaccinations', categorie: 'Registres', label: 'Vaccinations à jour' },
    { id: 'prophylaxie', categorie: 'Registres', label: 'Prophylaxie antiparasitaire à jour' },
    { id: 'reglement_sanitaire', categorie: 'Documents', label: 'Règlement sanitaire affiché / disponible' },
    { id: 'certificat_capacite', categorie: 'Documents', label: 'ACACED / Certificat de capacité à jour' },
    { id: 'assurance', categorie: 'Documents', label: 'Assurance responsabilité civile professionnelle' },
    { id: 'stockage_medicaments', categorie: 'Sécurité', label: 'Stockage sécurisé des médicaments' },
    { id: 'materiel_nettoyage', categorie: 'Sécurité', label: 'Matériel de nettoyage / désinfection disponible' },
    { id: 'quarantaine', categorie: 'Sécurité', label: 'Local de quarantaine / isolement disponible' }
  ];

  const RESULTATS = {
    conforme: { label: 'Conforme', emoji: '✅', class: 'green' },
    non_conforme: { label: 'Non conforme', emoji: '❌', class: 'red' },
    na: { label: 'N/A', emoji: '➖', class: 'grey' }
  };

  // ---- Page principale autocontrôles ----
  async function render() {
    UI.setContent(`
      ${UI.pageHeader('Autocontrôles')}
      <div id="autocontrole-content">
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const controles = await getControles(uid);

      // Calcul alertes
      const dernierControle = controles.length > 0 ? controles[0] : null;
      let alerteFrequence = null;
      if (!dernierControle) {
        alerteFrequence = 'Aucun autocontrôle réalisé — l\'arrêté impose des contrôles réguliers';
      } else {
        const dateDernier = new Date(dernierControle.date);
        const joursDepuis = Utils.daysBetween(dateDernier, new Date());
        if (joursDepuis > 90) {
          alerteFrequence = `Dernier autocontrôle il y a ${Math.round(joursDepuis)} jours — un contrôle trimestriel est recommandé`;
        }
      }

      document.getElementById('autocontrole-content').innerHTML = `
        ${alerteFrequence ? `
          <div class="alert-card mb-2" style="border-left: 3px solid var(--orange);">
            <div class="alert-icon">${Icons.get('clipboardCheck')}</div>
            <div class="alert-content">
              <div class="alert-title">Autocontrôle recommandé</div>
              <div class="alert-desc">${alerteFrequence}</div>
            </div>
          </div>
        ` : ''}

        <div class="card mb-2">
          <button class="btn btn-primary btn-block" id="btn-nouveau-controle">
            ${Icons.get('clipboardCheck', 14)} Nouvel autocontrôle
          </button>
        </div>

        <div class="section-title"><div class="section-icon">${Icons.get('clipboardCheck', 18)}</div> Historique</div>

        ${controles.length === 0 ? `
          <p class="text-center text-muted" style="font-size:0.85rem;">Aucun autocontrôle réalisé</p>
        ` : `
          ${controles.map(c => {
            const nbTotal = Object.keys(c.resultats || {}).length;
            const nbConformes = Object.values(c.resultats || {}).filter(r => r === 'conforme').length;
            const nbNonConformes = Object.values(c.resultats || {}).filter(r => r === 'non_conforme').length;
            const pourcent = nbTotal > 0 ? Math.round((nbConformes / (nbTotal - Object.values(c.resultats || {}).filter(r => r === 'na').length)) * 100) || 0 : 0;
            return `
              <div class="card mb-1" data-action="autocontrole-detail" data-id="${c.id}" style="cursor:pointer;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-weight:600;">Contrôle du ${Utils.formatDate(c.date)}</div>
                    <div class="card-subtitle">
                      ${Icons.get('checkCircle', 14)} ${nbConformes} conformes — ${Icons.get('x', 14)} ${nbNonConformes} non conformes
                    </div>
                    ${c.visePar ? `<div class="card-subtitle">Visé par : ${Utils.escapeHtml(c.visePar)}</div>` : ''}
                  </div>
                  <span class="badge badge-${pourcent >= 80 ? 'green' : pourcent >= 50 ? 'orange' : 'red'}">${pourcent}%</span>
                </div>
                ${c.actionsCorrectives ? `<div class="card-subtitle mt-1" style="font-style:italic;">Actions correctives : ${Utils.escapeHtml(c.actionsCorrectives).substring(0, 80)}...</div>` : ''}
              </div>
            `;
          }).join('')}
        `}
      `;

      document.getElementById('btn-nouveau-controle').addEventListener('click', () => renderFormControle());

      document.getElementById('autocontrole-content').addEventListener('click', (e) => {
        const card = e.target.closest('[data-action="autocontrole-detail"]');
        if (card) renderDetail(card.dataset.id);
      });

    } catch (err) {
      console.error('Erreur autocontrôles', err);
      document.getElementById('autocontrole-content').innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  // ---- Formulaire d'autocontrôle ----
  async function renderFormControle() {
    const uid = Auth.getUid();
    if (!uid) return;

    // Grouper les items par catégorie
    const categories = {};
    GRILLE_ITEMS.forEach(item => {
      if (!categories[item.categorie]) categories[item.categorie] = [];
      categories[item.categorie].push(item);
    });

    const categorieIcons = {
      'Animaux': 'paw',
      'Locaux': 'home',
      'Registres': 'health',
      'Documents': 'fileText',
      'Sécurité': 'alertCircle'
    };

    UI.setContent(`
      ${UI.pageHeader('Nouvel autocontrôle', 'autocontrole')}

      <form id="controle-form">
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="ctrl-date">Date du contrôle <span class="required">*</span></label>
            <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="ctrl-date" required value="${Utils.todayInput()}">
          </div>
          <div class="form-group">
            <label class="form-label" for="ctrl-controleur">Contrôleur</label>
            <input class="form-input" type="text" id="ctrl-controleur" placeholder="Nom de la personne réalisant le contrôle">
          </div>
        </div>

        ${Object.entries(categories).map(([cat, items]) => `
          <div class="section-title"><div class="section-icon">${Icons.get(categorieIcons[cat] || 'health', 18)}</div> ${cat}</div>
          <div class="card mb-2">
            ${items.map(item => `
              <div class="autocontrole-item" style="padding:8px 0;border-bottom:1px solid var(--border);">
                <div style="font-size:0.85rem;margin-bottom:4px;">${item.label}</div>
                <div style="display:flex;gap:8px;">
                  <label class="form-toggle" style="flex:1;justify-content:center;">
                    <input type="radio" name="ctrl-${item.id}" value="conforme">
                    <span style="font-size:0.8rem;">${Icons.get('checkCircle', 14)} OK</span>
                  </label>
                  <label class="form-toggle" style="flex:1;justify-content:center;">
                    <input type="radio" name="ctrl-${item.id}" value="non_conforme">
                    <span style="font-size:0.8rem;">${Icons.get('x', 14)} NC</span>
                  </label>
                  <label class="form-toggle" style="flex:1;justify-content:center;">
                    <input type="radio" name="ctrl-${item.id}" value="na" checked>
                    <span style="font-size:0.8rem;">— N/A</span>
                  </label>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}

        <div class="section-title"><span class="section-icon">🔧</span> Actions correctives</div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="ctrl-actions">Actions correctives et préventives</label>
            <textarea class="form-textarea" id="ctrl-actions" rows="3" placeholder="Décrire les actions à mettre en place pour les non-conformités..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="ctrl-vise">Visé par le vétérinaire sanitaire</label>
            <input class="form-input" type="text" id="ctrl-vise" placeholder="Nom du vétérinaire (si applicable)">
          </div>
          <div class="form-group">
            <label class="form-label" for="ctrl-observations">Observations générales</label>
            <textarea class="form-textarea" id="ctrl-observations" rows="2" placeholder="Remarques complémentaires"></textarea>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">
          ${Icons.get('clipboardCheck', 14)} Enregistrer l'autocontrôle
        </button>
      </form>
    `);

    document.getElementById('controle-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const resultats = {};
      GRILLE_ITEMS.forEach(item => {
        const radios = document.getElementsByName(`ctrl-${item.id}`);
        for (const radio of radios) {
          if (radio.checked) {
            resultats[item.id] = radio.value;
            break;
          }
        }
      });

      const data = {
        date: (() => { const d = Utils.parseDateInput(document.getElementById('ctrl-date').value); return d ? d.toISOString().split('T')[0] : ''; })(),
        controleur: document.getElementById('ctrl-controleur').value.trim(),
        resultats: resultats,
        actionsCorrectives: document.getElementById('ctrl-actions').value.trim(),
        visePar: document.getElementById('ctrl-vise').value.trim(),
        observations: document.getElementById('ctrl-observations').value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        await addControle(uid, data);
        UI.toast('Autocontrôle enregistré !', 'success');
        UI.navigateTo('autocontrole');
      } catch (err) {
        console.error('Erreur enregistrement contrôle', err);
        UI.toast('Erreur lors de l\'enregistrement', 'error');
      }
    });
  }

  // ---- Détail d'un autocontrôle ----
  async function renderDetail(controleId) {
    const uid = Auth.getUid();
    if (!uid) return;

    UI.setContent(`
      ${UI.pageHeader('Détail autocontrôle', 'autocontrole')}
      <div id="detail-content"><div class="skeleton skeleton-card"></div></div>
    `);

    try {
      const doc = await firebase.firestore().collection('users').doc(uid).collection('autocontroles').doc(controleId).get();
      if (!doc.exists) {
        document.getElementById('detail-content').innerHTML = '<p class="text-center text-muted">Contrôle introuvable</p>';
        return;
      }

      const c = { id: doc.id, ...doc.data() };
      const resultats = c.resultats || {};

      // Grouper par catégorie
      const categories = {};
      GRILLE_ITEMS.forEach(item => {
        if (!categories[item.categorie]) categories[item.categorie] = [];
        categories[item.categorie].push(item);
      });

      document.getElementById('detail-content').innerHTML = `
        <div class="card mb-2">
          <div style="font-weight:600;font-size:1.1rem;">Contrôle du ${Utils.formatDate(c.date)}</div>
          ${c.controleur ? `<div class="card-subtitle">Contrôleur : ${Utils.escapeHtml(c.controleur)}</div>` : ''}
          ${c.visePar ? `<div class="card-subtitle">Visé par : ${Utils.escapeHtml(c.visePar)}</div>` : ''}
        </div>

        ${Object.entries(categories).map(([cat, items]) => `
          <div class="section-title"><div class="section-icon">${Icons.get('health', 18)}</div> ${cat}</div>
          <div class="card mb-2">
            ${items.map(item => {
              const res = resultats[item.id] || 'na';
              const info = RESULTATS[res] || RESULTATS.na;
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                  <span style="font-size:0.85rem;">${item.label}</span>
                  <span>${info.class === 'green' ? Icons.get('checkCircle', 14) : info.class === 'red' ? Icons.get('x', 14) : '—'}</span>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}

        ${c.actionsCorrectives ? `
          <div class="section-title"><div class="section-icon">${Icons.get('settings', 18)}</div> Actions correctives</div>
          <div class="card mb-2">
            <p style="font-size:0.85rem;white-space:pre-wrap;">${Utils.escapeHtml(c.actionsCorrectives)}</p>
          </div>
        ` : ''}

        ${c.observations ? `
          <div class="section-title"><div class="section-icon">${Icons.get('penLine', 18)}</div> Observations</div>
          <div class="card mb-2">
            <p style="font-size:0.85rem;white-space:pre-wrap;">${Utils.escapeHtml(c.observations)}</p>
          </div>
        ` : ''}
      `;

    } catch (err) {
      console.error('Erreur détail contrôle', err);
      document.getElementById('detail-content').innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  // ---- Firestore helpers ----
  function controlesRef(uid) {
    return firebase.firestore().collection('users').doc(uid).collection('autocontroles');
  }

  async function getControles(uid) {
    const snapshot = await controlesRef(uid).get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    results.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db2 = b.date ? new Date(b.date) : new Date(0);
      return db2 - da;
    });
    return results;
  }

  async function addControle(uid, data) {
    return await controlesRef(uid).add(data);
  }

  async function getDernierControle(uid) {
    const controles = await getControles(uid);
    return controles.length > 0 ? controles[0] : null;
  }

  return { render, renderFormControle, renderDetail, getDernierControle };
})();
