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

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              UI.toast('Mise à jour disponible, rechargez la page', 'info', 5000);
            }
          });
        });
      } catch (err) {
        console.error('Erreur Service Worker :', err);
      }
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
