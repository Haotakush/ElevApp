/**
 * ElevApp — Module Conformité Reproduction
 * Vue d'ensemble conformité Art. 26 de l'arrêté du 19 juin 2025
 * Suivi césariennes, portées, examens pré-repro, consanguinité
 */

const Conformite = (() => {
  'use strict';

  async function render() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">🔬</span> Conformité Reproduction</div>
      <div id="conformite-content">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const [animals, allEntries] = await Promise.all([
        DB.getAnimals(uid),
        DB.getAllHealthEntries(uid)
      ]);

      const activeAnimals = animals.filter(a => a.statut === 'actif');
      // On exclut uniquement les stérilisées — "Reproducteur confirmé", "En évaluation", etc. sont valides
      const STATUTS_STERILISES = ['steriliseChirurgical', 'steriliseChimique'];
      const femellesRepro = activeAnimals.filter(a =>
        a.sexe === 'femelle' && !STATUTS_STERILISES.includes(a.statutReproducteur)
      );
      const males = activeAnimals.filter(a => a.sexe === 'male' && !STATUTS_STERILISES.includes(a.statutReproducteur));

      // Calculer les alertes globales
      let totalAlertes = 0;
      let alertesRouges = 0;
      let alertesOranges = 0;
      const detailsFemelles = [];

      for (const femelle of femellesRepro) {
        const healthFemelle = allEntries.filter(e => e.animalId === femelle.id);
        const reproAlertes = Utils.analyseReproduction(femelle, healthFemelle);
        const cesariennes = Utils.countCesariennes(healthFemelle);
        const portees2ans = Utils.countPortees2Ans(healthFemelle);
        const age = Utils.ageInYears(femelle.dateNaissance);
        const limiteAge = Utils.AGE_LIMITE_REPRO[femelle.espece] || 8;
        const hasExamen = Utils.hasRecentExamenPreRepro(healthFemelle);

        totalAlertes += reproAlertes.length;
        reproAlertes.forEach(a => {
          if (a.type === 'red') alertesRouges++;
          else alertesOranges++;
        });

        // Déterminer le statut de la femelle
        let statut = 'ok';
        let statutLabel = 'Apte';
        let statutClass = 'badge-green';
        if (reproAlertes.some(a => a.type === 'red')) {
          statut = 'interdit';
          statutLabel = 'Reproduction interdite';
          statutClass = 'badge-red';
        } else if (reproAlertes.some(a => a.type === 'orange')) {
          statut = 'attention';
          statutLabel = 'Attention requise';
          statutClass = 'badge-orange';
        }

        detailsFemelles.push({
          animal: femelle,
          cesariennes,
          portees2ans,
          age,
          limiteAge,
          hasExamen,
          alertes: reproAlertes,
          statut,
          statutLabel,
          statutClass
        });
      }

      // Conformité globale
      let globalClass, globalIcon, globalLabel;
      if (alertesRouges > 0) {
        globalClass = 'conformity-red'; globalIcon = '🔴'; globalLabel = `${alertesRouges} interdiction(s) de reproduction`;
      } else if (alertesOranges > 0) {
        globalClass = 'conformity-orange'; globalIcon = '🟠'; globalLabel = `${alertesOranges} point(s) d'attention`;
      } else {
        globalClass = 'conformity-green'; globalIcon = '🟢'; globalLabel = 'Toutes les femelles sont conformes';
      }

      document.getElementById('conformite-content').innerHTML = `
        <!-- Indicateur global -->
        <div class="conformity-indicator ${globalClass} mb-2">
          ${globalIcon} ${globalLabel}
        </div>

        <!-- Stats rapides -->
        <div class="stat-grid mb-2">
          <div class="stat-card">
            <div class="stat-number">${femellesRepro.length}</div>
            <div class="stat-label">♀ Reproductrices</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${males.length}</div>
            <div class="stat-label">♂ Étalons</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color:${alertesRouges > 0 ? 'var(--red)' : alertesOranges > 0 ? 'var(--orange)' : 'var(--green)'};">${totalAlertes}</div>
            <div class="stat-label">Alertes</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${detailsFemelles.filter(d => d.statut === 'ok').length}</div>
            <div class="stat-label">Aptes</div>
          </div>
        </div>

        <!-- Actions rapides -->
        <div class="section-title"><span class="section-icon">⚡</span> Actions rapides</div>
        <div class="shortcut-grid mb-2">
          <button class="shortcut-btn" onclick="UI.navigateTo('health-form', {type:'mise_bas'})">
            <span class="shortcut-icon">🍼</span>
            Mise bas
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('health-form', {type:'examen_pre_repro'})">
            <span class="shortcut-icon">🔬</span>
            Examen pré-repro
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('health-form', {type:'chirurgie'})">
            <span class="shortcut-icon">🔪</span>
            Césarienne
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('portee-form')">
            <span class="shortcut-icon">📝</span>
            Nouvelle portée
          </button>
        </div>

        <!-- Détail par femelle -->
        <div class="section-title"><span class="section-icon">♀</span> Suivi des reproductrices</div>
        ${femellesRepro.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🔬</div>
            <div class="empty-title">Aucune femelle reproductrice</div>
            <div class="empty-desc">Ajoutez des femelles actives (non stérilisées) pour voir le suivi de conformité</div>
          </div>
        ` : detailsFemelles.map(d => renderFemelleCard(d)).join('')}

        <!-- Outil consanguinité -->
        <div class="section-title mt-3"><span class="section-icon">🧬</span> Vérification consanguinité</div>
        <div class="card mb-2" id="consanguinite-tool">
          <div class="card-subtitle mb-1">Vérifiez la compatibilité entre deux reproducteurs avant un accouplement</div>
          <div class="form-row">
            <div class="form-group" style="flex:1;">
              <label class="form-label">♀ Femelle</label>
              <select class="form-select" id="conso-femelle">
                <option value="">Choisir...</option>
                ${femellesRepro.map(f => `<option value="${f.id}">${Utils.getEspeceEmoji(f.espece)} ${Utils.escapeHtml(f.nom)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">♂ Mâle</label>
              <select class="form-select" id="conso-male">
                <option value="">Choisir...</option>
                ${males.map(m => `<option value="${m.id}">${Utils.getEspeceEmoji(m.espece)} ${Utils.escapeHtml(m.nom)}</option>`).join('')}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="conso-check-btn">Vérifier la compatibilité</button>
          <div id="conso-result" class="mt-1"></div>
        </div>

        <!-- Rappel réglementaire -->
        <div class="card mb-3" style="background:var(--accent-light);border-left:3px solid var(--primary);">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">📜 Rappel — Art. 26, Arrêté du 19 juin 2025</div>
          <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;">
            • Max. <strong>3 césariennes</strong> par femelle (interdiction ensuite)<br>
            • Max. <strong>3 portées par période de 2 ans</strong><br>
            • <strong>Examen pré-reproduction obligatoire</strong> : chiennes dès 8 ans, chattes dès 6 ans<br>
            • <strong>Interdiction de consanguinité</strong> entre parents/enfants et frères/sœurs
          </div>
        </div>
      `;

      // Event: vérification consanguinité
      document.getElementById('conso-check-btn').addEventListener('click', () => {
        const femelleId = document.getElementById('conso-femelle').value;
        const maleId = document.getElementById('conso-male').value;
        const resultEl = document.getElementById('conso-result');

        if (!femelleId || !maleId) {
          resultEl.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.85rem;">Sélectionnez une femelle et un mâle</div>';
          return;
        }

        const femelle = animals.find(a => a.id === femelleId);
        const male = animals.find(a => a.id === maleId);

        if (!femelle || !male) {
          resultEl.innerHTML = '<div style="padding:8px;color:var(--red);font-size:0.85rem;">Animaux non trouvés</div>';
          return;
        }

        // Vérifier espèce
        if (femelle.espece !== male.espece) {
          resultEl.innerHTML = '<div style="padding:10px;border-radius:var(--radius-md);background:var(--red-light);color:var(--red);font-size:0.85rem;">⚠️ Espèces différentes — accouplement impossible</div>';
          return;
        }

        // Vérifier consanguinité
        const issue = Utils.checkConsanguinite(femelle, male);
        if (issue) {
          resultEl.innerHTML = `<div style="padding:10px;border-radius:var(--radius-md);background:var(--red-light);border-left:3px solid var(--red);font-size:0.85rem;">
            <div style="font-weight:700;color:var(--red);">🚫 Consanguinité interdite</div>
            <div style="margin-top:4px;color:var(--text-muted);">${Utils.escapeHtml(issue)}</div>
          </div>`;
        } else {
          // Vérifier aussi la conformité de la femelle
          const healthFemelle = allEntries.filter(e => e.animalId === femelleId);
          const reproAlertes = Utils.analyseReproduction(femelle, healthFemelle);

          if (reproAlertes.some(a => a.type === 'red')) {
            resultEl.innerHTML = `<div style="padding:10px;border-radius:var(--radius-md);background:var(--red-light);border-left:3px solid var(--red);font-size:0.85rem;">
              <div style="font-weight:700;color:var(--red);">🚫 Reproduction interdite pour ${Utils.escapeHtml(femelle.nom)}</div>
              ${reproAlertes.filter(a => a.type === 'red').map(a => `<div style="margin-top:4px;color:var(--text-muted);">${a.desc}</div>`).join('')}
            </div>`;
          } else if (reproAlertes.length > 0) {
            resultEl.innerHTML = `<div style="padding:10px;border-radius:var(--radius-md);background:var(--orange-light);border-left:3px solid var(--orange);font-size:0.85rem;">
              <div style="font-weight:700;color:var(--orange);">⚠️ Compatible mais attention</div>
              <div style="margin-top:4px;">Pas de consanguinité interdite entre ${Utils.escapeHtml(femelle.nom)} et ${Utils.escapeHtml(male.nom)}</div>
              ${reproAlertes.map(a => `<div style="margin-top:4px;color:var(--text-muted);">${a.desc}</div>`).join('')}
            </div>`;
          } else {
            resultEl.innerHTML = `<div style="padding:10px;border-radius:var(--radius-md);background:var(--green-light);border-left:3px solid var(--green);font-size:0.85rem;">
              <div style="font-weight:700;color:var(--green);">✅ Accouplement autorisé</div>
              <div style="margin-top:4px;">Pas de consanguinité interdite entre ${Utils.escapeHtml(femelle.nom)} et ${Utils.escapeHtml(male.nom)}. La femelle est conforme à l'Art. 26.</div>
            </div>`;
          }
        }
      });

    } catch (err) {
      console.error('Erreur module conformité', err);
      document.getElementById('conformite-content').innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderFemelleCard(d) {
    const { animal, cesariennes, portees2ans, age, limiteAge, hasExamen, alertes, statutLabel, statutClass } = d;

    return `
      <div class="card mb-1" style="cursor:pointer;" onclick="UI.navigateTo('animal-detail', {id:'${animal.id}'})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;">${Utils.getEspeceEmoji(animal.espece)} ${Utils.escapeHtml(animal.nom)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${Utils.escapeHtml(animal.race || '')} — ${age} ans</div>
          </div>
          <span class="badge ${statutClass}">${statutLabel}</span>
        </div>

        <!-- Barres de progression -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem;">
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>Césariennes</span>
              <span style="font-weight:600;${cesariennes >= Utils.MAX_CESARIENNES ? 'color:var(--red)' : ''}">${cesariennes}/${Utils.MAX_CESARIENNES}</span>
            </div>
            <div style="height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100, (cesariennes / Utils.MAX_CESARIENNES) * 100)}%;background:${cesariennes >= Utils.MAX_CESARIENNES ? 'var(--red)' : cesariennes >= 2 ? 'var(--orange)' : 'var(--green)'};border-radius:3px;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>Portées (2 ans)</span>
              <span style="font-weight:600;${portees2ans >= Utils.MAX_PORTEES_2ANS ? 'color:var(--red)' : ''}">${portees2ans}/${Utils.MAX_PORTEES_2ANS}</span>
            </div>
            <div style="height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100, (portees2ans / Utils.MAX_PORTEES_2ANS) * 100)}%;background:${portees2ans >= Utils.MAX_PORTEES_2ANS ? 'var(--red)' : portees2ans >= 2 ? 'var(--orange)' : 'var(--green)'};border-radius:3px;"></div>
            </div>
          </div>
        </div>

        ${age >= limiteAge ? `
          <div style="margin-top:8px;padding:6px 10px;border-radius:var(--radius-sm);background:${hasExamen ? 'var(--green-light)' : 'var(--red-light)'};font-size:0.78rem;">
            ${hasExamen
              ? '✅ Examen pré-reproduction valide (< 12 mois)'
              : `⚠️ Examen pré-reproduction requis (${age} ans ≥ ${limiteAge})`
            }
          </div>
        ` : ''}

        ${alertes.length > 0 ? alertes.map(a => `
          <div style="margin-top:4px;padding:6px 10px;border-radius:var(--radius-sm);background:var(--${a.type === 'red' ? 'red' : 'orange'}-light);font-size:0.78rem;border-left:3px solid var(--${a.type === 'red' ? 'red' : 'orange'});">
            ${a.icon} ${a.desc}
          </div>
        `).join('') : ''}
      </div>
    `;
  }

  return { render };
})();
