/**
 * ElevApp — Module Chaleurs & Cycles de Reproduction
 * Suivi historique des chaleurs par femelle :
 * progestérone, saillie, résultat, mise bas, mammite
 */

const Chaleurs = (() => {
  'use strict';

  // Helper: download jsPDF doc as Blob to avoid iOS PWA navigation crash
  function _downloadPDF(doc, fileName) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  // État du formulaire progestérone (liste dynamique)
  let progesLineItems = [];

  // ---- Constantes ----
  const RESULTATS = {
    en_attente: { label: 'En attente', icon: '⏳', badge: 'badge-light' },
    chaleur_blanche: { label: 'Chaleur blanche', icon: '⬜', badge: 'badge-light' },
    saillie: { label: 'Sailllie / gestation en cours', icon: '🐾', badge: 'badge-blue' },
    mise_bas: { label: 'Mise bas', icon: '🍼', badge: 'badge-green' }
  };

  // ---- Helpers ----
  function toDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val.toDate) return val.toDate();
    // Support format JJ/MM/AAAA (saisie manuelle)
    const frMatch = typeof val === 'string' && val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frMatch) return new Date(parseInt(frMatch[3]), parseInt(frMatch[2]) - 1, parseInt(frMatch[1]));
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  // Convertit une valeur de champ date (JJ/MM/AAAA ou YYYY-MM-DD) en ISO YYYY-MM-DD pour stockage
  function inputToISO(str) {
    if (!str) return '';
    const d = toDate(str);
    return d ? d.toISOString().split('T')[0] : '';
  }

  function calcEcart(chaleurs, index) {
    // chaleurs triées du plus récent au plus ancien (index 0 = plus récente)
    // Pour l'index i, l'écart est par rapport à chaleurs[i+1]
    if (index >= chaleurs.length - 1) return null;
    const current = toDate(chaleurs[index].date);
    const previous = toDate(chaleurs[index + 1].date);
    if (!current || !previous) return null;
    const days = Math.round((current - previous) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  }

  function ecartLabel(days) {
    if (!days) return '—';
    const mois = (days / 30.5).toFixed(1);
    return `${days} j (${mois} mois)`;
  }

  function joursDepuisChaleur(chaleurDate, relevéDate) {
    const c = toDate(chaleurDate);
    const r = toDate(relevéDate);
    if (!c || !r) return null;
    return Math.round((r - c) / (1000 * 60 * 60 * 24));
  }

  // ---- Liste des chaleurs ----
  async function renderList(animalId) {
    UI.setContent(`
      ${UI.pageHeader('🌡️ Chaleurs', 'animal-detail', { id: animalId })}
      <div id="chaleurs-list-content">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid || !animalId) return;

    try {
      const [animal, chaleurs] = await Promise.all([
        DB.getAnimal(uid, animalId),
        DB.getChaleurs(uid, animalId)
      ]);

      const container = document.getElementById('chaleurs-list-content');
      if (!container) return;

      if (!animal) {
        container.innerHTML = '<p class="text-center text-muted">Animal introuvable</p>';
        return;
      }

      // Recalcul numérotation (du plus ancien au plus récent)
      const sorted = [...chaleurs].sort((a, b) => {
        const da = toDate(a.date) || new Date(0);
        const db2 = toDate(b.date) || new Date(0);
        return da - db2;
      });
      const numMap = {};
      sorted.forEach((c, i) => { numMap[c.id] = i + 1; });

      // Stats globales
      let ecartTotal = 0, ecartCount = 0;
      chaleurs.forEach((c, i) => {
        const e = calcEcart(chaleurs, i);
        if (e) { ecartTotal += e; ecartCount++; }
      });
      const ecartMoyen = ecartCount > 0 ? Math.round(ecartTotal / ecartCount) : null;
      const derniere = chaleurs.length > 0 ? toDate(chaleurs[0].date) : null;
      const joursDepuis = derniere ? Math.round((new Date() - derniere) / (1000 * 60 * 60 * 24)) : null;

      const ecartSparkline = renderEcartSparkline(chaleurs);
      const statsHtml = chaleurs.length > 0 ? `
        <div class="stat-grid mb-2" style="grid-template-columns:repeat(3,1fr);">
          <div class="stat-card">
            <div class="stat-number">${chaleurs.length}</div>
            <div class="stat-label">Chaleurs</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${ecartMoyen ? Math.round(ecartMoyen / 30.5) + ' m' : '—'}</div>
            <div class="stat-label">Écart moy.</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${joursDepuis !== null ? joursDepuis + ' j' : '—'}</div>
            <div class="stat-label">Depuis dernière</div>
          </div>
        </div>
        ${ecartSparkline}
      ` : '';

      // Prédiction prochaine chaleur
      let predictionHtml = '';
      if (ecartMoyen && derniere) {
        const nextDate = new Date(derniere.getTime() + ecartMoyen * 24 * 60 * 60 * 1000);
        const daysUntil = Math.round((nextDate - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntil > 0) {
          const nextDateISO = nextDate.toISOString().split('T')[0];
          predictionHtml = `
            <div class="card mb-2" style="border-left:3px solid var(--blue);background:var(--bg-secondary);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <div style="font-size:0.85rem;font-weight:700;">🔮 Prochaine chaleur prévue</div>
                  <div style="font-size:0.9rem;margin-top:4px;font-weight:600;">${Utils.formatDate(nextDate)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Dans ${daysUntil} jours (écart moy. ${ecartMoyen} j)</div>
                </div>
                <button class="btn btn-secondary btn-sm chaleur-rappel-btn" data-date="${nextDateISO}" style="flex-shrink:0;font-size:0.75rem;">⏰ Rappel</button>
              </div>
            </div>
          `;
        }
      }

      const cardsHtml = chaleurs.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🌡️</div>
          <div class="empty-title">Aucune chaleur enregistrée</div>
          <div class="empty-desc">Enregistrez les cycles pour suivre la progestérone, les saillies et prédire les prochaines chaleurs</div>
        </div>
      ` : chaleurs.map((c, i) => renderChaleurCard(c, numMap[c.id], calcEcart(chaleurs, i))).join('');

      container.innerHTML = `
        <div class="section-title" style="margin-top:0;">
          <span class="section-icon">🌡️</span> ${Utils.escapeHtml(animal.nom)} — Suivi des chaleurs
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <button class="btn btn-primary" style="flex:1;" onclick="UI.navigateTo('chaleur-form', {animalId:'${animalId}'})">+ Nouvelle chaleur</button>
          ${chaleurs.length > 0 ? `<button class="btn btn-secondary" id="export-chaleurs-pdf-btn" title="Exporter PDF">📄</button>` : ''}
        </div>
        ${statsHtml}
        ${predictionHtml}
        ${cardsHtml}
        <div class="mb-3"></div>
      `;

      // Attacher les handlers modifier/supprimer
      container.querySelectorAll('.chaleur-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.navigateTo('chaleur-form', { animalId, chaleurId: btn.dataset.id });
        });
      });
      container.querySelectorAll('.chaleur-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.confirmModal(`Supprimer la chaleur #${btn.dataset.num} ?`, async () => {
            try {
              await DB.deleteChaleur(uid, animalId, btn.dataset.id);
              UI.toast('Chaleur supprimée', 'success');
              renderList(animalId);
            } catch (err) {
              UI.toast('Erreur de suppression', 'error');
            }
          });
        });
      });

      // Bouton rappel prédiction
      container.querySelectorAll('.chaleur-rappel-btn').forEach(btn => {
        btn.addEventListener('click', () => creerRappelChaleur(uid, animalId, btn.dataset.date));
      });

      // Bouton export PDF
      document.getElementById('export-chaleurs-pdf-btn')?.addEventListener('click', () => {
        exportPDFChaleurs(uid, animalId, animal, chaleurs, numMap);
      });

    } catch (err) {
      console.error('Erreur chaleurs', err);
      const el = document.getElementById('chaleurs-list-content');
      if (el) el.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderChaleurCard(c, num, ecartJours) {
    const dateChaleur = toDate(c.date);
    const res = RESULTATS[c.resultat] || RESULTATS.en_attente;

    // Progestérone — liste + courbe SVG
    const progesLines = (c.suiviProgesterone || []);
    const chartSvg = renderProgesChart(progesLines, dateChaleur);
    const maxProges = progesLines.length > 0
      ? Math.max(...progesLines.map(p => parseFloat(p.valeur) || 0))
      : null;
    const progesHtml = progesLines.length > 0 ? `
      <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:4px;">
          🧪 Progestérone — ${progesLines.length} relevé${progesLines.length > 1 ? 's' : ''}
          ${maxProges ? `<span style="color:var(--orange);margin-left:6px;">max ${maxProges} ng/mL</span>` : ''}
        </div>
        ${chartSvg}
        <div style="margin-top:6px;">
          ${progesLines.map(p => {
            const jours = p.jour || (dateChaleur && p.date ? joursDepuisChaleur(dateChaleur, toDate(p.date)) : null);
            const valF = parseFloat(p.valeur);
            const interp = Utils.interpreterProgesterone(p.valeur, p.automate);
            const color = interp ? interp.color : (valF >= 20 ? 'var(--green)' : valF >= 5 ? 'var(--orange)' : 'var(--text-primary)');
            const automateLabel = p.automate && Utils.AUTOMATES_PROGESTERONE[p.automate]
              ? `<span style="color:var(--text-muted);font-size:0.72rem;">[${Utils.AUTOMATES_PROGESTERONE[p.automate].label.split('™')[0]}]</span>` : '';
            return `<div style="font-size:0.75rem;padding:3px 0;border-bottom:1px solid var(--border-light);">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                ${jours !== null ? `<span style="color:var(--text-muted);min-width:24px;">J${jours}</span>` : ''}
                <strong style="color:${color};min-width:52px;">${p.valeur} ng/mL</strong>
                ${interp ? `<span style="font-weight:700;color:${interp.color};">${interp.emoji} ${interp.label}</span>` : ''}
                ${p.date ? `<span style="color:var(--text-muted);">${Utils.formatDateShort(toDate(p.date))}</span>` : ''}
                ${automateLabel}
              </div>
              ${interp ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px;padding-left:30px;">${interp.conseil}</div>` : ''}
              ${p.notes ? `<div style="font-size:0.72rem;color:var(--text-muted);font-style:italic;padding-left:30px;">${Utils.escapeHtml(p.notes)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    // Saillie
    const saillie = c.saillie || {};
    const saillieHtml = (saillie.date || saillie.date2) ? `
      <div style="margin-top:6px;font-size:0.8rem;">
        🐾 Saillie ${saillie.type === 'insemination_artificielle' ? '<span class="badge badge-blue" style="font-size:0.7rem;">IA</span>' : ''}
        ${saillie.date ? Utils.formatDateShort(toDate(saillie.date)) : ''}
        ${saillie.date2 ? ` + ${Utils.formatDateShort(toDate(saillie.date2))}` : ''}
        ${saillie.pereNom ? ` — père: <strong>${Utils.escapeHtml(saillie.pereNom)}</strong>` : ''}
      </div>
    ` : '';

    // Mise bas + mammite enrichie
    let miseBas = '';
    if (c.resultat === 'mise_bas') {
      const dateMB = toDate(c.dateMiseBas);
      const mammiteDetail = c.mammite ? `
        <div style="margin-top:6px;padding:6px 8px;border-radius:var(--radius-sm);background:rgba(239,68,68,0.08);border-left:3px solid var(--red);">
          <div style="font-size:0.78rem;font-weight:700;color:var(--red);">🔴 Mammite post-partum</div>
          ${c.mammiteQuartiers ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Quartier(s) : ${Utils.escapeHtml(c.mammiteQuartiers)}</div>` : ''}
          ${c.mammiteTraitement ? `<div style="font-size:0.75rem;color:var(--text-muted);">Traitement : ${Utils.escapeHtml(c.mammiteTraitement)}</div>` : ''}
          ${(c.mammiteDateDebut || c.mammiteDateFin) ? `<div style="font-size:0.75rem;color:var(--text-muted);">
            ${c.mammiteDateDebut ? 'Du ' + Utils.formatDateShort(toDate(c.mammiteDateDebut)) : ''}
            ${c.mammiteDateFin ? ' au ' + Utils.formatDateShort(toDate(c.mammiteDateFin)) : ''}
          </div>` : ''}
          ${c.mammiteEvolution ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">${Utils.escapeHtml(c.mammiteEvolution)}</div>` : ''}
          ${c.notesMammite ? `<div style="font-size:0.75rem;color:var(--text-muted);">${Utils.escapeHtml(c.notesMammite)}</div>` : ''}
        </div>
      ` : '';

      miseBas = `
        <div style="margin-top:6px;font-size:0.8rem;border-top:1px solid var(--border);padding-top:6px;">
          🍼 Mise bas ${dateMB ? Utils.formatDateShort(dateMB) : ''}
          ${c.nbNes !== undefined ? ` — ${c.nbNes} nés` : ''}
          ${c.nbVivants !== undefined ? `, ${c.nbVivants} vivants` : ''}
          ${c.nbMortNes > 0 ? ` <span style="color:var(--red);">${c.nbMortNes} mort-nés${c.causesMortNes ? ' (' + Utils.escapeHtml(c.causesMortNes) + ')' : ''}</span>` : ''}
          ${c.parCesarienne ? ' <span class="badge badge-orange" style="font-size:0.7rem;">Césarienne</span>' : ''}
          ${mammiteDetail}
        </div>
      `;
    }

    return `
      <div class="card mb-2">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span style="font-weight:700;font-size:0.9rem;">Chaleur #${num}</span>
            <span style="margin-left:8px;font-size:0.85rem;color:var(--text-muted);">${dateChaleur ? Utils.formatDate(dateChaleur) : '—'}</span>
          </div>
          <span class="badge ${res.badge}">${res.icon} ${res.label}</span>
        </div>

        ${ecartJours ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">⏱ Écart depuis précédente : ${ecartLabel(ecartJours)}</div>` : ''}
        ${c.notesHabitudesOvulation ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">📝 ${Utils.escapeHtml(c.notesHabitudesOvulation)}</div>` : ''}

        ${progesHtml}
        ${saillieHtml}
        ${miseBas}

        ${c.commentaires ? `<div style="margin-top:6px;font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:6px;">${Utils.escapeHtml(c.commentaires)}</div>` : ''}

        ${c.porteeId ? `
        <div style="margin-top:6px;font-size:0.78rem;border-top:1px solid var(--border);padding-top:6px;">
          🍼 <a href="#" onclick="UI.navigateTo('portee-detail',{id:'${c.porteeId}'}); return false;" style="color:var(--blue);">Voir la portée associée →</a>
        </div>` : ''}

        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-secondary btn-sm chaleur-edit-btn" style="flex:1;" data-id="${c.id}">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm chaleur-delete-btn" data-id="${c.id}" data-num="${num}">🗑️</button>
        </div>
      </div>
    `;
  }

  // ---- Formulaire chaleur ----
  async function renderForm(animalId, chaleurId) {
    UI.setContent(`
      ${UI.pageHeader(chaleurId ? 'Modifier chaleur' : 'Nouvelle chaleur', 'chaleurs-list', { animalId })}
      <div id="chaleur-form-content">
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid || !animalId) return;

    try {
      const [animal, males, existingChaleur, porteeSnap] = await Promise.all([
        DB.getAnimal(uid, animalId),
        DB.getAnimalsBySex(uid, 'male'),
        chaleurId ? DB.getChaleur(uid, animalId, chaleurId) : Promise.resolve(null),
        firebase.firestore().collection('users').doc(uid).collection('portees').get()
      ]);
      const portees = porteeSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.mereId === animalId)
        .sort((a, b) => {
          const da = a.dateNaissance?.toDate ? a.dateNaissance.toDate() : new Date(a.dateNaissance || a.createdAt || 0);
          const db2 = b.dateNaissance?.toDate ? b.dateNaissance.toDate() : new Date(b.dateNaissance || b.createdAt || 0);
          return db2 - da;
        });

      const container = document.getElementById('chaleur-form-content');
      if (!container) return;

      // Initialiser la liste progestérone
      progesLineItems = existingChaleur?.suiviProgesterone
        ? JSON.parse(JSON.stringify(existingChaleur.suiviProgesterone))
        : [];

      const c = existingChaleur || {};
      const saillie = c.saillie || {};

      // Options mâles
      const malesOptions = males.map(m =>
        `<option value="${m.id}" ${saillie.pereId === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.nom)} (${m.espece === 'canin' ? '🐕' : '🐈'})</option>`
      ).join('');

      container.innerHTML = `
        <form id="chaleur-form">

          <!-- Chaleur -->
          <div class="section-title" style="margin-top:0;"><span class="section-icon">🌡️</span> Chaleur</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label">Date de début de chaleur *</label>
              <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-date" value="${toInputDate(c.date)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Notes habitudes d'ovulation</label>
              <textarea class="form-control" id="cf-notes-ovulation" rows="2" placeholder="Ovulation tardive, précoce, habitudes..."></textarea>
            </div>
          </div>

          <!-- Suivi progestérone -->
          <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;">
            <span><span class="section-icon">🧪</span> Suivi progestérone</span>
            <button type="button" onclick="UI.showHelp('Suivi progestérone', 'La progestérone permet de détecter précisément l\'ovulation :<br><br>• <strong>&lt; 2 ng/mL</strong> : chaleurs en cours, pas encore ovulée<br>• <strong>5 ng/mL</strong> : pic LH — début ovulation (ligne bleue)<br>• <strong>&gt; 20 ng/mL</strong> : phase lutéale confirmée (ligne verte)<br><br>La saillie optimale se situe 2 à 3 jours après le pic LH.')" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-muted);padding:0;">ℹ️</button>
          </div>
          <div class="card mb-2">
            <div id="proges-list"></div>
            <button type="button" class="btn btn-secondary btn-sm" id="add-proges-btn" style="width:100%;margin-top:8px;">+ Ajouter un relevé</button>
          </div>

          <!-- Saillie -->
          <div class="section-title"><span class="section-icon">🐾</span> Saillie</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label">Type de saillie</label>
              <select class="form-control" id="cf-saillie-type">
                <option value="">— Pas de saillie —</option>
                <option value="naturelle" ${saillie.type === 'naturelle' ? 'selected' : ''}>Naturelle</option>
                <option value="insemination_artificielle" ${saillie.type === 'insemination_artificielle' ? 'selected' : ''}>Insémination artificielle (IA)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date saillie (1ère)</label>
              <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-saillie-date" value="${toInputDate(saillie.date)}">
            </div>
            <div class="form-group">
              <label class="form-label">Date saillie (2ème — optionnel)</label>
              <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-saillie-date2" value="${toInputDate(saillie.date2)}">
            </div>
            <div class="form-group">
              <label class="form-label">Père — nom</label>
              <input type="text" class="form-control" id="cf-pere-nom" placeholder="Nom du père" value="${Utils.escapeHtml(saillie.pereNom || '')}">
            </div>
            ${males.length > 0 ? `
            <div class="form-group">
              <label class="form-label">Père — dans votre élevage</label>
              <select class="form-control" id="cf-pere-id">
                <option value="">— Sélectionner un mâle —</option>
                ${malesOptions}
              </select>
            </div>
            ` : ''}
          </div>

          <!-- Résultat -->
          <div class="section-title"><span class="section-icon">📋</span> Résultat</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label">Résultat</label>
              <select class="form-control" id="cf-resultat">
                ${Object.entries(RESULTATS).map(([k, v]) =>
                  `<option value="${k}" ${c.resultat === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
                ).join('')}
              </select>
            </div>

            <!-- Mise bas (affiché si résultat = mise_bas) -->
            <div id="mise-bas-section" style="display:${c.resultat === 'mise_bas' ? 'block' : 'none'};">
              <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px;">
                <div class="form-group">
                  <label class="form-label">Date de mise bas</label>
                  <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-mb-date" value="${toInputDate(c.dateMiseBas)}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                  <div class="form-group">
                    <label class="form-label">Nés totaux</label>
                    <input type="number" class="form-control" id="cf-mb-nes" min="0" value="${c.nbNes !== undefined ? c.nbNes : ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Vivants</label>
                    <input type="number" class="form-control" id="cf-mb-vivants" min="0" value="${c.nbVivants !== undefined ? c.nbVivants : ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Mort-nés</label>
                    <input type="number" class="form-control" id="cf-mb-mortnes" min="0" value="${c.nbMortNes !== undefined ? c.nbMortNes : ''}">
                  </div>
                </div>
                <div class="form-group" id="mortnes-cause-group" style="display:${c.nbMortNes > 0 ? 'block' : 'none'};">
                  <label class="form-label">Cause(s) des mort-nés</label>
                  <textarea class="form-control" id="cf-mortnes-cause" rows="2" placeholder="Anoxie, malformation, prématuré...">${Utils.escapeHtml(c.causesMortNes || '')}</textarea>
                </div>
                <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:8px;">
                  <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem;cursor:pointer;">
                    <input type="checkbox" id="cf-cesarienne" ${c.parCesarienne ? 'checked' : ''}> Mise bas par césarienne
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem;cursor:pointer;">
                    <input type="checkbox" id="cf-mammite" ${c.mammite ? 'checked' : ''}> Mammite post-partum
                  </label>
                </div>
                <!-- Section mammite enrichie -->
                <div id="mammite-notes-group" style="display:${c.mammite ? 'block' : 'none'};margin-top:10px;padding:10px;border-radius:var(--radius-md);background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-size:0.8rem;font-weight:700;color:var(--red);">🔴 Détail mammite</div>
                    <button type="button" onclick="UI.showHelp('Mammite post-partum', 'La mamelle comporte plusieurs quartiers :<br><br>• <strong>AG</strong> = Antérieur Gauche<br>• <strong>AD</strong> = Antérieur Droit<br>• <strong>PG</strong> = Postérieur Gauche<br>• <strong>PD</strong> = Postérieur Droit<br><br>Cochez les quartiers atteints, notez le traitement prescrit par votre vétérinaire et suivez l\'évolution (résolutive, chronique, récidivante).')" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-muted);padding:0;">ℹ️</button>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Quartier(s) atteint(s)</label>
                    <input type="text" class="form-control" id="cf-mammite-quartiers" placeholder="ex: AG, PD (antérieur gauche, postérieur droit)" value="${Utils.escapeHtml(c.mammiteQuartiers || '')}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Traitement</label>
                    <input type="text" class="form-control" id="cf-mammite-traitement" placeholder="ex: Amoxicilline + Métacam" value="${Utils.escapeHtml(c.mammiteTraitement || '')}">
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div class="form-group">
                      <label class="form-label">Date début</label>
                      <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-mammite-debut" value="${toInputDate(c.mammiteDateDebut)}">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Date fin / guérison</label>
                      <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control" id="cf-mammite-fin" value="${toInputDate(c.mammiteDateFin)}">
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Évolution</label>
                    <input type="text" class="form-control" id="cf-mammite-evolution" placeholder="ex: Guérie en 5 j, Récidive..." value="${Utils.escapeHtml(c.mammiteEvolution || '')}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Notes complémentaires</label>
                    <textarea class="form-control" id="cf-mammite-notes" rows="2" placeholder="Observations vétérinaire...">${Utils.escapeHtml(c.notesMammite || '')}</textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lien portée -->
          ${portees.length > 0 ? `
          <div class="section-title"><span class="section-icon">🍼</span> Portée associée</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label">Lier cette chaleur à une portée</label>
              <select class="form-control" id="cf-portee-id">
                <option value="">— Aucune —</option>
                ${portees.map(p => {
                  const dateStr = p.dateNaissance?.toDate
                    ? Utils.formatDateShort(p.dateNaissance.toDate())
                    : (p.datePrevue?.toDate ? 'Prévue ' + Utils.formatDateShort(p.datePrevue.toDate()) : '');
                  return `<option value="${p.id}" ${(existingChaleur?.porteeId === p.id) ? 'selected' : ''}>
                    Portée ${dateStr} — ${p.nbTotal || '?'} ${p.espece === 'felin' ? (p.nbTotal > 1 ? 'chatons' : 'chaton') : (p.nbTotal > 1 ? 'chiots' : 'chiot')}
                  </option>`;
                }).join('')}
              </select>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Optionnel — permet de naviguer directement vers la portée depuis cet historique</div>
            </div>
          </div>
          ` : ''}

          <!-- Commentaires -->
          <div class="section-title"><span class="section-icon">💬</span> Commentaires</div>
          <div class="card mb-2">
            <div class="form-group">
              <textarea class="form-control" id="cf-commentaires" rows="3" placeholder="Notes libres sur ce cycle...">${Utils.escapeHtml(c.commentaires || '')}</textarea>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-bottom:32px;">
            <button type="submit" class="btn btn-primary" style="flex:1;">
              ${chaleurId ? '💾 Enregistrer les modifications' : '✅ Créer la chaleur'}
            </button>
          </div>
        </form>
      `;

      // Restaurer valeur du textarea notes ovulation
      if (c.notesHabitudesOvulation) {
        document.getElementById('cf-notes-ovulation').value = c.notesHabitudesOvulation;
      }

      // Render liste progestérone
      renderProgesList();

      // Bouton + progestérone
      document.getElementById('add-proges-btn').addEventListener('click', () => {
        progesLineItems.push({ date: '', valeur: '', jour: '', notes: '' });
        renderProgesList();
      });

      // Toggle section mise bas
      document.getElementById('cf-resultat').addEventListener('change', (e) => {
        document.getElementById('mise-bas-section').style.display =
          e.target.value === 'mise_bas' ? 'block' : 'none';
      });

      // Toggle cause mort-nés
      document.getElementById('cf-mb-mortnes')?.addEventListener('input', (e) => {
        document.getElementById('mortnes-cause-group').style.display =
          parseInt(e.target.value) > 0 ? 'block' : 'none';
      });

      // Toggle notes mammite
      document.getElementById('cf-mammite')?.addEventListener('change', (e) => {
        document.getElementById('mammite-notes-group').style.display =
          e.target.checked ? 'block' : 'none';
      });

      // Sélect père dans élevage → auto-fill nom
      const pereIdEl = document.getElementById('cf-pere-id');
      if (pereIdEl) {
        pereIdEl.addEventListener('change', () => {
          const selectedId = pereIdEl.value;
          const male = males.find(m => m.id === selectedId);
          if (male) {
            document.getElementById('cf-pere-nom').value = male.nom;
          }
        });
      }

      // Submit
      document.getElementById('chaleur-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveForm(uid, animalId, chaleurId);
      });

    } catch (err) {
      console.error('Erreur form chaleur', err);
      const el = document.getElementById('chaleur-form-content');
      if (el) el.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderProgesList() {
    const container = document.getElementById('proges-list');
    if (!container) return;

    if (progesLineItems.length === 0) {
      container.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:8px 0;">Aucun relevé — cliquez sur + pour ajouter</p>';
      return;
    }

    const automateOptions = Object.entries(Utils.AUTOMATES_PROGESTERONE)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

    container.innerHTML = progesLineItems.map((p, i) => {
      const interp = Utils.interpreterProgesterone(p.valeur, p.automate);
      const interpHtml = interp ? `
        <div class="proges-interp" data-index="${i}" style="margin-top:8px;padding:8px 10px;border-radius:8px;background:${interp.color}18;border-left:3px solid ${interp.color};">
          <div style="font-weight:700;font-size:0.82rem;color:${interp.color};">${interp.emoji} ${interp.label}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${interp.conseil}</div>
        </div>` : `<div class="proges-interp" data-index="${i}" style="margin-top:8px;padding:6px 10px;border-radius:8px;background:var(--bg-light);font-size:0.78rem;color:var(--text-muted);">Sélectionnez un automate et saisissez une valeur pour obtenir l'interprétation</div>`;

      return `
      <div class="proges-row" data-index="${i}" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:700;font-size:0.82rem;">Relevé ${i + 1}</span>
          <button type="button" class="btn btn-danger btn-sm proges-delete-btn" data-index="${i}" style="padding:2px 8px;font-size:0.8rem;">✕</button>
        </div>

        <!-- Automate -->
        <div class="form-group" style="margin:0 0 8px 0;">
          <label class="form-label" style="font-size:0.78rem;">Automate / Machine</label>
          <select class="form-control proges-automate" data-index="${i}" style="font-size:0.82rem;">
            <option value="">-- Choisir la machine --</option>
            ${automateOptions.replace(`value="${p.automate || ''}"`, `value="${p.automate || ''}" selected`)}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Date</label>
            <input type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" class="form-control proges-date" data-index="${i}" value="${p.date || ''}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Valeur (ng/mL)</label>
            <input type="number" step="0.1" min="0" class="form-control proges-valeur" data-index="${i}" placeholder="ex: 12.5" value="${p.valeur || ''}">
          </div>
        </div>

        <!-- Interprétation automatique -->
        ${interpHtml}

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:8px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Jour du cycle</label>
            <input type="number" min="1" class="form-control proges-jour" data-index="${i}" placeholder="J14" value="${p.jour || ''}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Notes</label>
            <input type="text" class="form-control proges-notes" data-index="${i}" placeholder="Vétérinaire, résultats..." value="${Utils.escapeHtml(p.notes || '')}">
          </div>
        </div>
      </div>`;
    }).join('');

    // Handlers suppression
    container.querySelectorAll('.proges-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        progesLineItems.splice(parseInt(btn.dataset.index), 1);
        renderProgesList();
      });
    });

    // Mise à jour de l'interprétation en temps réel
    function updateInterp(index) {
      const p = progesLineItems[index];
      const interp = Utils.interpreterProgesterone(p.valeur, p.automate);
      const interpEl = container.querySelector(`.proges-interp[data-index="${index}"]`);
      if (!interpEl) return;
      if (interp) {
        interpEl.style.background = `${interp.color}18`;
        interpEl.style.borderLeft = `3px solid ${interp.color}`;
        interpEl.innerHTML = `
          <div style="font-weight:700;font-size:0.82rem;color:${interp.color};">${interp.emoji} ${interp.label}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${interp.conseil}</div>`;
      } else {
        interpEl.style.background = 'var(--bg-light)';
        interpEl.style.borderLeft = 'none';
        interpEl.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted);">Sélectionnez un automate et saisissez une valeur pour obtenir l\'interprétation</span>';
      }
    }

    // Handlers input — mise à jour en temps réel
    container.querySelectorAll('.proges-automate').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = parseInt(sel.dataset.index);
        progesLineItems[i].automate = sel.value;
        updateInterp(i);
      });
    });
    container.querySelectorAll('.proges-date').forEach(inp => {
      inp.addEventListener('change', () => { progesLineItems[parseInt(inp.dataset.index)].date = inp.value; });
    });
    container.querySelectorAll('.proges-valeur').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.index);
        progesLineItems[i].valeur = inp.value;
        updateInterp(i);
      });
    });
    container.querySelectorAll('.proges-jour').forEach(inp => {
      inp.addEventListener('input', () => { progesLineItems[parseInt(inp.dataset.index)].jour = inp.value; });
    });
    container.querySelectorAll('.proges-notes').forEach(inp => {
      inp.addEventListener('input', () => { progesLineItems[parseInt(inp.dataset.index)].notes = inp.value; });
    });
  }

  async function saveForm(uid, animalId, chaleurId) {
    const btn = document.querySelector('#chaleur-form [type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const dateVal = inputToISO(document.getElementById('cf-date').value);
      if (!dateVal) { UI.toast('Date de chaleur requise', 'error'); return; }

      // Lire progestérone depuis le DOM (valeurs les plus récentes)
      const progesItems = [];
      document.querySelectorAll('.proges-row').forEach((row, i) => {
        const dateInput = row.querySelector('.proges-date');
        const valeurInput = row.querySelector('.proges-valeur');
        const jourInput = row.querySelector('.proges-jour');
        const notesInput = row.querySelector('.proges-notes');
        const automateInput = row.querySelector('.proges-automate');
        progesItems.push({
          date: inputToISO(dateInput?.value || ''),
          valeur: valeurInput?.value || '',
          jour: jourInput?.value ? parseInt(jourInput.value) : '',
          notes: notesInput?.value || '',
          automate: automateInput?.value || ''
        });
      });

      const resultat = document.getElementById('cf-resultat').value;
      const parCesarienne = document.getElementById('cf-cesarienne')?.checked || false;
      const mammite = document.getElementById('cf-mammite')?.checked || false;

      const pereIdEl = document.getElementById('cf-pere-id');
      const pereNomVal = document.getElementById('cf-pere-nom').value.trim();
      const pereIdVal = pereIdEl ? pereIdEl.value : '';

      const data = {
        date: dateVal,
        notesHabitudesOvulation: document.getElementById('cf-notes-ovulation').value.trim(),
        suiviProgesterone: progesItems,
        saillie: {
          type: document.getElementById('cf-saillie-type').value,
          date: inputToISO(document.getElementById('cf-saillie-date').value),
          date2: inputToISO(document.getElementById('cf-saillie-date2').value),
          pereNom: pereNomVal,
          pereId: pereIdVal
        },
        resultat,
        commentaires: document.getElementById('cf-commentaires').value.trim(),
        porteeId: document.getElementById('cf-portee-id')?.value || ''
      };

      // Mise bas
      if (resultat === 'mise_bas') {
        data.dateMiseBas = inputToISO(document.getElementById('cf-mb-date').value);
        data.nbNes = parseInt(document.getElementById('cf-mb-nes').value) || 0;
        data.nbVivants = parseInt(document.getElementById('cf-mb-vivants').value) || 0;
        data.nbMortNes = parseInt(document.getElementById('cf-mb-mortnes').value) || 0;
        data.causesMortNes = document.getElementById('cf-mortnes-cause')?.value.trim() || '';
        data.parCesarienne = parCesarienne;
        data.mammite = mammite;
        if (mammite) {
          data.mammiteQuartiers = document.getElementById('cf-mammite-quartiers')?.value.trim() || '';
          data.mammiteTraitement = document.getElementById('cf-mammite-traitement')?.value.trim() || '';
          data.mammiteDateDebut = inputToISO(document.getElementById('cf-mammite-debut')?.value || '');
          data.mammiteDateFin = inputToISO(document.getElementById('cf-mammite-fin')?.value || '');
          data.mammiteEvolution = document.getElementById('cf-mammite-evolution')?.value.trim() || '';
          data.notesMammite = document.getElementById('cf-mammite-notes')?.value.trim() || '';
        } else {
          data.mammiteQuartiers = ''; data.mammiteTraitement = ''; data.mammiteDateDebut = '';
          data.mammiteDateFin = ''; data.mammiteEvolution = ''; data.notesMammite = '';
        }
      }

      if (chaleurId) {
        await DB.updateChaleur(uid, animalId, chaleurId, data);
        UI.toast('Chaleur mise à jour', 'success');
      } else {
        await DB.addChaleur(uid, animalId, data);
        UI.toast('Chaleur enregistrée', 'success');
      }

      UI.navigateTo('chaleurs-list', { animalId });

    } catch (err) {
      console.error('Erreur sauvegarde chaleur', err);
      UI.toast('Erreur lors de l\'enregistrement', 'error');
      if (btn) btn.disabled = false;
    }
  }

  // ---- Créer un rappel sanitaire pour la prochaine chaleur prévue ----
  async function creerRappelChaleur(uid, animalId, dateISO) {
    try {
      const animal = await DB.getAnimal(uid, animalId);
      const nom = animal ? animal.nom : 'Femelle';
      await DB.addHealthEntry(uid, animalId, {
        type: 'visite_veto',
        titre: `🌡️ Chaleur prévue — ${nom}`,
        details: 'Prédiction automatique basée sur l\'écart moyen entre les cycles',
        date: new Date().toISOString().split('T')[0],
        rappelDate: dateISO,
        vetoNom: '',
        metadata: {}
      });
      UI.toast(`⏰ Rappel créé pour le ${Utils.formatDateShort(new Date(dateISO + 'T12:00:00'))}`, 'success');
    } catch (err) {
      console.error('Erreur création rappel', err);
      UI.toast('Erreur lors de la création du rappel', 'error');
    }
  }

  // ---- Export PDF suivi reproducteur ----
  async function exportPDFChaleurs(uid, animalId, animal, chaleurs, numMap) {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      UI.toast('jsPDF non disponible', 'error'); return;
    }
    UI.toast('Génération du PDF...', 'info');

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = 210, pageH = 297;
      const margin = 14;
      let y = 20;

      // En-tête
      doc.setFillColor(232, 152, 62);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('ElevApp — Suivi Reproducteur', margin, 9);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('fr-FR'), pageW - margin, 9, { align: 'right' });

      y = 22;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${animal?.nom || 'Animal'} — Historique des chaleurs`, margin, y);
      y += 6;
      if (animal?.race) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`${animal.espece === 'canin' ? 'Chien' : 'Chat'} — ${animal.race}`, margin, y);
        y += 5;
      }

      // Tri chronologique
      const sorted = [...chaleurs].sort((a, b) => {
        const da = toDate(a.date) || new Date(0);
        const db2 = toDate(b.date) || new Date(0);
        return da - db2;
      });

      y += 3;
      for (const c of sorted) {
        const num = numMap[c.id];
        const dateChaleur = toDate(c.date);
        const res = RESULTATS[c.resultat] || RESULTATS.en_attente;

        // Vérifier espace restant
        if (y > pageH - 40) {
          doc.addPage();
          y = 20;
        }

        // Titre chaleur
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, pageW - margin * 2, 7, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Chaleur #${num} — ${dateChaleur ? dateChaleur.toLocaleDateString('fr-FR') : '—'}`, margin + 2, y + 5);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(res.label, pageW - margin - 2, y + 5, { align: 'right' });
        y += 9;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);

        // Notes ovulation
        if (c.notesHabitudesOvulation) {
          doc.text(`Habitudes : ${c.notesHabitudesOvulation}`, margin + 2, y); y += 4;
        }

        // Progestérone
        const proges = c.suiviProgesterone || [];
        if (proges.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text('Progestérone :', margin + 2, y); y += 4;
          doc.setFont('helvetica', 'normal');
          proges.forEach(p => {
            const jStr = p.jour ? `J${p.jour}` : '';
            const dateStr = p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '';
            doc.text(`  ${jStr} ${dateStr} — ${p.valeur} ng/mL${p.notes ? ' (' + p.notes + ')' : ''}`, margin + 4, y);
            y += 3.5;
          });
        }

        // Saillie
        const s = c.saillie || {};
        if (s.date) {
          doc.setFont('helvetica', 'bold');
          doc.text('Saillie :', margin + 2, y);
          doc.setFont('helvetica', 'normal');
          const sStr = `${s.type === 'insemination_artificielle' ? 'IA' : 'Naturelle'} — ${new Date(s.date).toLocaleDateString('fr-FR')}${s.date2 ? ' + ' + new Date(s.date2).toLocaleDateString('fr-FR') : ''}${s.pereNom ? ' — Père : ' + s.pereNom : ''}`;
          doc.text(sStr, margin + 22, y);
          y += 4;
        }

        // Mise bas
        if (c.resultat === 'mise_bas') {
          doc.setFont('helvetica', 'bold');
          doc.text('Mise bas :', margin + 2, y);
          doc.setFont('helvetica', 'normal');
          const mbStr = `${c.dateMiseBas ? new Date(c.dateMiseBas).toLocaleDateString('fr-FR') : ''} — ${c.nbNes || 0} nés, ${c.nbVivants || 0} vivants${c.nbMortNes > 0 ? ', ' + c.nbMortNes + ' mort-nés' : ''}${c.parCesarienne ? ' [Césarienne]' : ''}`;
          doc.text(mbStr, margin + 24, y);
          y += 4;
          if (c.mammite) {
            doc.setTextColor(200, 0, 0);
            const mamStr = `Mammite${c.mammiteQuartiers ? ' (' + c.mammiteQuartiers + ')' : ''}${c.mammiteTraitement ? ' — ' + c.mammiteTraitement : ''}`;
            doc.text(`  ${mamStr}`, margin + 4, y);
            doc.setTextColor(0, 0, 0);
            y += 4;
          }
        }

        if (c.commentaires) {
          doc.setTextColor(80, 80, 80);
          doc.text(`Notes : ${c.commentaires}`, margin + 2, y); y += 4;
          doc.setTextColor(0, 0, 0);
        }

        y += 3;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
      }

      // Pied de page
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('Généré par ElevApp — Conforme Arrêté 19 juin 2025', margin, pageH - 8);

      const dateStr = new Date().toISOString().split('T')[0];
      _downloadPDF(doc, `elevapp-suivi-repro-${(animal?.nom || 'animal').toLowerCase()}-${dateStr}.pdf`);
      UI.toast('PDF généré !', 'success');

    } catch (err) {
      console.error('Erreur PDF chaleurs', err);
      UI.toast('Erreur lors de la génération du PDF', 'error');
    }
  }

  // ---- Courbe SVG progestérone ----
  function renderProgesChart(readings, chaleurDate) {
    const sorted = (readings || [])
      .map(p => {
        const jour = p.jour ? parseInt(p.jour) : (chaleurDate && p.date ? joursDepuisChaleur(chaleurDate, toDate(p.date)) : null);
        return { jour, valeur: parseFloat(p.valeur) };
      })
      .filter(p => p.jour !== null && !isNaN(p.jour) && !isNaN(p.valeur))
      .sort((a, b) => a.jour - b.jour);

    if (sorted.length < 2) return '';

    const W = 300, H = 110;
    const PAD = { top: 18, right: 16, bottom: 22, left: 32 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const minJ = sorted[0].jour;
    const maxJ = sorted[sorted.length - 1].jour;
    const maxV = Math.max(...sorted.map(p => p.valeur), 30);

    const xS = j => PAD.left + ((j - minJ) / (maxJ - minJ || 1)) * cW;
    const yS = v => PAD.top + cH - Math.min(v / maxV, 1) * cH;

    const polyline = sorted.map(p => `${xS(p.jour).toFixed(1)},${yS(p.valeur).toFixed(1)}`).join(' ');

    // Zone colorée sous la courbe
    const areaPoints = `${xS(minJ).toFixed(1)},${(PAD.top + cH).toFixed(1)} ${polyline} ${xS(maxJ).toFixed(1)},${(PAD.top + cH).toFixed(1)}`;

    const ref5y = yS(5);
    const ref20y = yS(20);

    return `<div style="overflow:hidden;margin:6px 0 2px;">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;">
        <!-- Fond -->
        <rect x="${PAD.left}" y="${PAD.top}" width="${cW}" height="${cH}" fill="var(--bg-secondary)" rx="3"/>
        <!-- Axe Y label -->
        <text x="4" y="${PAD.top + 4}" font-size="7" fill="var(--text-muted)">ng/mL</text>
        <!-- Lignes ref 5 et 20 -->
        ${ref5y > PAD.top && ref5y < PAD.top + cH ? `
          <line x1="${PAD.left}" y1="${ref5y.toFixed(1)}" x2="${PAD.left + cW}" y2="${ref5y.toFixed(1)}" stroke="#3B82F6" stroke-dasharray="3,2" stroke-width="0.8" opacity="0.7"/>
          <text x="${PAD.left + 2}" y="${(ref5y - 2).toFixed(1)}" font-size="7" fill="#3B82F6">5</text>
        ` : ''}
        ${ref20y > PAD.top && ref20y < PAD.top + cH ? `
          <line x1="${PAD.left}" y1="${ref20y.toFixed(1)}" x2="${PAD.left + cW}" y2="${ref20y.toFixed(1)}" stroke="#10B981" stroke-dasharray="3,2" stroke-width="0.8" opacity="0.7"/>
          <text x="${PAD.left + 2}" y="${(ref20y - 2).toFixed(1)}" font-size="7" fill="#10B981">20</text>
        ` : ''}
        <!-- Aire sous la courbe -->
        <polygon points="${areaPoints}" fill="var(--orange)" opacity="0.12"/>
        <!-- Courbe -->
        <polyline points="${polyline}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <!-- Points + valeurs -->
        ${sorted.map(p => `
          <circle cx="${xS(p.jour).toFixed(1)}" cy="${yS(p.valeur).toFixed(1)}" r="3.5" fill="var(--orange)" stroke="white" stroke-width="1.5"/>
          <text x="${xS(p.jour).toFixed(1)}" y="${(yS(p.valeur) - 6).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="var(--text-primary)">${p.valeur}</text>
          <text x="${xS(p.jour).toFixed(1)}" y="${(PAD.top + cH + 13).toFixed(1)}" text-anchor="middle" font-size="7" fill="var(--text-muted)">J${p.jour}</text>
        `).join('')}
      </svg>
      <div style="display:flex;gap:12px;font-size:0.7rem;color:var(--text-muted);margin-top:2px;padding-left:${PAD.left}px;">
        <span style="color:#3B82F6;">— Seuil ovulation (5)</span>
        <span style="color:#10B981;">— Phase lutéale (20)</span>
      </div>
    </div>`;
  }

  // ---- Sparkline écarts inter-chaleurs ----
  function renderEcartSparkline(chaleurs) {
    // Construire les paires (chronologique)
    const sorted = [...chaleurs].sort((a, b) => {
      const da = toDate(a.date) || new Date(0);
      const db2 = toDate(b.date) || new Date(0);
      return da - db2;
    });

    const ecarts = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = toDate(sorted[i - 1].date);
      const curr = toDate(sorted[i].date);
      if (prev && curr) {
        const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (days > 0) ecarts.push({ num: i + 1, days });
      }
    }

    if (ecarts.length < 2) return '';

    const W = 300, H = 65;
    const PAD = { top: 10, right: 10, bottom: 22, left: 10 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const n = ecarts.length;
    const barW = Math.min(28, (cW / n) - 4);
    const maxDays = Math.max(...ecarts.map(e => e.days));
    const avg = Math.round(ecarts.reduce((s, e) => s + e.days, 0) / n);

    const bars = ecarts.map((e, i) => {
      const x = PAD.left + (i / (n - 1 || 1)) * cW - barW / 2;
      const bH = Math.max(4, (e.days / maxDays) * cH);
      const y = PAD.top + cH - bH;
      const isLast = i === ecarts.length - 1;
      const color = isLast ? 'var(--orange)' : 'var(--border)';
      const textColor = isLast ? 'var(--orange)' : 'var(--text-muted)';
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${bH.toFixed(1)}" rx="2" fill="${color}"/>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="${textColor}" font-weight="${isLast ? 'bold' : 'normal'}">${e.days}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(PAD.top + cH + 13).toFixed(1)}" text-anchor="middle" font-size="7" fill="var(--text-muted)">#${e.num}</text>
      `;
    });

    // Ligne moyenne
    const avgY = PAD.top + cH - (avg / maxDays) * cH;

    return `<div class="card mb-2" style="padding:10px;">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">📊 Écarts inter-chaleurs (jours)</div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;">
        ${bars.join('')}
        <line x1="${PAD.left}" y1="${avgY.toFixed(1)}" x2="${PAD.left + cW}" y2="${avgY.toFixed(1)}" stroke="var(--blue)" stroke-dasharray="3,2" stroke-width="0.8" opacity="0.6"/>
        <text x="${PAD.left + cW}" y="${(avgY - 3).toFixed(1)}" text-anchor="end" font-size="7" fill="var(--blue)">moy. ${avg}j</text>
      </svg>
    </div>`;
  }

  // ---- Helper : date → string YYYY-MM-DD pour input[type=date] ----
  function toInputDate(val) {
    if (!val) return '';
    const d = toDate(val);
    if (!d || isNaN(d.getTime())) return '';
    // Format JJ/MM/AAAA pour saisie manuelle
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }

  return { renderList, renderForm };
})();
