const Calendrier = (() => {
  'use strict';

  // Constants
  const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const EVENT_TYPES = {
    vaccin: '💉',
    traitement: '💊',
    visite_veto: '🏥',
    naissance: '🍼',
    vermifuge: '💉',
    antiparasitaire: '🛡️',
    autre: '📋'
  };

  // Module state
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();

  /**
   * Get icon for event type
   * @param {string} type - Event type
   * @returns {string} Emoji icon
   */
  function getEventIcon(type) {
    return EVENT_TYPES[type] || EVENT_TYPES.autre;
  }

  /**
   * Format date to French format: "Lun 16 Mars"
   * @param {Date} date - Date to format
   * @returns {string} Formatted date
   */
  function formatEventDate(date) {
    const dayName = DAYS_FR[date.getDay()];
    const dayNum = date.getDate();
    const monthName = MONTHS_FR[date.getMonth()];
    return `${dayName} ${dayNum} ${monthName}`;
  }

  /**
   * Parse date string (YYYY-MM-DD) to Date object
   * @param {string} dateString - Date string
   * @returns {Date} Date object (midnight UTC)
   */
  function parseDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Check if date is in the specified month/year
   * @param {Date} date - Date to check
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {boolean}
   */
  function isInMonth(date, month, year) {
    return date.getMonth() === month && date.getFullYear() === year;
  }

  /**
   * Check if date is expired (past)
   * @param {Date} date - Date to check
   * @returns {boolean}
   */
  function isExpired(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /**
   * Check if date is this week
   * @param {Date} date - Date to check
   * @returns {boolean}
   */
  function isThisWeek(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return date >= weekStart && date < weekEnd;
  }

  /**
   * Get color border style based on event date
   * @param {Date} date - Event date
   * @returns {string} Style attribute
   */
  function getEventStyle(date) {
    if (isExpired(date)) {
      return 'border-left: 3px solid var(--red)';
    } else if (isThisWeek(date)) {
      return 'border-left: 3px solid var(--orange)';
    } else {
      return 'border-left: 3px solid var(--green)';
    }
  }

  /**
   * Load health reminders from all animals
   * @param {string} uid - User ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Promise<Array>} Array of events
   */
  async function loadHealthReminders(uid, month, year) {
    const events = [];

    try {
      const animals = await DB.getAnimals(uid);

      for (const animal of animals) {
        const healthEntries = await DB.getHealthEntries(uid, animal.id);

        for (const entry of healthEntries) {
          if (entry.rappelDate) {
            const eventDate = parseDate(entry.rappelDate);
            if (eventDate && isInMonth(eventDate, month, year)) {
              events.push({
                date: eventDate,
                type: entry.type || 'autre',
                label: `${entry.type || 'Rappel'} — ${animal.nom}`,
                animalName: animal.nom,
                sortKey: eventDate.getTime()
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading health reminders:', error);
    }

    return events;
  }

  /**
   * Load expected births from portées in gestation
   * @param {string} uid - User ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Promise<Array>} Array of events
   */
  async function loadExpectedBirths(uid, month, year) {
    const events = [];

    try {
      const db = firebase.firestore();
      const porteeRef = db.collection('users').doc(uid).collection('portees');
      const snapshot = await porteeRef.where('statut', '==', 'gestation').get();

      snapshot.forEach((doc) => {
        const portee = doc.data();
        if (portee.datePrevue) {
          const eventDate = parseDate(portee.datePrevue);
          if (eventDate && isInMonth(eventDate, month, year)) {
            const motherName = portee.nomMere || 'Mère';
            const fatherName = portee.nomPere || 'Père';

            events.push({
              date: eventDate,
              type: 'naissance',
              label: `Naissance prévue — Portée ${motherName} x ${fatherName}`,
              sortKey: eventDate.getTime()
            });
          }
        }
      });
    } catch (error) {
      console.error('Error loading expected births:', error);
    }

    return events;
  }

  /**
   * Load all events from multiple sources
   * @param {string} uid - User ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Promise<Array>} Array of events sorted by date
   */
  async function loadEvents(uid, month, year) {
    const allEvents = [];

    try {
      const healthReminders = await loadHealthReminders(uid, month, year);
      const births = await loadExpectedBirths(uid, month, year);

      allEvents.push(...healthReminders);
      allEvents.push(...births);

      // Sort by date
      allEvents.sort((a, b) => a.sortKey - b.sortKey);
    } catch (error) {
      console.error('Error loading events:', error);
    }

    return allEvents;
  }

  /**
   * Group events by date
   * @param {Array} events - Array of events
   * @returns {Map} Map of date string to events array
   */
  function groupEventsByDate(events) {
    const grouped = new Map();

    events.forEach((event) => {
      const dateKey = event.date.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey).push(event);
    });

    return grouped;
  }

  /**
   * Render calendar view
   * @param {string} uid - User ID
   * @returns {Promise<string>} HTML content
   */
  async function render(uid) {
    try {
      const events = await loadEvents(uid, currentMonth, currentYear);
      const groupedEvents = groupEventsByDate(events);

      // Build HTML
      let html = `
        <div class="page-container">
          <!-- Header -->
          <div class="page-header">
            <button class="btn-back" onclick="Dashboard.render()">←</button>
            <h1>📅 Calendrier</h1>
          </div>

          <!-- Month Navigator -->
          <div class="month-navigator" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 1rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 8px;">
            <button class="btn-small" onclick="Calendrier.previousMonth()" style="padding: 0.5rem 1rem;">← Prev</button>
            <h2 style="margin: 0; font-size: 1.2rem;">${MONTHS_FR[currentMonth]} ${currentYear}</h2>
            <button class="btn-small" onclick="Calendrier.nextMonth()" style="padding: 0.5rem 1rem;">Next →</button>
          </div>

          <!-- Event Count -->
          <div class="event-summary" style="padding: 0 1rem 0.5rem 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            ${events.length} événement${events.length !== 1 ? 's' : ''}
          </div>

          <!-- Calendar Events -->
          <div class="calendar-view" style="padding: 1rem;">
      `;

      // No events message
      if (events.length === 0) {
        html += `
            <div class="empty-state" style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
              Aucun événement ce mois-ci
            </div>
        `;
      } else {
        // Group and display events by date
        const sortedDates = Array.from(groupedEvents.keys()).sort();

        sortedDates.forEach((dateKey) => {
          const dayEvents = groupedEvents.get(dateKey);
          const firstEvent = dayEvents[0];
          const formattedDate = formatEventDate(firstEvent.date);

          html += `
            <div class="calendar-day" style="margin-bottom: 1.5rem;">
              <div class="calendar-date" style="font-weight: bold; margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1rem;">
                ${formattedDate}
              </div>
              <div class="calendar-events" style="display: flex; flex-direction: column; gap: 0.5rem;">
          `;

          dayEvents.forEach((event) => {
            const icon = getEventIcon(event.type);
            const style = getEventStyle(event.date);

            html += `
              <div class="calendar-event" style="${style}; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; padding-left: 0.75rem;">
                <span style="font-weight: 500;">${icon} ${event.label}</span>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;

      return html;
    } catch (error) {
      console.error('Error rendering calendar:', error);
      return '<div class="error-message">Erreur lors du chargement du calendrier</div>';
    }
  }

  /**
   * Navigate to previous month
   */
  function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    App.render();
  }

  /**
   * Navigate to next month
   */
  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    App.render();
  }

  // Public API
  return {
    render,
    previousMonth,
    nextMonth
  };
})();
