/**
 * ElevApp — Module Calendrier
 * Vue mensuelle des rappels, échéances et naissances prévues
 */

const Calendrier = (() => {
  'use strict';

  const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();

  // ---- Helpers ----
  function toDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function isInMonth(date, month, year) {
    return date && date.getMonth() === month && date.getFullYear() === year;
  }

  function formatDayLabel(date) {
    return `${DAYS_FR[date.getDay()]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]}`;
  }

  function isExpired(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  function isThisWeek(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    return date >= today && date < weekEnd;
  }

  function eventBorderColor(date) {
    if (isExpired(date)) return 'var(--red)';
    if (isThisWeek(date)) return 'var(--orange)';
    return 'var(--green)';
  }

  // ---- Render ----
  async function render() {
    UI.setContent(`
      ${UI.pageHeader('📅 Calendrier', 'dashboard')}

      <!-- Navigation mois -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;margin-bottom:12px;">
        <button class="btn btn-secondary btn-sm" id="cal-prev">← Préc.</button>
        <h2 style="margin:0;font-size:1.1rem;font-weight:700;" id="cal-month-label">${MONTHS_FR[currentMonth]} ${currentYear}</h2>
        <button class="btn btn-secondary btn-sm" id="cal-next">Suiv. →</button>
      </div>

      <div id="cal-events">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    // Events boutons navigation
    document.getElementById('cal-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });

    await loadEvents();
  }

  async function loadEvents() {
    const uid = Auth.getUid();
    const container = document.getElementById('cal-events');
    if (!uid || !container) return;

    try {
      const events = [];

      // 1. Rappels sanitaires (depuis tous les animaux)
      const allEntries = await DB.getAllHealthEntries(uid);
      for (const entry of allEntries) {
        const rappelDate = toDate(entry.rappelDate);
        if (rappelDate && isInMonth(rappelDate, currentMonth, currentYear)) {
          const typeInfo = Utils.TYPES_SANTE[entry.type] || { icon: '📝', label: entry.type };
          events.push({
            date: rappelDate,
            icon: typeInfo.icon,
            label: `${typeInfo.label} — ${entry.animalNom || '?'}`,
            sublabel: entry.titre || '',
            animalId: entry.animalId
          });
        }
      }

      // 2. Naissances prévues (portées en gestation) — filtrage côté client, pas de .where()
      const animals = await DB.getAnimals(uid);
      const animalsMap = {};
      animals.forEach(a => { animalsMap[a.id] = a; });

      const porteesSnapshot = await firebase.firestore()
        .collection('users').doc(uid).collection('portees').get();
      const portees = porteesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const portee of portees) {
        if (portee.statut !== 'gestation') continue;
        const datePrevue = toDate(portee.datePrevue);
        if (datePrevue && isInMonth(datePrevue, currentMonth, currentYear)) {
          const mere = animalsMap[portee.mereId];
          const mereNom = mere ? mere.nom : '?';
          events.push({
            date: datePrevue,
            icon: '🍼',
            label: `Naissance prévue — ${mereNom}`,
            sublabel: portee.notes ? portee.notes.substring(0, 60) : '',
            animalId: portee.mereId
          });
        }
      }

      // Tri par date
      events.sort((a, b) => a.date - b.date);

      // Regrouper par jour
      const grouped = new Map();
      events.forEach(evt => {
        const key = evt.date.toISOString().split('T')[0];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(evt);
      });

      // Vérifier que le container existe encore (navigation async)
      if (!document.getElementById('cal-events')) return;

      // Render
      if (events.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <div class="empty-title">Aucun événement ce mois-ci</div>
            <div class="empty-desc">Les rappels vaccins, traitements et naissances prévues apparaîtront ici</div>
          </div>
        `;
        return;
      }

      let html = `<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">${events.length} événement${events.length > 1 ? 's' : ''}</div>`;

      const sortedKeys = Array.from(grouped.keys()).sort();
      for (const key of sortedKeys) {
        const dayEvents = grouped.get(key);
        const dayLabel = formatDayLabel(dayEvents[0].date);

        html += `<div style="margin-bottom:16px;">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px;">${dayLabel}</div>`;

        for (const evt of dayEvents) {
          const borderColor = eventBorderColor(evt.date);
          const clickAttr = evt.animalId ? `onclick="UI.navigateTo('animal-detail', {id:'${evt.animalId}'})"` : '';

          html += `
            <div class="card mb-1" style="border-left:3px solid ${borderColor};cursor:${evt.animalId ? 'pointer' : 'default'};" ${clickAttr}>
              <div style="font-weight:600;font-size:0.85rem;">${evt.icon} ${Utils.escapeHtml(evt.label)}</div>
              ${evt.sublabel ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${Utils.escapeHtml(evt.sublabel)}</div>` : ''}
              ${isExpired(evt.date) ? '<div style="font-size:0.75rem;color:var(--red);margin-top:2px;">⚠️ Dépassé</div>' : ''}
            </div>
          `;
        }
        html += '</div>';
      }

      container.innerHTML = html;

    } catch (err) {
      console.error('Erreur calendrier', err);
      if (container) {
        container.innerHTML = '<p class="text-center text-muted">Erreur de chargement du calendrier</p>';
      }
    }
  }

  return { render };
})();
