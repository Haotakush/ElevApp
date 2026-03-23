/**
 * ElevApp — Point d'entrée principal
 * Init Firebase, routing, auth state, PWA
 */

(function () {
  'use strict';

  // ============================================
  // CONFIGURATION FIREBASE
  // ⚠️ Remplacez ces valeurs par votre config Firebase
  // ============================================
  const firebaseConfig = {
    apiKey: "AIzaSyC4JxmFmmQPMrCHgNrldhJcKnuvnfH_NNA",
    authDomain: "elevapp-6582c.firebaseapp.com",
    projectId: "elevapp-6582c",
    storageBucket: "elevapp-6582c.firebasestorage.app",
    messagingSenderId: "687096381026",
    appId: "1:687096381026:web:f016f82feac7c302b75b3b"
  };

  // ---- Init Firebase ----
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const storage = firebase.storage();

  // ---- Init modules ----
  DB.init(db, storage);
  Portees.init(db);
  UI.loadTheme();
  UI.initEvents();

  // ---- Auth state listener ----
  firebase.auth().onAuthStateChanged((user) => {
    Auth.onAuthStateChanged(user);
  });

  // ---- Service Worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker enregistré :', registration.scope);

        // Détecte un nouveau SW en attente et affiche la bannière
        function checkForWaiting(reg) {
          if (reg.waiting) {
            showUpdateBanner(reg.waiting);
          }
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });

        // Cas où le SW est déjà en waiting au chargement (ex: onglet rouvert)
        checkForWaiting(registration);

        // Recharger automatiquement après que le nouveau SW prend le contrôle
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

      } catch (err) {
        console.error('Erreur Service Worker :', err);
      }
    });
  }

  function showUpdateBanner(worker) {
    // Évite d'afficher plusieurs fois
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
      position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
      background: #1B5E20; color: #fff; padding: 12px 16px;
      border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex; align-items: center; gap: 12px;
      z-index: 9999; font-family: var(--font); font-size: 0.88rem;
      max-width: 320px; width: calc(100% - 32px);
    `;
    banner.innerHTML = `
      <span>🆕 Nouvelle version disponible !</span>
      <button id="update-btn" style="background:#fff;color:#1B5E20;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
        Mettre à jour
      </button>
    `;
    document.body.appendChild(banner);

    document.getElementById('update-btn').addEventListener('click', () => {
      banner.remove();
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  // ---- PWA Install Prompt ----
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    // Vérifier si déjà installé ou déjà refusé
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('elevapp_install_dismissed')) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.style.cssText = `
      position: fixed; bottom: 80px; left: 12px; right: 12px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 14px 16px;
      box-shadow: var(--shadow-lg); z-index: 300;
      display: flex; align-items: center; gap: 12px;
    `;
    banner.innerHTML = `
      <span style="font-size:1.5rem;">📲</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:0.9rem;">Installer ElevApp</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">Accès rapide même hors-ligne</div>
      </div>
      <button class="btn btn-primary btn-sm" id="install-accept">Installer</button>
      <button class="btn btn-secondary btn-sm" id="install-dismiss" style="padding:8px;">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('install-accept').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          UI.toast('Application installée !', 'success');
        }
        deferredPrompt = null;
      }
      banner.remove();
    });

    document.getElementById('install-dismiss').addEventListener('click', () => {
      localStorage.setItem('elevapp_install_dismissed', '1');
      banner.remove();
    });
  }

  // ---- Background sync check ----
  setInterval(() => {
    if (navigator.onLine) {
      DB.processQueue();
    }
  }, 30000); // Toutes les 30 secondes

})();
