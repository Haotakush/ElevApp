/**
 * ElevApp — Module Notifications navigateur
 * Rappels locaux via Notification API (pas de serveur requis)
 * Fonctionne sur Android PWA + iOS 16.4+ (ajouté à l'écran d'accueil)
 */

const Notifications = (() => {
  'use strict';

  let alreadyChecked = false;

  function isSupported() {
    return 'Notification' in window;
  }

  function isGranted() {
    return isSupported() && Notification.permission === 'granted';
  }

  // ---- Demande de permission (appelée par bouton utilisateur) ----
  function requestPermission() {
    if (!isSupported()) {
      UI.toast('Votre navigateur ne supporte pas les notifications', 'info');
      return;
    }
    if (Notification.permission === 'denied') {
      UI.toast('Notifications bloquées dans les paramètres du navigateur', 'info');
      return;
    }
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        UI.toast('🔔 Notifications activées !', 'success');
        checkReminders(true);
      } else {
        UI.toast('Notifications refusées', 'info');
      }
    });
  }

  // ---- Vérification quotidienne des rappels ----
  async function checkReminders(force = false) {
    if (!isGranted()) return;
    if (alreadyChecked && !force) return;

    const uid = Auth.getUid();
    if (!uid) return;

    // Vérifier si on a déjà notifié aujourd'hui (sauf si forcé)
    if (!force) {
      const lastCheck = localStorage.getItem('elevapp_notif_check');
      const today = new Date().toISOString().split('T')[0];
      if (lastCheck === today) { alreadyChecked = true; return; }
      localStorage.setItem('elevapp_notif_check', today);
    }

    alreadyChecked = true;

    try {
      const reminders = await DB.getUpcomingReminders(uid, 30);
      const now = new Date();

      const overdue = reminders.filter(r => {
        const d = r.rappelDate?.toDate ? r.rappelDate.toDate() : new Date(r.rappelDate);
        return d < now;
      });

      const soon = reminders.filter(r => {
        const d = r.rappelDate?.toDate ? r.rappelDate.toDate() : new Date(r.rappelDate);
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      });

      if (overdue.length > 0) {
        showNotification(
          '⏰ Rappels en retard',
          overdue.length === 1
            ? `${overdue[0].animalNom} — ${overdue[0].titre || overdue[0].type}`
            : `${overdue.length} rappels sanitaires en retard`,
          'elevapp-overdue'
        );
      }

      if (soon.length > 0) {
        showNotification(
          '📅 Rappels à venir (7 jours)',
          soon.length === 1
            ? `${soon[0].animalNom} — ${soon[0].titre || soon[0].type}`
            : `${soon.length} rappels dans les 7 prochains jours`,
          'elevapp-soon'
        );
      }

    } catch (e) {
      console.warn('Notifications check error', e);
    }
  }

  function showNotification(title, body, tag) {
    try {
      // Utiliser le Service Worker si disponible (marche en arrière-plan sur Android)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: 'img/icons/icon-192.png',
            badge: 'img/icons/icon-192.png',
            tag,
            requireInteraction: false
          });
        }).catch(() => {
          // Fallback: notification directe
          new Notification(title, { body, icon: 'img/icons/icon-192.png', tag });
        });
      } else {
        new Notification(title, { body, icon: 'img/icons/icon-192.png', tag });
      }
    } catch (e) {
      console.warn('Notification error', e);
    }
  }

  // ---- Bannière d'invitation à activer les notifications ----
  function renderPermissionBanner() {
    if (!isSupported()) return '';
    if (Notification.permission === 'granted') return '';
    if (Notification.permission === 'denied') return '';
    if (localStorage.getItem('elevapp_notif_dismissed')) return '';

    return `
      <div class="card mb-2" id="notif-banner" style="border-left:3px solid var(--blue);background:var(--bg-secondary);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.3rem;">🔔</span>
          <div style="flex:1;">
            <div style="font-size:0.85rem;font-weight:700;">Activer les rappels</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Notifications pour vos rappels vaccins, chaleurs et mises bas</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Notifications.requestPermission()">Activer</button>
          <button class="btn btn-secondary btn-sm" style="padding:6px 8px;" onclick="document.getElementById('notif-banner')?.remove();localStorage.setItem('elevapp_notif_dismissed','1')">✕</button>
        </div>
      </div>
    `;
  }

  return { requestPermission, checkReminders, renderPermissionBanner, isGranted };
})();
