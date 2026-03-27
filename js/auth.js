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
            <input class="form-input" type="password" id="reg-password" required placeholder="Min. 8 caractères" autocomplete="new-password" minlength="8">
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
          affixe: '',
          statutJuridique: '',
          regimeTVA: '',
          regimeFiscal: '',
          telephone: '',
          especeElevee: '',
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
          <span class="section-icon">🐾</span> Type d'élevage
        </div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="prof-espece">Espèce élevée</label>
            <select class="form-input" id="prof-espece">
              <option value="">Choisir...</option>
              <option value="canin" ${profile.especeElevee === 'canin' ? 'selected' : ''}>Canin — Chiens uniquement</option>
              <option value="felin" ${profile.especeElevee === 'felin' ? 'selected' : ''}>Félin — Chats uniquement</option>
              <option value="les_deux" ${profile.especeElevee === 'les_deux' ? 'selected' : ''}>Canin & Félin</option>
            </select>
          </div>
        </div>

        <div class="section-title mt-3">
          <span class="section-icon">🏢</span> Informations entreprise
        </div>
        <div class="card mb-2">
          <div class="form-group">
            <label class="form-label" for="prof-affixe">Affixe de l'élevage (optionnel)</label>
            <input class="form-input" type="text" id="prof-affixe" value="${Utils.escapeHtml(profile.affixe || '')}" placeholder="Nom d'affixe enregistré">
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-statut-juridique">Statut juridique</label>
            <select class="form-input" id="prof-statut-juridique">
              <option value="">Choisir...</option>
              <option value="micro-entreprise" ${profile.statutJuridique === 'micro-entreprise' ? 'selected' : ''}>Micro-entreprise</option>
              <option value="ei" ${profile.statutJuridique === 'ei' ? 'selected' : ''}>Entreprise individuelle</option>
              <option value="earl" ${profile.statutJuridique === 'earl' ? 'selected' : ''}>EARL</option>
              <option value="scea" ${profile.statutJuridique === 'scea' ? 'selected' : ''}>SCEA</option>
              <option value="sarl" ${profile.statutJuridique === 'sarl' ? 'selected' : ''}>SARL</option>
              <option value="sas" ${profile.statutJuridique === 'sas' ? 'selected' : ''}>SAS</option>
              <option value="association" ${profile.statutJuridique === 'association' ? 'selected' : ''}>Association</option>
              <option value="autre" ${profile.statutJuridique === 'autre' ? 'selected' : ''}>Autre</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-regime-tva">Régime de TVA</label>
            <select class="form-input" id="prof-regime-tva">
              <option value="">Choisir...</option>
              <option value="franchise" ${profile.regimeTVA === 'franchise' ? 'selected' : ''}>Franchise en base de TVA</option>
              <option value="reel_simplifie" ${profile.regimeTVA === 'reel_simplifie' ? 'selected' : ''}>TVA au réel simplifié</option>
              <option value="reel_normal" ${profile.regimeTVA === 'reel_normal' ? 'selected' : ''}>TVA au réel normal</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-regime-fiscal">Régime fiscal (bénéfices)</label>
            <select class="form-input" id="prof-regime-fiscal">
              <option value="">Choisir...</option>
              <option value="micro_bic" ${profile.regimeFiscal === 'micro_bic' ? 'selected' : ''}>Micro-BIC</option>
              <option value="micro_ba" ${profile.regimeFiscal === 'micro_ba' ? 'selected' : ''}>Micro-BA (agricole)</option>
              <option value="reel_simplifie" ${profile.regimeFiscal === 'reel_simplifie' ? 'selected' : ''}>Réel simplifié</option>
              <option value="reel_normal" ${profile.regimeFiscal === 'reel_normal' ? 'selected' : ''}>Réel normal</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-telephone">Numéro de téléphone</label>
            <input class="form-input" type="tel" id="prof-telephone" value="${Utils.escapeHtml(profile.telephone || '')}" placeholder="06 12 34 56 78">
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

      <!-- Zone danger -->
      <div class="section-title mt-3" style="color:var(--danger);">
        <span class="section-icon">⚠️</span> Zone de danger
      </div>
      <div class="card mb-4" style="border-color:var(--danger);border-width:1.5px;">
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
          La suppression de votre compte est <strong>irréversible</strong>. Toutes vos données (animaux, journal sanitaire, portées, autocontrôles) seront définitivement supprimées.
        </p>
        <button class="btn btn-danger btn-block" id="delete-account-btn">🗑️ Supprimer mon compte et mes données</button>
      </div>
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
          affixe: document.getElementById('prof-affixe').value.trim(),
          statutJuridique: document.getElementById('prof-statut-juridique').value,
          regimeTVA: document.getElementById('prof-regime-tva').value,
          regimeFiscal: document.getElementById('prof-regime-fiscal').value,
          telephone: document.getElementById('prof-telephone').value.trim(),
          especeElevee: document.getElementById('prof-espece').value,
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

    // ---- Bouton suppression de compte ----
    document.getElementById('delete-account-btn').addEventListener('click', () => {
      showDeleteAccountModal();
    });
  }

  // ---- Modale suppression de compte ----
  function showDeleteAccountModal() {
    const isGoogleUser = currentUser.providerData.some(p => p.providerId === 'google.com');

    UI.openModal(`
      <div style="padding:4px 0;">
        <h3 style="color:var(--danger);margin-bottom:8px;">⚠️ Supprimer mon compte</h3>
        <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:16px;">
          Cette action est <strong>irréversible</strong>. Toutes vos données seront définitivement effacées.
        </p>
        ${!isGoogleUser ? `
        <div class="form-group">
          <label class="form-label">Confirmez votre mot de passe</label>
          <input class="form-input" type="password" id="delete-confirm-password" placeholder="Votre mot de passe actuel" autocomplete="current-password">
        </div>
        ` : `
        <p style="font-size:0.85rem;background:var(--bg-page);padding:10px 12px;border-radius:8px;margin-bottom:12px;">
          Vous serez redirigé vers Google pour confirmer votre identité.
        </p>
        `}
        <div class="form-error" id="delete-error"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn btn-secondary" style="flex:1;" id="delete-cancel-btn">Annuler</button>
          <button class="btn btn-danger" style="flex:1;" id="delete-confirm-btn">Confirmer la suppression</button>
        </div>
      </div>
    `);

    document.getElementById('delete-cancel-btn').addEventListener('click', () => UI.hideModal());

    document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('delete-error');
      const confirmBtn = document.getElementById('delete-confirm-btn');
      errEl.classList.remove('visible');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Suppression en cours...';

      try {
        // 1. Ré-authentification selon le fournisseur
        if (isGoogleUser) {
          const provider = new firebase.auth.GoogleAuthProvider();
          await firebase.auth().currentUser.reauthenticateWithPopup(provider);
        } else {
          const password = document.getElementById('delete-confirm-password').value;
          if (!password) {
            errEl.textContent = 'Veuillez saisir votre mot de passe';
            errEl.classList.add('visible');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirmer la suppression';
            return;
          }
          const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
          await firebase.auth().currentUser.reauthenticateWithCredential(credential);
        }

        // 2. Suppression des données Firestore
        await deleteAllUserData(currentUser.uid);

        // 3. Suppression du compte Firebase Auth
        await firebase.auth().currentUser.delete();

        // 4. Nettoyage local
        if (typeof AppCache !== 'undefined') AppCache.clear();
        localStorage.removeItem('elevapp_offline_queue');

        UI.closeModal();
        UI.toast('Compte supprimé. À bientôt !', 'success');

      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmer la suppression';
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errEl.textContent = 'Mot de passe incorrect';
        } else if (err.code === 'auth/too-many-requests') {
          errEl.textContent = 'Trop de tentatives. Réessayez plus tard.';
        } else if (err.code === 'auth/popup-closed-by-user') {
          errEl.textContent = 'Confirmation annulée';
        } else {
          errEl.textContent = 'Erreur : ' + (err.message || 'Réessayez plus tard');
          console.error('Erreur suppression compte', err);
        }
        errEl.classList.add('visible');
      }
    });
  }

  // ---- Suppression complète des données Firestore ----
  async function deleteAllUserData(uid) {
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(uid);

    // Supprimer les sous-collections de chaque animal (health + chaleurs)
    const animalsSnap = await userRef.collection('animals').get();
    for (const animalDoc of animalsSnap.docs) {
      const animalRef = animalDoc.ref;

      const healthSnap = await animalRef.collection('health').get();
      const batch1 = db.batch();
      healthSnap.docs.forEach(d => batch1.delete(d.ref));
      if (healthSnap.docs.length > 0) await batch1.commit();

      const chaleursSnap = await animalRef.collection('chaleurs').get();
      const batch2 = db.batch();
      chaleursSnap.docs.forEach(d => batch2.delete(d.ref));
      if (chaleursSnap.docs.length > 0) await batch2.commit();

      await animalRef.delete();
    }

    // Supprimer les snapshots (autocontrôles)
    const snapshotsSnap = await userRef.collection('snapshots').get();
    const batchSnap = db.batch();
    snapshotsSnap.docs.forEach(d => batchSnap.delete(d.ref));
    if (snapshotsSnap.docs.length > 0) await batchSnap.commit();

    // Supprimer les portées
    const porteesSnap = await userRef.collection('portees').get();
    const batchPortees = db.batch();
    porteesSnap.docs.forEach(d => batchPortees.delete(d.ref));
    if (porteesSnap.docs.length > 0) await batchPortees.commit();

    // Supprimer les animaux externes
    const externesSnap = await userRef.collection('externes').get();
    const batchExternes = db.batch();
    externesSnap.docs.forEach(d => batchExternes.delete(d.ref));
    if (externesSnap.docs.length > 0) await batchExternes.commit();

    // Supprimer le document utilisateur principal
    await userRef.delete();
  }

  // ---- Logout ----
  async function logout() {
    try {
      await firebase.auth().signOut();
      if (typeof AppCache !== 'undefined') AppCache.clear();
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
      // Afficher le changelog si nouvelle version (ou onboarding si premier lancement)
      setTimeout(() => {
        if (typeof Onboarding !== 'undefined' && !localStorage.getItem('elevapp_onboarding_done')) {
          Onboarding.checkAndShow();
        } else {
          Changelog.checkAndShow();
        }
      }, 800);
      // Vérifier rappels (notifications navigateur)
      setTimeout(() => {
        if (typeof Notifications !== 'undefined') Notifications.checkReminders();
      }, 2500);
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
        affixe: '',
        statutJuridique: '',
        regimeTVA: '',
        telephone: '',
        especeElevee: '',
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
      // ⚠️ Ne pas distinguer user-not-found et wrong-password pour éviter l'énumération de comptes
      'auth/user-not-found': 'Email ou mot de passe incorrect',
      'auth/wrong-password': 'Email ou mot de passe incorrect',
      'auth/invalid-credential': 'Email ou mot de passe incorrect',
      'auth/email-already-in-use': 'Un compte existe déjà avec cet email',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 8 caractères',
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
