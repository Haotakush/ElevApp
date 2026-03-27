/**
 * ElevApp — Module Changelog / Quoi de neuf
 * Affiche un popup des nouveautés à chaque nouvelle version
 */

const Changelog = (() => {
  'use strict';

  const CURRENT_VERSION = '1.4';
  const STORAGE_KEY = 'elevapp_last_seen_version';

  // ---- Historique des versions ----
  const VERSIONS = [
    {
      version: '1.4',
      date: '2026-03-21',
      titre: 'Chaleurs, Cycles & Outils avancés',
      items: [
        { icon: '🌡️', text: 'Nouveau : Module Chaleurs & Cycles — suivi complet par femelle (date, écart, saillie, résultat)' },
        { icon: '📈', text: 'Nouveau : Courbe de progestérone — graphique SVG avec lignes de référence à 5 et 20 ng/mL' },
        { icon: '📊', text: 'Nouveau : Sparkline des écarts inter-chaleurs — visualisation chronologique avec moyenne' },
        { icon: '🔮', text: 'Nouveau : Prédiction automatique de la prochaine chaleur basée sur l\'historique' },
        { icon: '⏰', text: 'Nouveau : Rappel automatique chaleur — crée une entrée sanitaire à la date prédite' },
        { icon: '🏥', text: 'Nouveau : Suivi mammite enrichi — quartiers (AG/AD/PG/PD), traitement, dates, évolution' },
        { icon: '🔗', text: 'Nouveau : Lien chaleur → portée — associer une chaleur à la portée qui en est issue' },
        { icon: '📄', text: 'Nouveau : Export PDF "Suivi Reproducteur" complet par femelle' },
        { icon: '📅', text: 'Nouveau : Export agenda .ics — import direct dans Google Calendar, Apple Calendar, Outlook' },
        { icon: '🔔', text: 'Nouveau : Notifications navigateur — rappels vaccins, soins et chaleurs sans serveur' },
        { icon: '⚖️', text: 'Nouveau : Suivi des pesées des chiots/chatons — tableau croisé dates × individus avec graphes' }
      ]
    },
    {
      version: '1.3',
      date: '2026-03-16',
      titre: 'Portées, Reproduction & Gestion avancée',
      items: [
        { icon: '🍼', text: 'Nouveau : Module Portées & Chiots — mariages, suivi gestation, enregistrement individuel de chaque chiot/chaton' },
        { icon: '🔗', text: 'Nouveau : Module Animaux externes — référencer des étalons/femelles d\'autres élevages pour les saillies' },
        { icon: '📅', text: 'Nouveau : Calendrier — vue mensuelle des vaccins, traitements et naissances prévues' },
        { icon: '🏢', text: 'Nouveau : Profil éleveur enrichi — affixe, statut juridique, régime TVA, téléphone' },
        { icon: '🐾', text: 'Nouveau : Filtre espèce — paramétrer si vous élevez des chiens, chats ou les deux' },
        { icon: '📋', text: 'Nouveau : Fiche animal enrichie — potentiel (compagnie/reproduction/expo), poids de naissance, heure, nom de naissance' },
        { icon: '📜', text: 'Nouveau : Enregistrement LOF/LOOF — n° inscription, confirmation, test ADN, cotation, avec alertes' },
        { icon: '🗺️', text: 'Nouveau : Localisation des animaux dans l\'élevage (maternité, nurserie, etc.)' },
        { icon: '📊', text: 'Amélioration : Dashboard avec raccourcis Portées, Externes et Calendrier' }
      ]
    },
    {
      version: '1.2',
      date: '2026-03-16',
      titre: 'Conformité 100% Arrêté du 19 juin 2025',
      items: [
        { icon: '📒', text: 'Nouveau : Registre des entrées / sorties (Art. 7-8) — enregistrement de chaque mouvement d\'animal sous 72h' },
        { icon: '🔍', text: 'Nouveau : Module Autocontrôles (Art. 9) — grille d\'inspection périodique avec 23 points de contrôle' },
        { icon: '⚖️', text: 'Nouveau : Vérification stérilisation des animaux réformés avant cession (Art. 26)' },
        { icon: '👩', text: 'Nouveau : Case obligatoire "Présentation physique de la mère" sur le certificat de cession' },
        { icon: '🏥', text: 'Nouveau : Suivi des visites vétérinaire sanitaire (2/an ou 1/an) avec alertes sur le dashboard' },
        { icon: '📊', text: 'Nouveau : Alertes autocontrôle trimestriel sur le tableau de bord' },
        { icon: '📝', text: 'Amélioration : Placeholders dynamiques selon le type d\'entrée sanitaire (vaccin, mise bas, etc.)' },
        { icon: '💊', text: 'Amélioration : Date de fin pour les traitements' },
        { icon: '📜', text: 'Correction : Mentions légales du certificat de cession — remplacement de la "garantie de conformité" (abolie) par la "garantie des défauts cachés" (Art. 1641 Code civil)' },
        { icon: '📜', text: 'Correction : Droit de rétractation précisé "à compter du jour de la livraison"' },
        { icon: '🎂', text: 'Correction : Calcul d\'âge plus précis (prise en compte du jour dans le mois)' },
        { icon: '📸', text: 'Correction : Les photos peuvent maintenant être sélectionnées depuis la galerie (plus uniquement depuis la caméra)' }
      ]
    },
    {
      version: '1.1',
      date: '2026-03-10',
      titre: 'Certificat de cession & RGPD',
      items: [
        { icon: '📜', text: 'Nouveau : Certificat de cession / vente conforme Art. L214-8 avec génération PDF' },
        { icon: '🔒', text: 'Nouveau : Page Mentions légales et Politique de confidentialité RGPD' },
        { icon: '✅', text: 'Nouveau : Case de consentement RGPD obligatoire à l\'inscription' },
        { icon: '🐣', text: 'Nouveau : Contrôle de reproduction Art. 26 (césariennes, portées, âge, consanguinité)' },
        { icon: '📸', text: 'Amélioration : Photos stockées en base64 dans Firestore (plus besoin de Firebase Storage)' }
      ]
    },
    {
      version: '1.0',
      date: '2026-03-01',
      titre: 'Lancement ElevApp',
      items: [
        { icon: '🐾', text: 'Gestion complète des animaux (fiche, photo, identification)' },
        { icon: '📋', text: 'Journal sanitaire (vaccins, traitements, prophylaxie, examens)' },
        { icon: '📄', text: 'Export PDF du registre sanitaire' },
        { icon: '📊', text: 'Snapshots semestriels avec hash d\'intégrité' },
        { icon: '🌙', text: 'Mode sombre' },
        { icon: '📲', text: 'PWA installable avec mode hors-ligne' }
      ]
    }
  ];

  // ---- Vérifier si on doit afficher le popup ----
  function checkAndShow() {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== CURRENT_VERSION) {
      showChangelog();
    }
  }

  // ---- Afficher le popup ----
  function showChangelog(showAll = false) {
    const versionsToShow = showAll ? VERSIONS : VERSIONS.filter(v => v.version === CURRENT_VERSION);

    const html = `
      <div style="max-height:70vh;overflow-y:auto;">
        <div style="text-align:center;margin-bottom:16px;">
          <span style="font-size:2.5rem;">🎉</span>
          <h2 style="margin:8px 0 4px;font-size:1.3rem;">Quoi de neuf ?</h2>
          <p style="color:var(--text-muted);font-size:0.85rem;">ElevApp v${CURRENT_VERSION}</p>
        </div>

        ${versionsToShow.map(v => `
          <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span class="badge badge-green" style="font-size:0.75rem;">v${v.version}</span>
              <span style="font-weight:700;font-size:0.95rem;">${v.titre}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">${v.date}</div>
            ${v.items.map(item => `
              <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:0.85rem;">
                <span style="flex-shrink:0;">${item.icon}</span>
                <span>${item.text}</span>
              </div>
            `).join('')}
          </div>
        `).join('<hr style="border:none;border-top:1px solid var(--border);margin:12px 0;">')}

        ${!showAll && VERSIONS.length > 1 ? `
          <button class="btn btn-secondary btn-block btn-sm mt-2" onclick="Changelog.showChangelog(true); return false;">
            📋 Voir toutes les versions
          </button>
        ` : ''}
      </div>

      <button class="btn btn-primary btn-block mt-2" id="changelog-dismiss">
        C'est noté !
      </button>
    `;

    UI.openModal(html, {
      onOpen: () => {
        document.getElementById('changelog-dismiss').addEventListener('click', () => {
          localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
          UI.closeModal();
        });
      }
    });

    // Marquer comme vu
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
  }

  // ---- Version actuelle ----
  function getVersion() {
    return CURRENT_VERSION;
  }

  return { checkAndShow, showChangelog, getVersion };
})();
