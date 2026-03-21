/**
 * ElevApp — Module Dashboard
 * Vue d'accueil : conformité, alertes, indicateurs
 */

const Dashboard = (() => {
  'use strict';

  async function render() {
    UI.setContent(`
      <div class="section-title"><span class="section-icon">🏠</span> Tableau de bord</div>
      <div id="dashboard-content">
        <div class="skeleton skeleton-card"></div>
        <div class="stat-grid mb-2">
          <div class="skeleton" style="height:90px;"></div>
          <div class="skeleton" style="height:90px;"></div>
        </div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const [animals, reminders, profile, snapshots] = await Promise.all([
        DB.getAnimals(uid),
        DB.getUpcomingReminders(uid, 30),
        DB.getUserProfile(uid),
        DB.getSnapshots(uid)
      ]);

      const activeAnimals = animals.filter(a => a.statut === 'actif');
      const canins = activeAnimals.filter(a => a.espece === 'canin').length;
      const felins = activeAnimals.filter(a => a.espece === 'felin').length;

      // Calcul conformité
      const alerts = [];
      const expiredReminders = reminders.filter(r => r.isExpired);
      const upcomingReminders = reminders.filter(r => !r.isExpired);

      if (expiredReminders.length > 0) {
        alerts.push({
          icon: '💉', type: 'red',
          title: `${expiredReminders.length} rappel(s) dépassé(s)`,
          desc: expiredReminders.map(r => `${r.animalNom}: ${r.titre}`).slice(0, 3).join(', ')
        });
      }

      if (upcomingReminders.length > 0) {
        alerts.push({
          icon: '⏰', type: 'orange',
          title: `${upcomingReminders.length} rappel(s) à venir`,
          desc: upcomingReminders.map(r => `${r.animalNom}: ${r.titre} (${Utils.formatDateShort(r.rappelDate)})`).slice(0, 3).join(', ')
        });
      }

      // Vérifier visite véto
      const allEntries = await DB.getAllHealthEntries(uid);
      const visites = allEntries.filter(e => e.type === 'visite_veto');
      const derniereVisite = visites.length > 0 ? (visites[0].date?.toDate ? visites[0].date.toDate() : new Date(visites[0].date)) : null;
      const seuilVisiteMois = activeAnimals.length >= 10 ? 6 : 12;
      if (!derniereVisite) {
        alerts.push({
          icon: '🏥', type: 'red',
          title: 'Aucune visite vétérinaire sanitaire',
          desc: 'Une visite est requise par la réglementation'
        });
      } else {
        const moisDepuisVisite = Utils.daysBetween(derniereVisite, new Date()) / 30;
        if (moisDepuisVisite > seuilVisiteMois) {
          alerts.push({
            icon: '🏥', type: 'red',
            title: 'Visite vétérinaire sanitaire due',
            desc: `Dernière visite : ${Utils.formatDate(derniereVisite)} (>${seuilVisiteMois} mois)`
          });
        } else if (moisDepuisVisite > (seuilVisiteMois - 1)) {
          alerts.push({
            icon: '🏥', type: 'orange',
            title: 'Visite vétérinaire bientôt due',
            desc: `Dernière visite : ${Utils.formatDate(derniereVisite)}`
          });
        }
      }

      // ---- Alertes reproduction Art. 26 ----
      const femellesActives = activeAnimals.filter(a =>
        a.sexe === 'femelle' && a.statutReproducteur === 'nonSterilise'
      );
      for (const femelle of femellesActives) {
        const healthFemelle = allEntries.filter(e => e.animalId === femelle.id);
        const reproAlertes = Utils.analyseReproduction(femelle, healthFemelle);
        reproAlertes.forEach(ra => {
          alerts.push({
            icon: ra.icon,
            type: ra.type,
            title: ra.titre,
            desc: ra.desc
          });
        });
      }

      // ---- Alertes autocontrôle ----
      try {
        const dernierControle = await Autocontrole.getDernierControle(uid);
        if (!dernierControle) {
          alerts.push({
            icon: '🔍', type: 'orange',
            title: 'Aucun autocontrôle réalisé',
            desc: 'L\'arrêté du 19 juin 2025 impose des autocontrôles réguliers'
          });
        } else {
          const dateControle = new Date(dernierControle.date);
          const joursDepuis = Utils.daysBetween(dateControle, new Date());
          if (joursDepuis > 90) {
            alerts.push({
              icon: '🔍', type: 'orange',
              title: 'Autocontrôle trimestriel recommandé',
              desc: `Dernier contrôle : ${Utils.formatDate(dateControle)} (il y a ${Math.round(joursDepuis)} jours)`
            });
          }
        }
      } catch (e) { console.warn('Erreur check autocontrôle', e); }

      // Vérifier snapshot semestriel
      const dernierSnapshot = snapshots.length > 0 ? (snapshots[0].date?.toDate ? snapshots[0].date.toDate() : new Date(snapshots[0].date)) : null;
      if (!dernierSnapshot || Utils.daysBetween(dernierSnapshot, new Date()) > 180) {
        alerts.push({
          icon: '📊', type: 'orange',
          title: 'Snapshot semestriel à générer',
          desc: dernierSnapshot ? `Dernier : ${Utils.formatDate(dernierSnapshot)}` : 'Aucun snapshot généré'
        });
      }

      // Conformité globale
      const hasRed = alerts.some(a => a.type === 'red');
      const hasOrange = alerts.some(a => a.type === 'orange');
      let conformity;
      if (hasRed) conformity = { class: 'conformity-red', icon: '🔴', label: 'Obligations non remplies' };
      else if (hasOrange) conformity = { class: 'conformity-orange', icon: '🟠', label: 'Alertes en attente' };
      else conformity = { class: 'conformity-green', icon: '🟢', label: 'Tout est conforme' };

      // Prochaines échéances
      const echeances = [];
      upcomingReminders.forEach(r => {
        echeances.push({
          date: r.rappelDate,
          label: `${Utils.TYPES_SANTE[r.type]?.icon || '📝'} ${r.titre}`,
          animal: r.animalNom,
          animalId: r.animalId
        });
      });
      echeances.sort((a, b) => a.date - b.date);

      // Render — vérifier que l'élément existe encore (navigation async)
      const dashEl = document.getElementById('dashboard-content');
      if (!dashEl) return;
      dashEl.innerHTML = `
        <!-- Bannière notifications -->
        ${typeof Notifications !== 'undefined' ? Notifications.renderPermissionBanner() : ''}

        <!-- Conformité globale -->
        <div class="conformity-indicator ${conformity.class} mb-2">
          ${conformity.icon} ${conformity.label}
        </div>

        <!-- Stats -->
        <div class="stat-grid mb-2">
          <div class="stat-card">
            <div class="stat-number">${activeAnimals.length}</div>
            <div class="stat-label">Animaux actifs</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${canins}</div>
            <div class="stat-label">🐕 Canins</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${felins}</div>
            <div class="stat-label">🐈 Félins</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${alerts.length}</div>
            <div class="stat-label">Alertes</div>
          </div>
        </div>

        <!-- Alertes -->
        ${alerts.length > 0 ? `
          <div class="section-title"><span class="section-icon">⚠️</span> Alertes</div>
          <div class="mb-2">
            ${alerts.map(alert => `
              <div class="alert-card mb-1" style="border-left: 3px solid var(--${alert.type === 'red' ? 'red' : 'orange'});">
                <div class="alert-icon">${alert.icon}</div>
                <div class="alert-content">
                  <div class="alert-title">${alert.title}</div>
                  <div class="alert-desc">${alert.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Prochaines échéances -->
        ${echeances.length > 0 ? `
          <div class="section-title"><span class="section-icon">📅</span> Prochaines échéances</div>
          <div class="mb-2">
            ${echeances.slice(0, 5).map(ech => `
              <div class="alert-card mb-1" onclick="UI.navigateTo('animal-detail', {id:'${ech.animalId}'})">
                <div class="alert-icon">📅</div>
                <div class="alert-content">
                  <div class="alert-title">${ech.label}</div>
                  <div class="alert-desc">${ech.animal} — ${Utils.formatDate(ech.date)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Raccourcis -->
        <div class="section-title"><span class="section-icon">⚡</span> Raccourcis</div>
        <div class="shortcut-grid mb-3">
          <button class="shortcut-btn" onclick="UI.navigateTo('animal-form')">
            <span class="shortcut-icon">🐾</span>
            + Animal
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('health-form')">
            <span class="shortcut-icon">📋</span>
            + Entrée
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('exports')">
            <span class="shortcut-icon">📄</span>
            Exporter PDF
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('registre')">
            <span class="shortcut-icon">📒</span>
            Registre E/S
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('autocontrole')">
            <span class="shortcut-icon">🔍</span>
            Autocontrôle
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('portees')">
            <span class="shortcut-icon">🍼</span>
            Portées
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('externes')">
            <span class="shortcut-icon">🔗</span>
            Externes
          </button>
          <button class="shortcut-btn" onclick="UI.navigateTo('calendrier')">
            <span class="shortcut-icon">📅</span>
            Calendrier
          </button>
        </div>
      `;

    } catch (err) {
      console.error('Erreur dashboard', err);
      const el = document.getElementById('dashboard-content');
      if (el) el.innerHTML = '<p class="text-center text-muted">Erreur de chargement du tableau de bord</p>';
    }
  }

  return { render };
})();
