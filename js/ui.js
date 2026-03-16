/**
 * ElevApp — Module UI
 * Navigation, modals, toasts, helpers UI
 */

const UI = (() => {
  'use strict';

  let currentPage = 'dashboard';

  // ---- Toast ----
  function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ---- Modal ----
  function openModal(contentHtml, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    body.innerHTML = contentHtml;
    overlay.classList.add('active');

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    if (options.onOpen) options.onOpen(body);
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    setTimeout(() => {
      document.getElementById('modal-body').innerHTML = '';
    }, 300);
  }

  function confirmModal(message, onConfirm) {
    const html = `
      <h3 class="modal-title">${message}</h3>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-danger" id="confirm-action-btn">Confirmer</button>
      </div>
    `;
    openModal(html, {
      onOpen: () => {
        document.getElementById('confirm-action-btn').addEventListener('click', () => {
          closeModal();
          onConfirm();
        });
      }
    });
  }

  // ---- Navigation ----
  function navigateTo(page, params = {}) {
    currentPage = page;
    updateNavActive(page);
    updateFab(page);

    const content = document.getElementById('app-content');
    content.innerHTML = '<div class="container"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>';

    // Dispatch page render
    switch (page) {
      case 'login': Auth.renderLogin(); break;
      case 'register': Auth.renderRegister(); break;
      case 'profile': Auth.renderProfile(); break;
      case 'dashboard': Dashboard.render(); break;
      case 'animals': Animals.renderList(); break;
      case 'animal-detail': Animals.renderDetail(params.id); break;
      case 'animal-form': Animals.renderForm(params.id); break;
      case 'health': Health.renderJournal(); break;
      case 'health-form': Health.renderForm(params.animalId, params.entryId, params.type); break;
      case 'exports': Exports.render(); break;
      case 'conformite': Conformite.render(); break;
      case 'cession-form': Cession.renderForm(params.animalId); break;
      case 'portees': Portees.renderList(); break;
      case 'portee-detail': Portees.renderDetail(params.id); break;
      case 'portee-form': Portees.renderForm(params.id); break;
      case 'registre': Registre.render(); break;
      case 'autocontrole': Autocontrole.render(); break;
      case 'autocontrole-detail': Autocontrole.renderDetail(params.id); break;
      case 'externes': Externes.renderList(); break;
      case 'externe-detail': Externes.renderDetail(params.id); break;
      case 'externe-form': Externes.renderForm(params.id); break;
      case 'calendrier': Calendrier.render(); break;
      case 'legal': Legal.render(); break;
      default: Dashboard.render();
    }

    // Scroll to top
    window.scrollTo(0, 0);
  }

  function getCurrentPage() { return currentPage; }

  function updateNavActive(page) {
    const navItems = document.querySelectorAll('.nav-item');
    const basePages = {
      'dashboard': 'dashboard',
      'animals': 'animals', 'animal-detail': 'animals', 'animal-form': 'animals',
      'conformite': 'conformite',
      'portees': 'portees', 'portee-detail': 'portees', 'portee-form': 'portees'
    };
    // Pages accessibles via le menu "Plus"
    const morePages = ['health', 'health-form', 'exports', 'calendrier', 'externes', 'externe-detail', 'externe-form', 'registre', 'autocontrole', 'autocontrole-detail', 'cession-form'];
    const activeNav = basePages[page] || (morePages.includes(page) ? 'more' : '');
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.page === activeNav);
    });
    // Fermer le menu "Plus" si on navigue
    closeMoreMenu();
  }

  function openMoreMenu() {
    const overlay = document.getElementById('more-menu-overlay');
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  function closeMoreMenu() {
    const overlay = document.getElementById('more-menu-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
  }

  function updateFab(page) {
    const fab = document.getElementById('fab-btn');
    const showFabPages = ['animals', 'health', 'portees', 'externes'];
    fab.style.display = showFabPages.includes(page) ? 'flex' : 'none';
  }

  // ---- Auth state UI ----
  function showAppShell() {
    document.getElementById('app-header').style.display = 'flex';
    document.getElementById('app-nav').style.display = 'flex';
  }

  function hideAppShell() {
    document.getElementById('app-header').style.display = 'none';
    document.getElementById('app-nav').style.display = 'none';
    document.getElementById('fab-btn').style.display = 'none';
  }

  function updateProfileButton(user) {
    const btn = document.getElementById('profile-btn');
    if (user && user.displayName) {
      btn.textContent = user.displayName.charAt(0).toUpperCase();
    } else if (user && user.email) {
      btn.textContent = user.email.charAt(0).toUpperCase();
    } else {
      btn.textContent = '?';
    }
  }

  // ---- Skeleton Loading ----
  function showSkeleton(container, count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<div class="skeleton skeleton-card"></div>';
    }
    container.innerHTML = html;
  }

  // ---- Select options builder ----
  function buildOptions(options, selectedValue = '', placeholder = '') {
    let html = placeholder ? `<option value="">${placeholder}</option>` : '';
    for (const [value, label] of Object.entries(options)) {
      html += `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${label}</option>`;
    }
    return html;
  }

  // ---- Render helper ----
  function setContent(html) {
    document.getElementById('app-content').innerHTML = `<div class="container">${html}</div>`;
  }

  // ---- Page header with back button ----
  function pageHeader(title, backPage = null, backParams = {}) {
    const back = backPage
      ? `<button class="back-btn" onclick="UI.navigateTo('${backPage}'${Object.keys(backParams).length ? ", " + JSON.stringify(backParams).replace(/"/g, "'") : ''})">←</button>`
      : '';
    return `<div class="page-header">${back}<h1 class="page-title">${title}</h1></div>`;
  }

  // ---- Init UI events ----
  function initEvents() {
    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    // FAB
    document.getElementById('fab-btn').addEventListener('click', () => {
      if (currentPage === 'animals') navigateTo('animal-form');
      else if (currentPage === 'health') navigateTo('health-form');
      else if (currentPage === 'portees') navigateTo('portee-form');
      else if (currentPage === 'externes') navigateTo('externe-form');
    });

    // Menu "Plus"
    document.getElementById('nav-more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const overlay = document.getElementById('more-menu-overlay');
      if (overlay.classList.contains('active')) {
        closeMoreMenu();
      } else {
        openMoreMenu();
      }
    });

    // Items du menu "Plus"
    document.querySelectorAll('.more-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        closeMoreMenu();
        navigateTo(item.dataset.page);
      });
    });

    // Fermer menu "Plus" sur clic extérieur
    document.getElementById('more-menu-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'more-menu-overlay') closeMoreMenu();
    });

    // Profile button
    document.getElementById('profile-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('profile-dropdown').classList.toggle('active');
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      document.getElementById('profile-dropdown').classList.remove('active');
    });

    // Profile dropdown actions
    document.querySelectorAll('.profile-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        document.getElementById('profile-dropdown').classList.remove('active');
        switch (action) {
          case 'profile': navigateTo('profile'); break;
          case 'legal': navigateTo('legal'); break;
          case 'dark-mode': toggleDarkMode(); break;
          case 'logout': Auth.logout(); break;
        }
      });
    });

    // Offline indicator
    window.addEventListener('online', () => {
      document.getElementById('offline-indicator').classList.remove('visible');
      toast('Connexion restaurée', 'success');
    });
    window.addEventListener('offline', () => {
      document.getElementById('offline-indicator').classList.add('visible');
      toast('Mode hors-ligne', 'warning');
    });
    if (!navigator.onLine) {
      document.getElementById('offline-indicator').classList.add('visible');
    }
  }

  // ---- Dark Mode ----
  function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('elevapp_theme', isDark ? 'light' : 'dark');
    // Update button label
    const btn = document.querySelector('[data-action="dark-mode"]');
    if (btn) btn.innerHTML = isDark ? '<span>🌙</span> Mode sombre' : '<span>☀️</span> Mode clair';
  }

  function loadTheme() {
    const saved = localStorage.getItem('elevapp_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  return {
    toast, openModal, closeModal, confirmModal,
    navigateTo, getCurrentPage,
    showAppShell, hideAppShell, updateProfileButton,
    showSkeleton, buildOptions, setContent, pageHeader,
    initEvents, loadTheme, toggleDarkMode
  };
})();
