/**
 * ElevApp — Module Authentification
 * Login, Register, Logout, Profil éleveur
 */

const Auth = (() => {
  'use strict';

  let currentUser = null;

  function getUser() { return currentUser; }
  function getUid() { return currentUser ? currentUser.uid : null; }

  // ---- Login ----
  function renderLogin() {
    UI.hideAppShell();
    UI.setContent(`
      <div class="login-container" style="min-height:calc(100dvh - 32px);">
        <div class="login-logo">🐾</div>
        <h1 class="login-title">ElevApp</h1>
        <p class="login-subtitle">Gestion d'élevage conforme</p>

        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input class="form-input" type="email" id="login-email" required placeholder="votre@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Mot de passe</label>
            <input class="form-input" type="password" id="login-password" required placeholder="••••••••" autocomplete="current-password">
          </div>
          <div class="form-error" id="login-error"></div>
          <button type="submit" class="btn btn-primary btn-block mt-2">Se connecter</button>
        </form>

        <div class="login-divider">ou</div>

        <button class="btn btn-google btn-block" id="google-login-btn">
          🔵 Connexion avec Google
        </button>

        <p class="login-switch">
          Pas encore de compte ? <a href="#" id="goto-register">S'inscrire</a>
        </p>
        <p class="login-switch" style="margin-top:8px;font-size:0.78rem;">
          <a href="#" id="goto-legal-login" style="color:var(--text-muted);">Mentions légales & Confidentialité</a>
        </p>
      </div>
    `);

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      errEl.classList.remove('visible');

      try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } catch (err) {
        errEl.textContent = getAuthErrorMessage(err.code);
        errEl.classList.add('visible');
      }
    });

    document.getElementById('google-login-btn').addEventListener('click', async () => {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
      } catch (err) {
        UI.toast(getAuthErrorMessage(err.code), 'error');
      }
    });

    document.getElementById('goto-register').addEventListener('click', (e) => {
      e.preventDefault();
      UI.navigateTo('register');
    });

    document.getElementById('goto-legal-login').addEventListener('click', (e) => {
      e.preventDefault();
      UI.navigateTo('legal');
    });
  }

  // ---- Register ----
  function renderRegister() {
    UI.hideAppShell();
    UI.setContent(`
      <div class="login-container" style="min-height:calc(100dvh - 32px);">
        <div class="login-logo">🐾</div>
        <h1 class="login-title">Inscription</h1>
        <p class="login-subtitle">Créez votre compte éleveur</p>

        <form class="login-form" id="register-form">
          <div class="form-group">
            <label class="form-label" for="reg-name">Nom complet <span class="required">*</span></label>
            <input class="form-input" type="text" id="reg-name" required placeholder="Jean Dupont">
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email <span class="required">*</span></label>
            <input class="form-input" type="email" id="reg-email" required placeholder="votre@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Mot de passe <span class="required">*</span></label>
            <input class="form-input" type="password" id="reg-password" required placeholder="Min. 6 caractères" autocomplete="new-password" minlength="6">
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password2">Confirmer le mot de passe <span class="required">*</span></label>
            <input class="form-input" type="password" id="reg-password2" required placeholder="••••••••" autocomplete="new-password">
          </div>
          <!-- Consentement RGPD -->
          <div class="form-group" style="margin-top:12px;">
            <label class="form-toggle">
              <input type="checkbox" id="reg-rgpd" required>
              <span style="font-size:0.82rem;line-height:1.4;">
                J'accepte la <a href="#" id="rgpd-link" style="color:var(--primary);text-decoration:underline;">politique de confidentialité</a>
                et le traitement de mes données conformément au RGPD. <span class="required">*</span>
              </span>
            </label>
          </div>

          <div class="form-error" id="register-error"></div>
          <button type="submit" class="btn btn-primary btn-block mt-2">Créer mon compte</button>
        </form>

        <p class="login-switch">
          Déjà un compte ? <a href="#" id="goto-login">Se connecter</a>
        </p>
      </div>
    `);

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const password2 = document.getElementById('reg-password2').value;
      const errEl = document.getElementById('register-error');
      errEl.classList.remove('visible');

      if (password !== password2) {
        errEl.textContent = 'Les mots de passe ne correspondent pas';
        errEl.classList.add('visible');
        return;
      }

      const rgpdChecked = document.getElementById('reg-rgpd').checked;
      if (!rgpdChecked) {
        errEl.textContent = 'Vous devez accepter la politique de confidentialité';
        errEl.classList.add('visible');
        return;
      }

      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        // Créer le profil dans Firestore
        await DB.setUserProfile(cred.user.uid, {
          nom: name,
          email: email,
          siret: '',
          adresse: '',
          plan: 'free',
          vetoSanitaire: { nom: '', adresse: '', telephone: '' },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          dernierSnapshot: null,
          rgpdConsentDate: firebase.firestore.FieldValue.serverTimestamp(),
          rgpdConsentVersion: '2026-03'
        });
        UI.toast('Compte créé avec succès !', 'success');
      } catch (err) {
        errEl.textContent = getAuthErrorMessage(err.code);
        errEl.classList.add('visible');
      }
    });

    document.getElementById('goto-login').addEventListener('click', (e) => {
      e.preventDefault();
      UI.navigateTo('login');
    });

    document.getElementById('rgpd-link').addEventListener('click', (e) => {
      e.preventDefault();
      UI.navigateTo('legal');
    });
  }

  // ---- Profil ----
  async function renderProfile() {
    UI.setContent(`
      ${UI.pageHeader('Mon profil', 'dashboard')}
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `);

    const uid = getUid();
    let profile = await DB.getUserProfile(uid);
    if (!profile) {
      profile = {
        nom: currentUser.displayName || '',
        email: currentUser.email || '',
        siret: '', adresse: '',
        vetoSanitaire: { nom: '', adresse: '', telephone: '' }
      };
    }

    UI.setContent(`
      ${UI.pageHeader('Mon profil', 'dashboard')}
      <form id="profile-form">
        <div class="section-title">
          <span class="section-icon">👤</span> Informations éleveur
        </div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="prof-nom">Nom complet <span class="required">*</span></label>
            <input class="form-input" type="text" id="prof-nom" value="${Utils.escapeHtml(profile.nom)}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-email">Email</label>
            <input class="form-input" type="email" id="prof-email" value="${Utils.escapeHtml(profile.email)}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-adresse">Adresse de l'élevage</label>
            <textarea class="form-textarea" id="prof-adresse" rows="2" placeholder="Adresse complète">${Utils.escapeHtml(profile.adresse || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-siret">N° SIRET (optionnel)</label>
            <input class="form-input" type="text" id="prof-siret" value="${Utils.escapeHtml(profile.siret || '')}" placeholder="14 chiffres">
            <div class="form-error" id="siret-error">Format SIRET invalide (14 chiffres)</div>
          </div>
        </div>

        <div class="section-title mt-3">
          <span class="section-icon">🏥</span> Vétérinaire sanitaire
        </div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="prof-veto-nom">Nom du vétérinaire</label>
            <input class="form-input" type="text" id="prof-veto-nom" value="${Utils.escapeHtml(profile.vetoSanitaire?.nom || '')}" placeholder="Dr. Martin">
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-veto-adresse">Adresse du cabinet</label>
            <input class="form-input" type="text" id="prof-veto-adresse" value="${Utils.escapeHtml(profile.vetoSanitaire?.adresse || '')}" placeholder="Adresse complète">
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-veto-tel">Téléphone</label>
            <input class="form-input" type="tel" id="prof-veto-tel" value="${Utils.escapeHtml(profile.vetoSanitaire?.telephone || '')}" placeholder="06 12 34 56 78">
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">Enregistrer</button>
      </form>
    `);

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const siret = document.getElementById('prof-siret').value.trim();
      if (siret && !Utils.validateSIRET(siret)) {
        document.getElementById('siret-error').classList.add('visible');
        return;
      }
      document.getElementById('siret-error').classList.remove('visible');

      try {
        await DB.setUserProfile(uid, {
          nom: document.getElementById('prof-nom').value.trim(),
          adresse: document.getElementById('prof-adresse').value.trim(),
          siret: siret,
          vetoSanitaire: {
            nom: document.getElementById('prof-veto-nom').value.trim(),
            adresse: document.getElementById('prof-veto-adresse').value.trim(),
            telephone: document.getElementById('prof-veto-tel').value.trim()
          }
        });
        UI.toast('Profil mis à jour', 'success');
        UI.updateProfileButton(currentUser);
      } catch (err) {
        UI.toast('Erreur lors de la sauvegarde', 'error');
        console.error(err);
      }
    });
  }

  // ---- Logout ----
  async function logout() {
    try {
      await firebase.auth().signOut();
      UI.toast('Déconnexion réussie', 'success');
    } catch (err) {
      UI.toast('Erreur de déconnexion', 'error');
    }
  }

  // ---- Auth state change ----
  function onAuthStateChanged(user) {
    currentUser = user;
    if (user) {
      // Créer le profil si première connexion Google
      ensureProfile(user);
      UI.showAppShell();
      UI.updateProfileButton(user);
      UI.navigateTo('dashboard');
    } else {
      UI.hideAppShell();
      UI.navigateTo('login');
    }
  }

  async function ensureProfile(user) {
    const profile = await DB.getUserProfile(user.uid);
    if (!profile) {
      await DB.setUserProfile(user.uid, {
        nom: user.displayName || '',
        email: user.email || '',
        siret: '',
        adresse: '',
        plan: 'free',
        vetoSanitaire: { nom: '', adresse: '', telephone: '' },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        dernierSnapshot: null
      });
    }
  }

  // ---- Error messages ----
  function getAuthErrorMessage(code) {
    const messages = {
      'auth/user-not-found': 'Aucun compte trouvé avec cet email',
      'auth/wrong-password': 'Mot de passe incorrect',
      'auth/email-already-in-use': 'Un compte existe déjà avec cet email',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères',
      'auth/invalid-email': 'Email invalide',
      'auth/too-many-requests': 'Trop de tentatives, réessayez plus tard',
      'auth/popup-closed-by-user': 'Connexion annulée',
      'auth/network-request-failed': 'Erreur réseau, vérifiez votre connexion'
    };
    return messages[code] || 'Une erreur est survenue';
  }

  return {
    getUser, getUid, renderLogin, renderRegister, renderProfile,
    logout, onAuthStateChanged
  };
})();
