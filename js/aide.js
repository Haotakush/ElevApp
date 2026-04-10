/**
 * ElevApp — Module Aide
 * Page d'aide complète avec sections par module
 * + Aide contextuelle (UI.showHelp)
 */

const Aide = (() => {
  'use strict';

  // ---- Sections d'aide ----
  const SECTIONS = [
    {
      id: 'demarrage',
      icon: 'star',
      titre: 'Démarrage rapide',
      items: [
        {
          q: 'Par où commencer ?',
          r: `Suivez ces 4 étapes dans l'ordre :<br>
              <br>
              <strong>1.</strong> Complétez votre <strong>profil éleveur</strong> (affixe, SIREN, coordonnées) — il s'affichera sur vos certificats<br>
              <strong>2.</strong> Ajoutez vos <strong>animaux</strong> (menu Animaux → bouton +)<br>
              <strong>3.</strong> Renseignez leur <strong>journal sanitaire</strong> (vaccins, vermifuges)<br>
              <strong>4.</strong> Pour les femelles, ouvrez le <strong>module Chaleurs</strong> depuis leur fiche`
        },
        {
          q: 'Comment installer l\'application sur mon téléphone ?',
          r: `Sur <strong>Android</strong> : ouvrez l'appli dans Chrome, appuyez sur les 3 points → "Ajouter à l'écran d'accueil". ElevApp fonctionnera alors comme une vraie application.<br>
              <br>
              Sur <strong>iPhone</strong> : ouvrez dans Safari, appuyez sur le bouton Partager (carré avec flèche) → "Sur l'écran d'accueil". Nécessite iOS 16.4 minimum pour les notifications.`
        },
        {
          q: 'L\'application fonctionne-t-elle sans internet ?',
          r: `Oui, une fois chargée, ElevApp fonctionne en mode hors-ligne. Vous pouvez consulter vos fiches et votre journal. Les modifications sont enregistrées localement et synchronisées automatiquement dès que vous retrouvez la connexion.`
        }
      ]
    },
    {
      id: 'animaux',
      icon: 'paw',
      titre: 'Animaux',
      items: [
        {
          q: 'Comment ajouter un animal ?',
          r: `Rendez-vous dans le menu <strong>Animaux</strong> puis appuyez sur le bouton <strong>+</strong> (rond orange en bas à droite). Renseignez au minimum le nom, l'espèce et le sexe. Vous pouvez ajouter une photo directement depuis votre galerie.`
        },
        {
          q: 'Où entrer le numéro de puce ICAD ?',
          r: `Dans la fiche de l'animal, le champ <strong>Numéro d'identification</strong> accepte le numéro de transpondeur (15 chiffres pour les puces ISO). Il apparaîtra sur le certificat de cession.`
        },
        {
          q: 'Qu\'est-ce que le statut reproducteur ?',
          r: `Chaque animal peut être marqué comme <strong>Entier</strong> (non stérilisé), <strong>Stérilisé</strong> ou <strong>Retraité de la reproduction</strong>. Ce statut est utilisé pour les vérifications de conformité (Art. 26 de l'arrêté du 19 juin 2025) : un animal réformé doit être stérilisé avant toute cession.`
        },
        {
          q: 'Comment accéder au module Chaleurs d\'une femelle ?',
          r: `Ouvrez la fiche de la femelle. Si elle est entière, vous verrez la section <strong>🌡️ Chaleurs & Cycles</strong> avec un bouton "Voir →". Vous pouvez aussi appuyer sur le bouton rapide <strong>🌡️ Chaleur</strong> dans les actions rapides de la fiche.`
        }
      ]
    },
    {
      id: 'sante',
      icon: 'health',
      titre: 'Journal sanitaire',
      items: [
        {
          q: 'Quels types d\'entrées peut-on enregistrer ?',
          r: `Le journal accepte : <strong>Vaccin</strong>, <strong>Vermifuge</strong>, <strong>Antiparasitaire</strong>, <strong>Traitement</strong>, <strong>Visite vétérinaire</strong>, <strong>Examen</strong>, <strong>Mise bas</strong>, <strong>Prise de sang</strong> et d'autres types libres.`
        },
        {
          q: 'Comment fonctionnent les rappels ?',
          r: `Quand vous enregistrez une entrée, vous pouvez cocher <strong>"Créer un rappel"</strong> et saisir une date. Le rappel apparaîtra dans votre tableau de bord en rouge si la date est dépassée, en orange s'il est dans les 7 jours à venir.`
        },
        {
          q: 'La visite vétérinaire sanitaire obligatoire est-elle suivie ?',
          r: `Oui. Selon l'arrêté du 19 juin 2025, les éleveurs de plus de 3 reproducteurs doivent avoir une visite vétérinaire sanitaire tous les 6 mois (1 an si moins de 3). ElevApp affiche une alerte sur le tableau de bord si cette visite est en retard.`
        }
      ]
    },
    {
      id: 'chaleurs',
      icon: 'thermometer',
      titre: 'Chaleurs & Cycles',
      items: [
        {
          q: 'Comment enregistrer une chaleur ?',
          r: `Depuis la fiche de la femelle → section Chaleurs → bouton <strong>"+ Nouvelle chaleur"</strong>. Renseignez la date de début, puis ajoutez progressivement les relevés de progestérone, les informations de saillie et le résultat.`
        },
        {
          q: 'À quoi servent les relevés de progestérone ?',
          r: `La progestérone permet de détecter précisément l'ovulation :<br>
              <br>
              • <strong>< 2 ng/mL</strong> : phase folliculaire (chaleurs en cours mais pas encore ovulée)<br>
              • <strong>5 ng/mL</strong> : pic LH, début de l'ovulation (ligne bleue sur le graphique)<br>
              • <strong>> 20 ng/mL</strong> : phase lutéale confirmée (ligne verte sur le graphique)<br>
              <br>
              La fenêtre de saillie optimale se situe généralement 2 à 3 jours après le pic LH.`
        },
        {
          q: 'Comment fonctionne la prédiction de chaleur ?',
          r: `ElevApp calcule la <strong>moyenne des écarts inter-chaleurs</strong> sur l'historique de la femelle et prédit la date de la prochaine chaleur. Plus vous avez d'historique, plus la prédiction est précise. La plupart des chiennes ont un cycle de 6 à 8 mois.`
        },
        {
          q: 'Que signifient les quartiers dans le suivi mammite ?',
          r: `Une mamelle de chienne ou de chatte comporte plusieurs quartiers :<br>
              <strong>AG</strong> = Antérieur Gauche · <strong>AD</strong> = Antérieur Droit<br>
              <strong>PG</strong> = Postérieur Gauche · <strong>PD</strong> = Postérieur Droit<br>
              <br>
              Cochez les quartiers atteints, renseignez le traitement prescrit par votre vétérinaire et suivez l'évolution (résolutive, chronique…).`
        },
        {
          q: 'Comment relier une chaleur à une portée ?',
          r: `Dans le formulaire de chaleur, en bas de page, vous trouverez un menu déroulant <strong>"Portée issue de cette chaleur"</strong> qui liste toutes les portées de la femelle. Sélectionnez la portée correspondante. Un lien cliquable apparaîtra ensuite dans la carte de la chaleur.`
        },
        {
          q: 'Comment exporter le suivi reproducteur en PDF ?',
          r: `Depuis la page Chaleurs d'une femelle, appuyez sur le bouton <strong>"📄 Export PDF"</strong>. Le document généré contient l'historique complet : toutes les chaleurs, les relevés de progestérone, les saillies et les résultats.`
        }
      ]
    },
    {
      id: 'portees',
      icon: 'litter',
      titre: 'Portées & Chiots',
      items: [
        {
          q: 'Comment créer une portée ?',
          r: `Menu <strong>Portées</strong> → bouton <strong>+</strong>. Renseignez la mère (parmi vos femelles), le père (parmi vos animaux ou animaux externes), la date de saillie et la date de mise bas. ElevApp calcule automatiquement la durée de gestation.`
        },
        {
          q: 'Comment ajouter les chiots/chatons individuellement ?',
          r: `Depuis la fiche de la portée → section <strong>Chiots</strong> → bouton "Ajouter un chiot". Chaque chiot reçoit une fiche individuelle (nom, sexe, couleur, poids de naissance) et peut être converti en animal de l'élevage s'il est gardé.`
        },
        {
          q: 'Comment fonctionne le suivi des pesées ?',
          r: `Dans la fiche portée, une fois les chiots ajoutés, la section <strong>⚖️ Suivi des pesées</strong> apparaît. Appuyez sur "Nouvelle pesée" pour saisir le poids de chaque chiot à une date donnée. ElevApp affiche un tableau avec les variations (+/- g) et un graphique de courbe de poids par chiot.`
        }
      ]
    },
    {
      id: 'exports',
      icon: 'lineChart',
      titre: 'Exports & Calendrier',
      items: [
        {
          q: 'Comment exporter mon agenda dans Google Calendar ?',
          r: `Menu Plus → <strong>Exports</strong> → bouton <strong>"Exporter l'agenda .ics"</strong>. Ouvrez le fichier téléchargé : il s'importera automatiquement dans Google Calendar, Apple Calendar ou Outlook. Le fichier contient vos rappels santé, les prochaines chaleurs prédites et les mises bas estimées.`
        },
        {
          q: 'Que contient le registre des entrées/sorties ?',
          r: `Le registre est conforme à l'article 7-8 de l'arrêté du 19 juin 2025. Il liste chaque mouvement d'animal (naissance, achat, vente, décès) avec les informations légalement requises. Vous pouvez l'exporter en PDF.`
        },
        {
          q: 'Comment générer un certificat de cession ?',
          r: `Menu Plus → <strong>Certificat de cession</strong> (ou depuis la fiche animal). Sélectionnez l'animal vendu, saisissez les coordonnées de l'acheteur. Le certificat PDF généré est conforme à l'article L214-8 du Code rural, avec la mention de la garantie des défauts cachés (Art. 1641 du Code civil).`
        }
      ]
    },
    {
      id: 'notifications',
      icon: 'bell',
      titre: 'Notifications',
      items: [
        {
          q: 'Comment activer les notifications ?',
          r: `Sur le tableau de bord, si les notifications ne sont pas encore activées, un bandeau apparaît avec un bouton <strong>"Activer les notifications"</strong>. Appuyez dessus et acceptez la demande de permission du navigateur. Sur iPhone, vous devez d'abord avoir ajouté ElevApp à votre écran d'accueil.`
        },
        {
          q: 'Pour quels événements reçoit-on des notifications ?',
          r: `ElevApp vous notifie pour les <strong>rappels santé</strong> (vaccins, vermifuges, visites vétérinaires) lorsqu'ils sont en retard ou à moins de 7 jours. La vérification se fait automatiquement à chaque ouverture de l'application (une fois par jour maximum).`
        },
        {
          q: 'Pourquoi je ne reçois pas de notifications sur iPhone ?',
          r: `Les notifications PWA sur iPhone nécessitent iOS 16.4 minimum et que l'application soit <strong>ajoutée à l'écran d'accueil</strong> via Safari. Les notifications ne fonctionnent pas si vous utilisez ElevApp directement dans le navigateur Safari sans l'avoir installée.`
        }
      ]
    },
    {
      id: 'conformite',
      icon: 'scale',
      titre: 'Conformité réglementaire',
      items: [
        {
          q: 'Quel règlement s\'applique à mon élevage ?',
          r: `L'<strong>arrêté du 19 juin 2025</strong> relatif aux conditions de détention des animaux de compagnie dans les établissements d'élevage. Il remplace les textes précédents et impose notamment : registre des mouvements, autocontrôles périodiques, visite vétérinaire sanitaire, et nouvelles règles de reproduction.`
        },
        {
          q: 'Que vérifie la section Conformité/Repro ?',
          r: `La page <strong>Repro</strong> (onglet du bas) vérifie automatiquement les règles de l'article 26 :<br>
              • Nombre de portées maximum par femelle<br>
              • Âge minimum et maximum à la première mise bas<br>
              • Nombre de césariennes<br>
              • Stérilisation avant cession des animaux réformés`
        },
        {
          q: 'Que sont les autocontrôles ?',
          r: `Les autocontrôles sont des inspections que vous réalisez vous-même selon une grille de 23 points définie par la réglementation (Art. 9). Ils doivent être effectués au minimum tous les trimestres. ElevApp affiche une alerte sur le tableau de bord si un autocontrôle est en retard.`
        }
      ]
    }
  ];

  // ---- Rendu de la page aide ----
  function render() {
    const html = `
      ${UI.pageHeader('❓ Aide & Guide', null)}

      <!-- Bouton relancer le tutoriel -->
      <div class="card mb-2" style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('bookOpen', 22)}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;">Tutoriel interactif</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">Revoir le guide de démarrage étape par étape</div>
        </div>
        <button class="btn btn-primary btn-sm" id="aide-tuto-btn">Lancer</button>
      </div>

      <!-- Sections FAQ -->
      <div style="margin-top:8px;" id="aide-sections">
        ${SECTIONS.map((section, si) => `
          <div class="card mb-2" style="padding:0;overflow:hidden;">

            <!-- En-tête de section (cliquable) -->
            <button
              data-section="${si}"
              style="width:100%;background:none;border:none;display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;text-align:left;"
              id="aide-section-btn-${si}"
            >
              <span style="font-size:1.4rem;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;">${Icons.get(section.icon, 18)}</span>
              <span style="flex:1;font-weight:700;font-size:0.95rem;">${section.titre}</span>
              <span id="aide-section-chevron-${si}" style="color:var(--text-muted);transition:transform 0.2s;font-size:0.8rem;">${Icons.get('chevronDown', 14)}</span>
            </button>

            <!-- Contenu de la section (masqué par défaut) -->
            <div id="aide-section-${si}" style="display:none;border-top:1px solid var(--border);">
              ${section.items.map((item, ii) => `
                <div style="padding:0;${ii < section.items.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
                  <!-- Question -->
                  <button
                    data-section="${si}" data-item="${ii}"
                    style="width:100%;background:none;border:none;display:flex;align-items:flex-start;gap:10px;padding:12px 16px;cursor:pointer;text-align:left;"
                    id="aide-item-btn-${si}-${ii}"
                  >
                    <span style="color:var(--primary);font-weight:700;flex-shrink:0;">Q</span>
                    <span style="flex:1;font-size:0.87rem;font-weight:600;line-height:1.4;">${item.q}</span>
                    <span id="aide-item-chevron-${si}-${ii}" style="color:var(--text-muted);font-size:0.75rem;flex-shrink:0;margin-top:2px;">${Icons.get('chevronRight', 14)}</span>
                  </button>
                  <!-- Réponse -->
                  <div id="aide-item-${si}-${ii}" style="display:none;padding:0 16px 14px 16px;">
                    <p style="font-size:0.84rem;line-height:1.6;color:var(--text-secondary);margin:0;">${item.r}</p>
                  </div>
                </div>
              `).join('')}
            </div>

          </div>
        `).join('')}
      </div>

      <!-- Contacter le support -->
      <div class="card mb-2" style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('mail', 22)}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;">Besoin d'aide ?</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">Notre équipe répond sous 24h (jours ouvrés)</div>
        </div>
        <a href="mailto:contact@elevapp.fr" class="btn btn-primary btn-sm" style="white-space:nowrap;">Nous écrire</a>
      </div>

      <!-- Version -->
      <div style="text-align:center;padding:16px 0;font-size:0.78rem;color:var(--text-muted);">
        ElevApp v${typeof Changelog !== 'undefined' ? Changelog.getVersion() : '1.4'} —
        <button id="aide-changelog-btn" style="background:none;border:none;color:var(--primary);font-size:0.78rem;cursor:pointer;padding:0;">
          Voir le changelog
        </button>
      </div>
    `;

    UI.setContent(html);

    // Attacher les événements via addEventListener (évite les onclick inline bloqués par CSP)
    document.getElementById('aide-changelog-btn')?.addEventListener('click', () => Changelog.showChangelog(true));
    document.getElementById('aide-tuto-btn')?.addEventListener('click', () => { if (typeof Onboarding !== 'undefined') Onboarding.show(); });

    document.querySelectorAll('[data-section]:not([data-item])').forEach(btn => {
      btn.addEventListener('click', () => _toggleSection(Number(btn.dataset.section)));
    });

    document.querySelectorAll('[data-section][data-item]').forEach(btn => {
      btn.addEventListener('click', () => _toggleItem(Number(btn.dataset.section), Number(btn.dataset.item)));
    });
  }

  // ---- Toggle section (ouvre/ferme) ----
  function _toggleSection(si) {
    const content = document.getElementById(`aide-section-${si}`);
    const chevron = document.getElementById(`aide-section-chevron-${si}`);
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    // SVG rotation handled via inline display
  }

  // ---- Toggle item Q/R ----
  function _toggleItem(si, ii) {
    const content = document.getElementById(`aide-item-${si}-${ii}`);
    const chevron = document.getElementById(`aide-item-chevron-${si}-${ii}`);
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    // SVG rotation handled via inline display
  }

  return { render, _toggleSection, _toggleItem };
})();
