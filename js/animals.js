/**
 * ElevApp — Module Fiches Animaux
 * CRUD complet avec formulaires conformes, photo, filtres
 */

const Animals = (() => {
  'use strict';

  let currentFilters = { espece: '', statut: '', sexe: '' };
  let searchQuery = '';

  // ---- Liste des animaux ----
  async function renderList() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">🐾</span> Mes animaux</div>

      <!-- Recherche -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="animal-search" placeholder="Rechercher par nom ou n° identification..." value="${Utils.escapeHtml(searchQuery)}">
      </div>

      <!-- Filtres — filtre espèce masqué si profil mono-espèce -->
      <div class="filters-bar" id="animal-filters">
        <button class="filter-chip ${currentFilters.statut === 'actif' ? 'active' : ''}" data-filter="statut" data-value="actif">Actifs</button>
        <button class="filter-chip ${currentFilters.sexe === 'male' ? 'active' : ''}" data-filter="sexe" data-value="male">♂ Mâles</button>
        <button class="filter-chip ${currentFilters.sexe === 'femelle' ? 'active' : ''}" data-filter="sexe" data-value="femelle">♀ Femelles</button>
      </div>

      <div id="animals-list">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    // Event: recherche
    document.getElementById('animal-search').addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      loadAnimalsList();
    }));

    // Event: filtres
    document.getElementById('animal-filters').addEventListener('click', (e) => {
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

    await loadAnimalsList();
  }

  async function loadAnimalsList() {
    const uid = Auth.getUid();
    if (!uid) return;

    const listEl = document.getElementById('animals-list');
    if (!listEl) return;

    try {
      // Forcer filtre espèce selon profil éleveur
      const especeProfil = typeof Auth !== 'undefined' ? Auth.getEspeceElevee() : null;
      let animals = await DB.getAnimals(uid, {
        espece: currentFilters.espece || (especeProfil && especeProfil !== 'les_deux' ? especeProfil : undefined),
        statut: currentFilters.statut || undefined,
        sexe: currentFilters.sexe || undefined
      });

      // Filtre recherche côté client
      if (searchQuery) {
        animals = animals.filter(a =>
          (a.nom && a.nom.toLowerCase().includes(searchQuery)) ||
          (a.puce && a.puce.toLowerCase().includes(searchQuery))
        );
      }

      if (animals.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🐾</div>
            <div class="empty-title">Aucun animal</div>
            <div class="empty-desc">Commencez par ajouter votre premier animal</div>
            <button class="btn btn-primary" onclick="UI.navigateTo('animal-form')">+ Ajouter un animal</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = animals.map(animal => renderAnimalCard(animal)).join('');

      // Events: click carte
      listEl.querySelectorAll('.animal-card').forEach(card => {
        card.addEventListener('click', () => {
          UI.navigateTo('animal-detail', { id: card.dataset.id });
        });
      });

    } catch (err) {
      console.error('Erreur chargement animaux', err);
      listEl.innerHTML = '<p class="text-center text-muted">Erreur de chargement</p>';
    }
  }

  function renderAnimalCard(animal) {
    const photo = animal.photoURL
      ? `<img class="animal-photo" src="${animal.photoURL}" alt="${Utils.escapeHtml(animal.nom)}" loading="lazy">`
      : `<div class="animal-photo-placeholder">${Utils.getEspeceEmoji(animal.espece)}</div>`;

    const raceLabel = animal.race
      ? (animal.raceType && Utils.RACE_TYPES[animal.raceType]
          ? `${Utils.RACE_TYPES[animal.raceType]}${animal.raceType === 'apparence' ? ' ' + Utils.escapeHtml(animal.race) : animal.raceType !== 'nonRace' ? ' — ' + Utils.escapeHtml(animal.race) : ''}`
          : Utils.escapeHtml(animal.race))
      : 'Race non renseignée';

    return `
      <div class="card animal-card mb-1" data-id="${animal.id}">
        ${photo}
        <div class="animal-info">
          <div class="animal-name">${Utils.escapeHtml(animal.nom)}</div>
          <div class="animal-meta">
            <span>${raceLabel}</span>
          </div>
          <div class="animal-meta" style="margin-top:4px;">
            <span class="badge ${Utils.getStatutBadgeClass(animal.statut)}">${Utils.STATUTS_ANIMAL[animal.statut] || animal.statut}</span>
            <span>${animal.sexe === 'male' ? '♂' : '♀'}</span>
            ${animal.dateNaissance ? `<span>${Utils.ageString(animal.dateNaissance)}</span>` : ''}
            ${animal.potentiel ? `<span class="badge badge-light">${{compagnie: 'Compagnie', reproduction: 'Reproduction', exposition: 'Exposition', compagnie_reproduction: 'Compagnie & Repro'}[animal.potentiel] || animal.potentiel}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ---- Détail d'un animal ----
  async function renderDetail(animalId) {
    UI.setContent(`
      ${UI.pageHeader('Chargement...', 'animals')}
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `);

    const uid = Auth.getUid();
    if (!uid || !animalId) return;

    try {
      const animal = await DB.getAnimal(uid, animalId);
      if (!animal) {
        UI.setContent(`${UI.pageHeader('Erreur', 'animals')}<p class="text-center text-muted">Animal introuvable</p>`);
        return;
      }

      // Lancer toutes les requêtes dépendantes en parallèle
      const [healthEntries, mereData, pereData] = await Promise.all([
        DB.getHealthEntries(uid, animalId),
        animal.parentMereId ? DB.getAnimal(uid, animal.parentMereId) : Promise.resolve(null),
        animal.parentPereId ? DB.getAnimal(uid, animal.parentPereId) : Promise.resolve(null)
      ]);

      // Récupérer noms des parents
      let mereNom = '—', pereNom = '—';
      if (mereData) mereNom = `<a href="#" onclick="UI.navigateTo('animal-detail', {id:'${animal.parentMereId}'}); return false;">${Utils.escapeHtml(mereData.nom)}</a>`;
      if (pereData) pereNom = `<a href="#" onclick="UI.navigateTo('animal-detail', {id:'${animal.parentPereId}'}); return false;">${Utils.escapeHtml(pereData.nom)}</a>`;

      // Badge conformité
      const conformity = getAnimalConformity(animal, healthEntries);

      const raceDisplay = getRaceDisplay(animal);

      const photo = animal.photoURL
        ? `<img src="${animal.photoURL}" alt="${Utils.escapeHtml(animal.nom)}" style="width:100%;max-height:250px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:16px;">`
        : '';

      UI.setContent(`
        ${UI.pageHeader(Utils.escapeHtml(animal.nom), 'animals')}

        ${photo}

        <!-- Conformité -->
        <div class="conformity-indicator ${conformity.class} mb-2">
          ${conformity.icon} ${conformity.label}
        </div>

        <!-- Infos -->
        <div class="card mb-2">
          <div class="info-row">
            <span class="info-label">Espèce</span>
            <span class="info-value">${Utils.getEspeceEmoji(animal.espece)} ${animal.espece === 'canin' ? 'Canin' : 'Félin'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Race</span>
            <span class="info-value">${raceDisplay}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sexe</span>
            <span class="info-value">${Utils.SEXES[animal.sexe] || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date de naissance</span>
            <span class="info-value">${Utils.formatDate(animal.dateNaissance)}${animal.dateNaissanceApprox ? ' (approx.)' : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Âge</span>
            <span class="info-value">${Utils.ageString(animal.dateNaissance)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Identification</span>
            <span class="info-value">${Utils.escapeHtml(animal.puce) || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Couleur robe</span>
            <span class="info-value">${Utils.escapeHtml(animal.couleurRobe) || '—'}</span>
          </div>
          ${animal.signesParticuliers ? `<div class="info-row">
            <span class="info-label">Signes particuliers</span>
            <span class="info-value">${Utils.escapeHtml(animal.signesParticuliers)}</span>
          </div>` : ''}
          ${animal.potentiel ? `<div class="info-row">
            <span class="info-label">Potentiel</span>
            <span class="info-value">${{compagnie: 'Compagnie', reproduction: 'Reproduction', exposition: 'Exposition', compagnie_reproduction: 'Compagnie & Reproduction'}[animal.potentiel] || animal.potentiel}</span>
          </div>` : ''}
          ${animal.nomNaissance && animal.nomNaissance !== animal.nom ? `<div class="info-row">
            <span class="info-label">Nom de naissance</span>
            <span class="info-value">${Utils.escapeHtml(animal.nomNaissance)}</span>
          </div>` : ''}
          ${animal.poidsNaissance || animal.heureNaissance ? `<div class="info-row">
            <span class="info-label">Naissance</span>
            <span class="info-value">${animal.poidsNaissance ? animal.poidsNaissance + ' g' : ''}${animal.poidsNaissance && animal.heureNaissance ? ' à ' : ''}${animal.heureNaissance ? animal.heureNaissance : ''}</span>
          </div>` : ''}
          ${animal.localisation ? `<div class="info-row">
            <span class="info-label">Localisation</span>
            <span class="info-value">${Utils.escapeHtml(animal.localisation)}</span>
          </div>` : ''}
          ${animal.lof?.numero || animal.lof?.confirme || animal.lof?.adnTest || animal.lof?.cotation ? `<div class="info-row">
            <span class="info-label">LOF/LOOF</span>
            <span class="info-value">
              ${animal.lof?.numero ? `<div>${Utils.escapeHtml(animal.lof.numero)}</div>` : ''}
              ${animal.lof?.confirme ? '<span class="badge badge-green">Confirmé</span> ' : ''}
              ${animal.lof?.adnTest ? `<span class="badge badge-blue">ADN</span> ` : ''}
              ${animal.lof?.cotation ? `<span class="badge">${animal.lof.cotation}</span>` : ''}
            </span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">Reproducteur</span>
            <span class="info-value">
              ${animal.statutReproducteur === 'autre' && animal.statutReproducteurAutre
                ? Utils.escapeHtml(animal.statutReproducteurAutre)
                : (Utils.STATUTS_REPRODUCTEUR[animal.statutReproducteur] || '—')}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Statut</span>
            <span class="info-value"><span class="badge ${Utils.getStatutBadgeClass(animal.statut)}">${Utils.STATUTS_ANIMAL[animal.statut] || animal.statut}</span></span>
          </div>
          <div class="info-row">
            <span class="info-label">Mère</span>
            <span class="info-value">${mereNom}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Père</span>
            <span class="info-value">${pereNom}</span>
          </div>
        </div>

        <!-- Indicateurs reproduction Art. 26 -->
        ${animal.sexe === 'femelle' && animal.statutReproducteur === 'nonSterilise' ? (() => {
          const cesariennes = Utils.countCesariennes(healthEntries);
          const portees2ans = Utils.countPortees2Ans(healthEntries);
          const age = Utils.ageInYears(animal.dateNaissance);
          const limiteAge = Utils.AGE_LIMITE_REPRO[animal.espece] || 8;
          const hasExamen = Utils.hasRecentExamenPreRepro(healthEntries);
          const reproAlertes = Utils.analyseReproduction(animal, healthEntries);
          return `
            <div class="section-title"><span class="section-icon">🍼</span> Reproduction (Art. 26)</div>
            <div class="card mb-2">
              <div class="info-row">
                <span class="info-label">Césariennes</span>
                <span class="info-value">${cesariennes} / ${Utils.MAX_CESARIENNES} max ${cesariennes >= Utils.MAX_CESARIENNES ? '<span class="badge badge-red">Limite atteinte</span>' : ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Portées (2 ans)</span>
                <span class="info-value">${portees2ans} / ${Utils.MAX_PORTEES_2ANS} max ${portees2ans >= Utils.MAX_PORTEES_2ANS ? '<span class="badge badge-red">Limite atteinte</span>' : ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Âge</span>
                <span class="info-value">${age} ans ${age >= limiteAge ? '<span class="badge badge-orange">Examen requis</span>' : ''}</span>
              </div>
              ${age >= limiteAge ? `<div class="info-row">
                <span class="info-label">Examen pré-repro</span>
                <span class="info-value">${hasExamen ? '<span class="badge badge-green">Valide (&lt; 12 mois)</span>' : '<span class="badge badge-red">Requis</span>'}</span>
              </div>` : ''}
              ${reproAlertes.length > 0 ? reproAlertes.map(ra => `
                <div style="padding:8px 12px;margin-top:8px;border-radius:var(--radius-md);background:var(--bg-secondary);border-left:3px solid var(--${ra.type === 'red' ? 'red' : 'orange'});">
                  <div style="font-weight:600;font-size:0.85rem;">${ra.icon} ${ra.titre}</div>
                  <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${ra.desc}</div>
                </div>
              `).join('') : '<div style="padding:8px 12px;margin-top:8px;color:var(--green);font-size:0.85rem;">✅ Apte à la reproduction</div>'}
            </div>
          `;
        })() : ''}

        <!-- Chaleurs (femelles non stérilisées) -->
        ${animal.sexe === 'femelle' && animal.statutReproducteur !== 'sterilise' ? `
          <div class="section-title"><span class="section-icon">🌡️</span> Chaleurs &amp; Cycles</div>
          <div class="card mb-2" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="font-size:0.85rem;color:var(--text-muted);">Suivi progestérone, saillies, mises bas</div>
            <button class="btn btn-secondary btn-sm" onclick="UI.navigateTo('chaleurs-list', {animalId:'${animalId}'})">Voir →</button>
          </div>
        ` : ''}

        <!-- Suivi du poids -->
        ${(() => {
          const pesees = healthEntries
            .filter(e => e.type === 'pesee' && e.metadata?.poids != null)
            .map(e => ({
              date: e.date,
              poids: e.metadata.poids, // en grammes
              poidsAffiche: e.metadata.poidsAffiche,
              unite: e.metadata.poidsUnite || 'kg'
            }))
            .sort((a, b) => {
              const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
              const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
              return da - db;
            });
          if (pesees.length === 0) return '';
          const dernierePesee = pesees[pesees.length - 1];
          const afficher = (p) => p.unite === 'g' ? `${p.poidsAffiche} g` : `${p.poidsAffiche} kg`;
          // Mini graphique SVG
          const W = 280, H = 80, PAD = 16;
          const vals = pesees.map(p => p.poids);
          const minV = Math.min(...vals), maxV = Math.max(...vals);
          const range = maxV - minV || 1;
          const pts = pesees.map((p, i) => {
            const x = PAD + (i / Math.max(pesees.length - 1, 1)) * (W - PAD * 2);
            const y = H - PAD - ((p.poids - minV) / range) * (H - PAD * 2);
            return `${x},${y}`;
          }).join(' ');
          const svgChart = pesees.length > 1 ? `
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;margin:4px 0 8px;">
              <polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
              ${pesees.map((p, i) => {
                const x = PAD + (i / Math.max(pesees.length - 1, 1)) * (W - PAD * 2);
                const y = H - PAD - ((p.poids - minV) / range) * (H - PAD * 2);
                return `<circle cx="${x}" cy="${y}" r="3" fill="var(--primary)"/>`;
              }).join('')}
            </svg>
          ` : '';
          return `
            <div class="section-title"><span class="section-icon">⚖️</span> Suivi du poids</div>
            <div class="card mb-2">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <div style="font-size:1.4rem;font-weight:800;color:var(--primary);">${afficher(dernierePesee)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">Dernière pesée — ${Utils.formatDate(dernierePesee.date)}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'pesee'})">+ Pesée</button>
              </div>
              ${svgChart}
              ${pesees.length > 1 ? `
                <div style="overflow-x:auto;">
                  <table style="width:100%;font-size:0.78rem;border-collapse:collapse;">
                    <thead><tr style="color:var(--text-muted);font-weight:600;">
                      <th style="text-align:left;padding:4px 0;">Date</th>
                      <th style="text-align:right;padding:4px 0;">Poids</th>
                      <th style="text-align:right;padding:4px 0;">Écart</th>
                    </tr></thead>
                    <tbody>${[...pesees].reverse().slice(0, 8).map((p, i, arr) => {
                      const prev = arr[i + 1];
                      const diff = prev ? p.poids - prev.poids : null;
                      const diffStr = diff !== null ? (diff > 0 ? `<span style="color:var(--green);">+${(diff/1000).toFixed(2)} kg</span>` : `<span style="color:var(--red);">${(diff/1000).toFixed(2)} kg</span>`) : '—';
                      return `<tr style="border-top:1px solid var(--border);">
                        <td style="padding:5px 0;">${Utils.formatDate(p.date)}</td>
                        <td style="text-align:right;font-weight:600;padding:5px 0;">${afficher(p)}</td>
                        <td style="text-align:right;padding:5px 0;">${diffStr}</td>
                      </tr>`;
                    }).join('')}</tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          `;
        })()}

        <!-- Actions rapides -->
        <div class="section-title"><span class="section-icon">⚡</span> Actions rapides</div>
        <div class="quick-actions mb-2">
          <button class="quick-action-btn" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'vaccin'})">💉 Vaccin</button>
          <button class="quick-action-btn" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'traitement'})">💊 Traitement</button>
          <button class="quick-action-btn" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'visite_veto'})">🏥 Visite véto</button>
          <button class="quick-action-btn" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'chirurgie'})">🔪 Chirurgie</button>
          <button class="quick-action-btn" onclick="UI.navigateTo('health-form', {animalId:'${animalId}', type:'pesee'})">⚖️ Pesée</button>
          <button class="quick-action-btn" onclick="UI.navigateTo('cession-form', {animalId:'${animalId}'})">📜 Cession</button>
          ${animal.sexe === 'femelle' && animal.statutReproducteur !== 'sterilise' ? `<button class="quick-action-btn" onclick="UI.navigateTo('chaleur-form', {animalId:'${animalId}'})">🌡️ Chaleur</button>` : ''}
        </div>

        <!-- Boutons éditer / supprimer -->
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="UI.navigateTo('animal-form', {id:'${animalId}'})">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" id="delete-animal-btn">🗑️</button>
        </div>

        <!-- Timeline sanitaire -->
        <div class="section-title"><span class="section-icon">📋</span> Historique sanitaire</div>
        ${healthEntries.length === 0
          ? '<p class="text-muted" style="font-size:0.85rem;">Aucun événement sanitaire enregistré</p>'
          : `<div class="timeline">${healthEntries.map(entry => renderTimelineItem(entry)).join('')}</div>`
        }

        <div class="mb-3"></div>
      `);

      // Delete
      document.getElementById('delete-animal-btn').addEventListener('click', () => {
        UI.confirmModal('Supprimer cet animal et tout son historique sanitaire ?', async () => {
          try {
            await DB.deleteAnimal(uid, animalId);
            UI.toast('Animal supprimé', 'success');
            UI.navigateTo('animals');
          } catch (e) {
            UI.toast('Erreur de suppression', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Erreur chargement animal', err);
      UI.setContent(`${UI.pageHeader('Erreur', 'animals')}<p class="text-center text-muted">Erreur de chargement</p>`);
    }
  }

  function renderTimelineItem(entry) {
    const typeInfo = Utils.TYPES_SANTE[entry.type] || { label: entry.type, icon: '📝' };
    const date = Utils.formatDate(entry.date);
    const isAlert = entry.rappelDate && Utils.isExpired(entry.rappelDate);

    return `
      <div class="timeline-item ${isAlert ? 'alert' : ''}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="flex:1;">
            <div class="timeline-date">${date}</div>
            <div class="timeline-type">${typeInfo.icon} ${typeInfo.label}</div>
            <div class="timeline-title">${Utils.escapeHtml(entry.titre)}</div>
            ${entry.details ? `<div class="timeline-details">${Utils.escapeHtml(entry.details).substring(0, 120)}${entry.details.length > 120 ? '...' : ''}</div>` : ''}
            ${entry.rappelDate ? `<div class="timeline-details" style="color:${isAlert ? 'var(--red)' : 'var(--orange)'};">⏰ Rappel : ${Utils.formatDate(entry.rappelDate)}${isAlert ? ' (dépassé !)' : ''}</div>` : ''}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:2px;">
            <button onclick="event.stopPropagation();UI.navigateTo('health-form',{animalId:'${entry.animalId}',entryId:'${entry.id}'})"
              style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;color:var(--primary);">
              ✏️
            </button>
            <button onclick="event.stopPropagation();Animals._deleteHealthEntry('${entry.animalId}','${entry.id}')"
              style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;color:var(--red);">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function _deleteHealthEntry(animalId, entryId) {
    UI.confirmModal('Supprimer cette entrée sanitaire ?', async () => {
      const uid = Auth.getUid();
      await DB.deleteHealthEntry(uid, animalId, entryId);
      UI.toast('Entrée supprimée', 'success');
      renderDetail(animalId);
    });
  }

  function getAnimalConformity(animal, healthEntries) {
    const issues = [];
    let hasRed = false;

    if (!animal.puce) issues.push('Pas d\'identification');

    // Vérifier les rappels dépassés
    const expiredReminders = healthEntries.filter(e =>
      e.rappelDate && Utils.isExpired(e.rappelDate)
    );
    if (expiredReminders.length > 0) issues.push(`${expiredReminders.length} rappel(s) dépassé(s)`);

    // Alertes reproduction Art. 26
    const reproAlertes = Utils.analyseReproduction(animal, healthEntries);
    reproAlertes.forEach(ra => {
      issues.push(ra.titre.split(' : ').pop() || ra.titre);
      if (ra.type === 'red') hasRed = true;
    });

    if (issues.length === 0) return { class: 'conformity-green', icon: '🟢', label: 'Conforme' };
    if (hasRed) return { class: 'conformity-red', icon: '🔴', label: `Non conforme : ${issues.join(', ')}` };
    if (issues.length <= 2) return { class: 'conformity-orange', icon: '🟠', label: `Attention : ${issues.join(', ')}` };
    return { class: 'conformity-red', icon: '🔴', label: `Non conforme : ${issues.join(', ')}` };
  }

  function getRaceDisplay(animal) {
    if (!animal.race) return '—';
    if (animal.raceType === 'lof') return `${Utils.escapeHtml(animal.race)} (LOF)`;
    if (animal.raceType === 'loof') return `${Utils.escapeHtml(animal.race)} (LOOF)`;
    if (animal.raceType === 'apparence') return `d'apparence ${Utils.escapeHtml(animal.race)}`;
    if (animal.raceType === 'nonRace') return "N'appartient pas à une race";
    return Utils.escapeHtml(animal.race);
  }

  // ---- Formulaire animal ----
  async function renderForm(animalId) {
    const isEdit = !!animalId;
    const uid = Auth.getUid();

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'animal' : 'Nouvel animal', isEdit ? 'animal-detail' : 'animals')}
      <div class="skeleton skeleton-card"></div>
    `);

    let animal = {};
    if (isEdit) {
      animal = await DB.getAnimal(uid, animalId) || {};
    }

    // Charger les parents potentiels
    const [males, femelles] = await Promise.all([
      DB.getAnimalsBySex(uid, 'male'),
      DB.getAnimalsBySex(uid, 'femelle')
    ]);

    // Filtrer l'animal actuel des options parents
    const filteredMales = males.filter(m => m.id !== animalId);
    const filteredFemelles = femelles.filter(f => f.id !== animalId);

    UI.setContent(`
      ${UI.pageHeader(isEdit ? 'Modifier l\'animal' : 'Nouvel animal', isEdit ? 'animal-detail' : 'animals')}

      <form id="animal-form">
        <!-- Photo -->
        <div class="form-group" style="display:flex;justify-content:center;">
          <div class="photo-upload" id="photo-upload">
            ${animal.photoURL
              ? `<img src="${animal.photoURL}" alt="Photo" id="photo-preview">`
              : `<div class="upload-placeholder" id="photo-placeholder">
                  <span class="upload-icon">📷</span>
                  <span>Ajouter photo</span>
                </div>`
            }
            <input type="file" accept="image/*" id="photo-input">
          </div>
        </div>

        <!-- Espèce -->
        <div class="form-group">
          <label class="form-label" for="anim-espece">Espèce <span class="required">*</span></label>
          ${(() => {
            const esp = typeof Auth !== 'undefined' ? Auth.getEspeceElevee() : '';
            const defaultEspece = animal.espece || esp || '';
            // Si profil mono-espèce et pas en édition → champ caché, espèce forcée
            if ((esp === 'canin' || esp === 'felin') && !animal.espece) {
              return `
                <input type="hidden" id="anim-espece" value="${esp}">
                <div class="form-input" style="background:var(--bg-light);color:var(--text-muted);cursor:default;">
                  ${esp === 'canin' ? '🐕 Canin' : '🐈 Félin'} <span style="font-size:0.75rem;">(défini dans votre profil)</span>
                </div>
              `;
            }
            return `
              <select class="form-select" id="anim-espece" required>
                <option value="">Choisir...</option>
                <option value="canin" ${defaultEspece === 'canin' ? 'selected' : ''}>🐕 Canin</option>
                <option value="felin" ${defaultEspece === 'felin' ? 'selected' : ''}>🐈 Félin</option>
              </select>
            `;
          })()}
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label" for="anim-nom">Nom <span class="required">*</span></label>
          <input class="form-input" type="text" id="anim-nom" required value="${Utils.escapeHtml(animal.nom || '')}" placeholder="Nom de l'animal">
        </div>

        <!-- Race -->
        <div class="form-group">
          <label class="form-label" for="anim-race">Race</label>
          <input class="form-input" type="text" id="anim-race" value="${Utils.escapeHtml(animal.race || '')}" placeholder="Race" list="race-suggestions">
          <datalist id="race-suggestions"></datalist>
        </div>

        <!-- Type racial -->
        <div class="form-group">
          <label class="form-label" for="anim-raceType">Type racial</label>
          <select class="form-select" id="anim-raceType">
            <option value="">Choisir...</option>
            <option value="lof" ${animal.raceType === 'lof' ? 'selected' : ''}>De race (LOF)</option>
            <option value="loof" ${animal.raceType === 'loof' ? 'selected' : ''}>De race (LOOF)</option>
            <option value="apparence" ${animal.raceType === 'apparence' ? 'selected' : ''}>D'apparence</option>
            <option value="nonRace" ${animal.raceType === 'nonRace' ? 'selected' : ''}>N'appartient pas à une race</option>
          </select>
          <div class="form-hint" id="raceType-hint"></div>
        </div>

        <!-- Sexe -->
        <div class="form-group">
          <label class="form-label" for="anim-sexe">Sexe <span class="required">*</span></label>
          <select class="form-select" id="anim-sexe" required>
            <option value="">Choisir...</option>
            <option value="male" ${animal.sexe === 'male' ? 'selected' : ''}>♂ Mâle</option>
            <option value="femelle" ${animal.sexe === 'femelle' ? 'selected' : ''}>♀ Femelle</option>
          </select>
        </div>

        <!-- Date naissance -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="anim-dateNaissance">Date de naissance <span class="required">*</span></label>
            <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="anim-dateNaissance" required value="${animal.dateNaissance ? Utils.formatDateInput(animal.dateNaissance) : ''}">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;">
            <label class="form-toggle">
              <input type="checkbox" id="anim-dateApprox" ${animal.dateNaissanceApprox ? 'checked' : ''}>
              <span style="font-size:0.85rem;">Approximative</span>
            </label>
          </div>
        </div>

        <!-- Identification -->
        <div class="form-group">
          <label class="form-label" for="anim-puce">N° d'identification <span class="required">*</span></label>
          <input class="form-input" type="text" id="anim-puce" required value="${Utils.escapeHtml(animal.puce || '')}" placeholder="Puce (15 chiffres) ou tatouage">
          <div class="form-error" id="puce-error">Format invalide (puce: 15 chiffres, tatouage: 3-10 caractères alphanumériques)</div>
        </div>

        <!-- Couleur robe -->
        <div class="form-group">
          <label class="form-label" for="anim-couleur">Couleur de la robe <span class="required">*</span></label>
          <input class="form-input" type="text" id="anim-couleur" required value="${Utils.escapeHtml(animal.couleurRobe || '')}" placeholder="Ex: noir et blanc, tricolore...">
        </div>

        <!-- Signes particuliers -->
        <div class="form-group">
          <label class="form-label" for="anim-signes">Signes particuliers</label>
          <textarea class="form-textarea" id="anim-signes" rows="2" placeholder="Optionnel">${Utils.escapeHtml(animal.signesParticuliers || '')}</textarea>
        </div>

        <!-- Informations complémentaires -->
        <div class="section-title mt-2"><span class="section-icon">📋</span> Informations complémentaires</div>
        <div class="card mb-2">
          <!-- Potentiel -->
          <div class="form-group">
            <label class="form-label" for="anim-potentiel">Potentiel</label>
            <select class="form-select" id="anim-potentiel">
              <option value="">Non défini</option>
              <option value="compagnie" ${animal.potentiel === 'compagnie' ? 'selected' : ''}>Compagnie</option>
              <option value="reproduction" ${animal.potentiel === 'reproduction' ? 'selected' : ''}>Reproduction</option>
              <option value="exposition" ${animal.potentiel === 'exposition' ? 'selected' : ''}>Exposition</option>
              <option value="compagnie_reproduction" ${animal.potentiel === 'compagnie_reproduction' ? 'selected' : ''}>Compagnie & Reproduction</option>
            </select>
          </div>

          <!-- Nom de naissance -->
          <div class="form-group">
            <label class="form-label" for="anim-nomNaissance">Nom de naissance</label>
            <input class="form-input" type="text" id="anim-nomNaissance" value="${Utils.escapeHtml(animal.nomNaissance || '')}" placeholder="Nom d'affixe de naissance">
            <div class="form-hint">Différent du nom d'usage si applicable</div>
          </div>

          <!-- Poids de naissance -->
          <div class="form-group">
            <label class="form-label" for="anim-poidsNaissance">Poids de naissance</label>
            <div style="display:flex;gap:4px;align-items:center;">
              <input class="form-input" type="number" id="anim-poidsNaissance" step="1" value="${animal.poidsNaissance || ''}" placeholder="En grammes" style="flex:1;">
              <span style="font-size:0.9rem;color:var(--text-muted);">g</span>
            </div>
          </div>

          <!-- Heure de naissance -->
          <div class="form-group">
            <label class="form-label" for="anim-heureNaissance">Heure de naissance</label>
            <input class="form-input" type="time" id="anim-heureNaissance" value="${animal.heureNaissance || ''}">
          </div>

          <!-- Localisation -->
          <div class="form-group">
            <label class="form-label" for="anim-localisation">Localisation</label>
            <input class="form-input" type="text" id="anim-localisation" value="${Utils.escapeHtml(animal.localisation || '')}" placeholder="Ex: Maternité, Quarantaine, Nurserie...">
          </div>
        </div>

        <!-- Enregistrement & Identification -->
        <div class="section-title mt-2"><span class="section-icon">📜</span> Enregistrement & Identification</div>
        <div class="card mb-2">
          <!-- N° LOF/LOOF -->
          <div class="form-group">
            <label class="form-label" for="anim-lofNumero">N° LOF/LOOF</label>
            <input class="form-input" type="text" id="anim-lofNumero" value="${Utils.escapeHtml(animal.lof?.numero || '')}" placeholder="Numéro d'enregistrement">
          </div>

          <!-- Confirmé -->
          <div class="form-group">
            <label class="form-toggle">
              <input type="checkbox" id="anim-lofConfirme" ${animal.lof?.confirme ? 'checked' : ''}>
              <span>Inscrit définitif / Confirmé</span>
            </label>
          </div>

          <!-- Test ADN effectué -->
          <div class="form-group">
            <label class="form-toggle">
              <input type="checkbox" id="anim-adnTest" ${animal.lof?.adnTest ? 'checked' : ''}>
              <span>Test ADN effectué</span>
            </label>
          </div>

          <!-- Identification ADN -->
          <div class="form-group" id="adn-identification-group" style="display:${animal.lof?.adnTest ? 'block' : 'none'};">
            <label class="form-label" for="anim-adnIdentification">Identification ADN</label>
            <input class="form-input" type="text" id="anim-adnIdentification" value="${Utils.escapeHtml(animal.lof?.adnIdentification || '')}" placeholder="N° identification ADN">
          </div>

          <!-- Cotation -->
          <div class="form-group">
            <label class="form-label" for="anim-cotation">Cotation</label>
            <select class="form-select" id="anim-cotation">
              <option value="">Non défini</option>
              <option value="1" ${animal.lof?.cotation === '1' ? 'selected' : ''}>1 - Inscrit</option>
              <option value="2" ${animal.lof?.cotation === '2' ? 'selected' : ''}>2 - Sélectionné</option>
              <option value="3" ${animal.lof?.cotation === '3' ? 'selected' : ''}>3 - Recommandé</option>
              <option value="4" ${animal.lof?.cotation === '4' ? 'selected' : ''}>4 - Élite A</option>
              <option value="5" ${animal.lof?.cotation === '5' ? 'selected' : ''}>5 - Élite B</option>
              <option value="6" ${animal.lof?.cotation === '6' ? 'selected' : ''}>6 - Élite C</option>
            </select>
          </div>
        </div>

        <!-- Statut reproducteur -->
        <div class="form-group">
          <label class="form-label" for="anim-statutRepro">Statut reproducteur <span class="required">*</span></label>
          <select class="form-select" id="anim-statutRepro" required onchange="Animals._toggleStatutAutre(this.value)">
            <option value="">Choisir...</option>
            ${Object.entries(Utils.STATUTS_REPRODUCTEUR).map(([k, v]) =>
              `<option value="${k}" ${animal.statutReproducteur === k ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>
        <!-- Champ libre si "Autre" -->
        <div class="form-group" id="statut-autre-group" style="display:${animal.statutReproducteur === 'autre' ? 'block' : 'none'};">
          <label class="form-label" for="anim-statutAutre">Précisez le statut</label>
          <input type="text" class="form-control" id="anim-statutAutre" placeholder="Ex: En attente confirmation LOF, En test de travail..." value="${Utils.escapeHtml(animal.statutReproducteurAutre || '')}">
        </div>

        <!-- Statut -->
        <div class="form-group">
          <label class="form-label" for="anim-statut">Statut <span class="required">*</span></label>
          <select class="form-select" id="anim-statut" required>
            ${Object.entries(Utils.STATUTS_ANIMAL).map(([k, v]) =>
              `<option value="${k}" ${(animal.statut || 'actif') === k ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Mère -->
        <div class="form-group">
          <label class="form-label" for="anim-mere">Mère</label>
          <select class="form-select" id="anim-mere">
            <option value="">Non renseignée</option>
            ${filteredFemelles.map(f =>
              `<option value="${f.id}" ${animal.parentMereId === f.id ? 'selected' : ''}>${Utils.escapeHtml(f.nom)} — ${Utils.escapeHtml(f.race || '?')}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Père -->
        <div class="form-group">
          <label class="form-label" for="anim-pere">Père</label>
          <select class="form-select" id="anim-pere">
            <option value="">Non renseigné</option>
            ${filteredMales.map(m =>
              `<option value="${m.id}" ${animal.parentPereId === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.nom)} — ${Utils.escapeHtml(m.race || '?')}</option>`
            ).join('')}
          </select>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">${isEdit ? 'Enregistrer' : 'Ajouter l\'animal'}</button>
      </form>
    `);

    // ---- Type racial conditionnel selon espèce ----
    const especeSelect = document.getElementById('anim-espece');
    const raceTypeSelect = document.getElementById('anim-raceType');
    function updateRaceTypeOptions() {
      const espece = especeSelect.value;
      const options = raceTypeSelect.querySelectorAll('option');
      // LOF seulement pour canin, LOOF seulement pour félin
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
      const race = document.getElementById('anim-race').value;
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
        // Re-attach listener
        document.getElementById('photo-input').addEventListener('change', arguments.callee);
      } catch (err) {
        UI.toast('Erreur de compression de la photo', 'error');
      }
    });

    // ---- ADN Test checkbox toggle ADN Identification visibility ----
    document.getElementById('anim-adnTest').addEventListener('change', (e) => {
      const adnGroup = document.getElementById('adn-identification-group');
      adnGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    // ---- Validation puce en temps réel ----
    document.getElementById('anim-puce').addEventListener('input', (e) => {
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

    // ---- Submit ----
    document.getElementById('animal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const puce = document.getElementById('anim-puce').value.trim();
      if (!Utils.validatePuce(puce)) {
        document.getElementById('puce-error').classList.add('visible');
        document.getElementById('anim-puce').classList.add('error');
        return;
      }

      const data = {
        espece: document.getElementById('anim-espece').value,
        nom: document.getElementById('anim-nom').value.trim(),
        race: document.getElementById('anim-race').value.trim(),
        raceType: document.getElementById('anim-raceType').value,
        sexe: document.getElementById('anim-sexe').value,
        dateNaissance: firebase.firestore.Timestamp.fromDate(Utils.parseDateInput(document.getElementById('anim-dateNaissance').value)),
        dateNaissanceApprox: document.getElementById('anim-dateApprox').checked,
        puce: puce,
        couleurRobe: document.getElementById('anim-couleur').value.trim(),
        signesParticuliers: document.getElementById('anim-signes').value.trim(),
        statutReproducteur: document.getElementById('anim-statutRepro').value,
        statutReproducteurAutre: document.getElementById('anim-statutRepro').value === 'autre'
          ? (document.getElementById('anim-statutAutre')?.value.trim() || '')
          : '',
        statut: document.getElementById('anim-statut').value,
        parentMereId: document.getElementById('anim-mere').value || null,
        parentPereId: document.getElementById('anim-pere').value || null,
        potentiel: document.getElementById('anim-potentiel').value,
        nomNaissance: document.getElementById('anim-nomNaissance').value.trim(),
        poidsNaissance: document.getElementById('anim-poidsNaissance').value,
        heureNaissance: document.getElementById('anim-heureNaissance').value,
        localisation: document.getElementById('anim-localisation').value.trim(),
        lof: {
          numero: document.getElementById('anim-lofNumero').value.trim(),
          confirme: document.getElementById('anim-lofConfirme').checked,
          adnTest: document.getElementById('anim-adnTest').checked,
          adnIdentification: document.getElementById('anim-adnIdentification').value.trim(),
          cotation: document.getElementById('anim-cotation').value
        }
      };

      try {
        let id = animalId;
        if (isEdit) {
          await DB.updateAnimal(uid, animalId, data);
        } else {
          data.photoURL = null;
          id = await DB.addAnimal(uid, data);
        }

        // Upload photo si nouvelle
        if (photoBlob) {
          const url = await DB.uploadPhoto(uid, id, photoBlob);
          await DB.updateAnimal(uid, id, { photoURL: url });
        }

        UI.toast(isEdit ? 'Animal mis à jour' : 'Animal ajouté', 'success');
        UI.navigateTo('animal-detail', { id });
      } catch (err) {
        console.error('Erreur sauvegarde animal', err);
        UI.toast('Erreur de sauvegarde', 'error');
      }
    });
  }

  // ---- Toggle champ libre statut reproducteur ----
  function _toggleStatutAutre(value) {
    const group = document.getElementById('statut-autre-group');
    if (group) group.style.display = value === 'autre' ? 'block' : 'none';
  }

  return { renderList, renderDetail, renderForm, _toggleStatutAutre, _deleteHealthEntry };
})();
