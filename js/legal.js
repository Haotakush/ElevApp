/**
 * ElevApp — Module Mentions Légales & Politique de Confidentialité
 * Conformité RGPD (Règlement UE 2016/679)
 */

const Legal = (() => {
  'use strict';

  function render() {
    UI.setContent(`
      ${UI.pageHeader('Mentions légales & CGU', 'dashboard')}

      <!-- Liens vers les documents complets -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
        <a href="mentions-legales.html" target="_blank" style="text-decoration:none;">
          <div class="card" style="text-align:center;padding:16px 12px;border:2px solid var(--accent-light,#fcebd8);">
            <div style="font-size:1.5rem;margin-bottom:6px;">📜</div>
            <div style="font-size:0.82rem;font-weight:700;color:var(--text,#1a1a1a);">CGU & Mentions légales</div>
            <div style="font-size:0.75rem;color:var(--text-muted,#888);margin-top:4px;">Document complet</div>
          </div>
        </a>
        <a href="confidentialite.html" target="_blank" style="text-decoration:none;">
          <div class="card" style="text-align:center;padding:16px 12px;border:2px solid var(--accent-light,#fcebd8);">
            <div style="font-size:1.5rem;margin-bottom:6px;">🔒</div>
            <div style="font-size:0.82rem;font-weight:700;color:var(--text,#1a1a1a);">Politique de confidentialité</div>
            <div style="font-size:0.75rem;color:var(--text-muted,#888);margin-top:4px;">RGPD complet</div>
          </div>
        </a>
      </div>

      <!-- Éditeur de l'application -->
      <div class="section-title"><span class="section-icon">📱</span> Éditeur de l'application</div>
      <div class="card mb-2">
        <div class="info-row">
          <span class="info-label">Application</span>
          <span class="info-value">ElevApp — Gestion d'élevage</span>
        </div>
        <div class="info-row">
          <span class="info-label">Contact</span>
          <span class="info-value"><a href="mailto:eric.valencourt@gmail.com">eric.valencourt@gmail.com</a></span>
        </div>
        <div class="info-row">
          <span class="info-label">Hébergement</span>
          <span class="info-value">GitHub Pages (Microsoft) & Firebase (Google)</span>
        </div>
      </div>

      <!-- Politique de confidentialité -->
      <div class="section-title"><span class="section-icon">🔒</span> Politique de confidentialité</div>
      <div class="card mb-2">
        <p style="font-size:0.85rem;line-height:1.6;margin:0 0 12px 0;">
          ElevApp respecte la vie privée de ses utilisateurs et s'engage à protéger les données personnelles
          conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679)
          et à la loi Informatique et Libertés du 6 janvier 1978 modifiée.
        </p>
      </div>

      <!-- Données collectées -->
      <div class="section-title"><span class="section-icon">📋</span> Données collectées</div>
      <div class="card mb-2">
        <p style="font-size:0.85rem;font-weight:600;margin:0 0 8px 0;">Données du compte utilisateur :</p>
        <p style="font-size:0.82rem;line-height:1.5;margin:0 0 12px 0;">
          Nom, adresse email, adresse de l'élevage, numéro SIRET (optionnel),
          coordonnées du vétérinaire sanitaire.
        </p>

        <p style="font-size:0.85rem;font-weight:600;margin:0 0 8px 0;">Données des animaux :</p>
        <p style="font-size:0.82rem;line-height:1.5;margin:0 0 12px 0;">
          Nom, espèce, race, sexe, date de naissance, numéro d'identification (puce/tatouage),
          couleur de robe, statut reproducteur, photos, historique sanitaire
          (vaccins, traitements, visites vétérinaires, mises bas, etc.).
        </p>

        <p style="font-size:0.85rem;font-weight:600;margin:0 0 8px 0;">Données de cession :</p>
        <p style="font-size:0.82rem;line-height:1.5;margin:0 0 0 0;">
          Coordonnées de l'acquéreur (nom, adresse, téléphone, email), conditions de vente/don.
        </p>
      </div>

      <!-- Finalités -->
      <div class="section-title"><span class="section-icon">🎯</span> Finalités du traitement</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          Les données sont collectées et traitées exclusivement pour :
          la tenue du registre sanitaire d'élevage conformément à l'arrêté du 19 juin 2025,
          le suivi de la conformité réglementaire (reproduction, vaccinations, visites vétérinaires),
          la génération de documents obligatoires (registre PDF, certificats de cession, snapshots semestriels),
          et la gestion du compte utilisateur.
        </p>
      </div>

      <!-- Base légale -->
      <div class="section-title"><span class="section-icon">⚖️</span> Base légale</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          Le traitement des données repose sur le consentement de l'utilisateur (Art. 6.1.a RGPD)
          et sur l'obligation légale de tenue du registre sanitaire d'élevage (Art. 6.1.c RGPD,
          arrêté du 19 juin 2025, Code rural Art. L214-6).
        </p>
      </div>

      <!-- Hébergement et sécurité -->
      <div class="section-title"><span class="section-icon">🛡️</span> Hébergement et sécurité</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 8px 0;">
          Les données sont stockées sur les serveurs Google Firebase (Cloud Firestore et Firebase Storage).
          Google est certifié conforme au RGPD et les données peuvent être hébergées en Europe (région europe-west).
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 8px 0;">
          L'authentification est gérée par Firebase Authentication (chiffrement des mots de passe).
          Toutes les communications sont chiffrées via HTTPS/TLS.
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          Chaque utilisateur ne peut accéder qu'à ses propres données (isolation par règles Firestore).
          Aucune donnée n'est partagée avec des tiers, à l'exception des services techniques nécessaires
          au fonctionnement de l'application (Google Firebase).
        </p>
      </div>

      <!-- Durée de conservation -->
      <div class="section-title"><span class="section-icon">⏳</span> Durée de conservation</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          Les données sont conservées tant que le compte utilisateur est actif.
          En cas de suppression du compte, toutes les données associées sont supprimées
          dans un délai de 30 jours. Les snapshots semestriels archivés sont conservés
          conformément aux obligations réglementaires (5 ans minimum).
        </p>
      </div>

      <!-- Droits des utilisateurs -->
      <div class="section-title"><span class="section-icon">✊</span> Vos droits (RGPD)</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 8px 0;">
          Conformément au RGPD, vous disposez des droits suivants :
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 4px 0;">
          <strong>Droit d'accès</strong> — Obtenir une copie de vos données personnelles.
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 4px 0;">
          <strong>Droit de rectification</strong> — Corriger vos données (via la page Profil).
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 4px 0;">
          <strong>Droit à l'effacement</strong> — Demander la suppression de votre compte et de toutes vos données.
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 4px 0;">
          <strong>Droit à la portabilité</strong> — Exporter vos données dans un format lisible (PDF).
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 4px 0;">
          <strong>Droit d'opposition</strong> — Vous opposer au traitement de vos données.
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0 0 12px 0;">
          <strong>Droit de retrait du consentement</strong> — Retirer votre consentement à tout moment.
        </p>
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          Pour exercer ces droits, contactez-nous à <a href="mailto:eric.valencourt@gmail.com">eric.valencourt@gmail.com</a>.
          Vous pouvez également introduire une réclamation auprès de la CNIL
          (<a href="https://www.cnil.fr" target="_blank">www.cnil.fr</a>).
        </p>
      </div>

      <!-- Cookies -->
      <div class="section-title"><span class="section-icon">🍪</span> Cookies</div>
      <div class="card mb-2">
        <p style="font-size:0.82rem;line-height:1.6;margin:0;">
          ElevApp n'utilise aucun cookie publicitaire ni cookie de suivi tiers.
          Seuls les cookies techniques strictement nécessaires au fonctionnement
          de l'authentification Firebase et au stockage de vos préférences
          (thème clair/sombre) sont utilisés. Ces cookies sont exemptés de consentement
          conformément à la directive ePrivacy.
        </p>
      </div>

      <!-- Sous-traitants -->
      <div class="section-title"><span class="section-icon">🤝</span> Sous-traitants</div>
      <div class="card mb-2">
        <div class="info-row">
          <span class="info-label">Google Firebase</span>
          <span class="info-value">Authentification, base de données, stockage fichiers</span>
        </div>
        <div class="info-row">
          <span class="info-label">GitHub Pages</span>
          <span class="info-value">Hébergement du code de l'application (fichiers statiques)</span>
        </div>
      </div>

      <!-- Mise à jour -->
      <div class="card mb-3" style="text-align:center;">
        <p style="font-size:0.78rem;color:var(--text-muted);margin:0;">
          Dernière mise à jour de cette politique : avril 2026
        </p>
      </div>
    `);
  }

  return { render };
})();
