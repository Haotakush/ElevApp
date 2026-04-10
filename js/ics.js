/**
 * ElevApp — Module Export ICS (iCalendar)
 * Génère un fichier .ics compatible Google Calendar, Apple Calendar, Outlook
 * Contenu : rappels sanitaires, mises bas prévues, prochaines chaleurs
 */

const ICS = (() => {
  'use strict';

  // ---- Helpers ----
  function toDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatIcsDate(date) {
    // Format YYYYMMDD pour événements "toute la journée"
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  function formatIcsDateTime(date) {
    // Format YYYYMMDDTHHmmssZ (UTC)
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsEscape(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  function uid(prefix, id) {
    return `${prefix}-${id}-${Date.now()}@elevapp`;
  }

  function makeVEvent({ uid: eventUid, summary, description, dateStart, dateEnd, alarm, allDay }) {
    const dtStart = allDay !== false
      ? `DTSTART;VALUE=DATE:${formatIcsDate(dateStart)}`
      : `DTSTART:${formatIcsDateTime(dateStart)}`;
    const dtEnd = dateEnd
      ? (allDay !== false
          ? `DTEND;VALUE=DATE:${formatIcsDate(dateEnd)}`
          : `DTEND:${formatIcsDateTime(dateEnd)}`)
      : null;

    let alarmBlock = '';
    if (alarm) {
      alarmBlock = `BEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:${icsEscape(summary)}\nEND:VALARM`;
    }

    const lines = [
      'BEGIN:VEVENT',
      `UID:${eventUid}`,
      `DTSTART${allDay !== false ? ';VALUE=DATE' : ''}:${allDay !== false ? formatIcsDate(dateStart) : formatIcsDateTime(dateStart)}`,
      dtEnd ? `DTEND${allDay !== false ? ';VALUE=DATE' : ''}:${allDay !== false ? formatIcsDate(dateEnd) : formatIcsDateTime(dateEnd)}` : null,
      `SUMMARY:${icsEscape(summary)}`,
      description ? `DESCRIPTION:${icsEscape(description)}` : null,
      alarmBlock || null,
      'END:VEVENT'
    ].filter(Boolean).join('\r\n');

    return lines;
  }

  // ---- Collecte des événements ----
  async function collectEvents(uid_user) {
    const events = [];

    try {
      // 1. Animaux + leurs entrées sanitaires (rappels)
      const animals = await DB.getAnimals(uid_user);
      const animalMap = {};
      animals.forEach(a => { animalMap[a.id] = a; });

      for (const animal of animals) {
        // Rappels sanitaires
        const healthEntries = await DB.getHealthEntries(uid_user, animal.id);
        for (const entry of healthEntries) {
          if (!entry.rappelDate) continue;
          const rappelDate = toDate(entry.rappelDate);
          if (!rappelDate) continue;

          const typeInfo = (Utils.TYPES_SANTE && Utils.TYPES_SANTE[entry.type]) || { label: entry.type || 'Rappel', icon: '⏰' };
          events.push({
            uid: uid('rappel', entry.id || Math.random()),
            summary: `${typeInfo.icon} Rappel ${typeInfo.label} — ${animal.nom}`,
            description: [
              entry.titre ? `Acte : ${entry.titre}` : null,
              entry.details ? `Détails : ${entry.details}` : null,
              entry.vetoNom ? `Vétérinaire : ${entry.vetoNom}` : null
            ].filter(Boolean).join('\n'),
            dateStart: rappelDate,
            allDay: true,
            alarm: true
          });
        }

        // Chaleurs : saillies + prédiction date mise bas + prochaine chaleur
        if (animal.sexe === 'femelle') {
          try {
            const chaleurs = await DB.getChaleurs(uid_user, animal.id);
            // Tri chronologique
            const sorted = [...chaleurs].sort((a, b) => {
              const da = toDate(a.date) || new Date(0);
              const db2 = toDate(b.date) || new Date(0);
              return da - db2;
            });

            // Prédiction prochaine chaleur (basée sur écart moyen)
            if (sorted.length >= 2) {
              let ecartTotal = 0, ecartCount = 0;
              for (let i = 1; i < sorted.length; i++) {
                const prev = toDate(sorted[i - 1].date);
                const curr = toDate(sorted[i].date);
                if (prev && curr) {
                  const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
                  if (days > 0) { ecartTotal += days; ecartCount++; }
                }
              }
              if (ecartCount > 0) {
                const ecartMoyen = Math.round(ecartTotal / ecartCount);
                const derniere = toDate(sorted[sorted.length - 1].date);
                if (derniere) {
                  const nextDate = new Date(derniere.getTime() + ecartMoyen * 24 * 60 * 60 * 1000);
                  if (nextDate > new Date()) {
                    events.push({
                      uid: uid('chaleur-pred', animal.id),
                      summary: `🌡️ Prochaine chaleur prévue — ${animal.nom}`,
                      description: `Prédiction basée sur un écart moyen de ${ecartMoyen} jours (${Math.round(ecartMoyen / 30.5 * 10) / 10} mois)`,
                      dateStart: nextDate,
                      allDay: true,
                      alarm: true
                    });
                  }
                }
              }
            }

            // Pour chaque chaleur avec saillie : date mise bas estimée
            for (const chaleur of sorted) {
              const saillie = chaleur.saillie || {};
              const dateS = toDate(saillie.date) || toDate(saillie.date2);
              if (!dateS) continue;
              if (chaleur.resultat === 'mise_bas') continue; // déjà eu lieu

              // Gestation : ~63 jours chien, ~65 jours chat
              const gestationDays = animal.espece === 'felin' ? 65 : 63;
              const estimMB = new Date(dateS.getTime() + gestationDays * 24 * 60 * 60 * 1000);
              if (estimMB > new Date()) {
                events.push({
                  uid: uid('mise-bas-estim', chaleur.id || Math.random()),
                  summary: `🍼 Mise bas estimée — ${animal.nom}`,
                  description: [
                    `Saillie : ${dateS.toLocaleDateString('fr-FR')}`,
                    saillie.pereNom ? `Père : ${saillie.pereNom}` : null,
                    `Gestation estimée : ${gestationDays} jours`
                  ].filter(Boolean).join('\n'),
                  dateStart: estimMB,
                  allDay: true,
                  alarm: true
                });
              }
            }
          } catch (_) { /* chaleurs non critiques */ }
        }
      }

      // 2. Portées en gestation : date mise bas estimée depuis Firestore
      try {
        const porteeSnap = await firebase.firestore()
          .collection('users').doc(uid_user).collection('portees').get();
        porteeSnap.docs.forEach(doc => {
          const p = { id: doc.id, ...doc.data() };
          if (p.statut !== 'gestation') return;
          const dateSaillie = toDate(p.dateSaillie);
          if (!dateSaillie) return;
          const mere = animalMap[p.mereId];
          const nomMere = mere ? mere.nom : 'Femelle';
          const gestationDays = (mere && mere.espece === 'felin') ? 65 : 63;
          const estimMB = new Date(dateSaillie.getTime() + gestationDays * 24 * 60 * 60 * 1000);
          if (estimMB > new Date()) {
            events.push({
              uid: uid('portee-mb', p.id),
              summary: `🍼 Mise bas estimée — ${nomMere}`,
              description: `Portée en cours — Saillie le ${dateSaillie.toLocaleDateString('fr-FR')}`,
              dateStart: estimMB,
              allDay: true,
              alarm: true
            });
          }
        });
      } catch (_) { /* portees non critiques */ }

    } catch (err) {
      console.error('ICS collectEvents error', err);
    }

    return events;
  }

  // ---- Génération du fichier .ics ----
  function buildIcsContent(events) {
    const header = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ElevApp//ElevApp v2//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:ElevApp — Mon Élevage',
      'X-WR-TIMEZONE:Europe/Paris'
    ].join('\r\n');

    const footer = 'END:VCALENDAR';
    const vevents = events.map(e => makeVEvent(e)).join('\r\n');

    return `${header}\r\n${vevents}\r\n${footer}`;
  }

  // ---- Déclenchement du téléchargement ----
  // Ouvre dans un nouvel onglet/fenêtre pour préserver l'app PWA en mode standalone.
  function downloadIcs(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWin = window.open(url, '_blank');
    if (!newWin) {
      // Fallback si les popups sont bloqués
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'elevapp-agenda.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---- Point d'entrée public ----
  async function exportAgenda() {
    const uid_user = Auth.getUid();
    if (!uid_user) { UI.toast('Vous devez être connecté', 'error'); return; }

    UI.toast('Préparation du fichier agenda...', 'info');

    try {
      const events = await collectEvents(uid_user);

      if (events.length === 0) {
        UI.toast('Aucun événement à exporter (aucun rappel, saillie ou chaleur futur)', 'info');
        return;
      }

      const content = buildIcsContent(events);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadIcs(content, `elevapp-agenda-${dateStr}.ics`);

      UI.toast(`${events.length} événement${events.length > 1 ? 's' : ''} exporté${events.length > 1 ? 's' : ''} !`, 'success');
    } catch (err) {
      console.error('Erreur export ICS', err);
      UI.toast('Erreur lors de la génération du fichier', 'error');
    }
  }

  return { exportAgenda };
})();
