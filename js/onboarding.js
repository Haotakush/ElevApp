/**
 * ElevApp — Module Onboarding
 * Wizard de première utilisation (6 étapes)
 * Affiché une seule fois au premier login
 */

const Onboarding = (() => {
  'use strict';

  const STORAGE_KEY_BASE = 'elevapp_onboarding_done';
  let currentStep = 0;
  let _uid = null;

  const STEPS = [
    {
      icon: '🎉',
      titre: 'Bienvenue dans ElevApp !',
      texte: "L'application de gestion d'élevage conforme à la réglementation française. Disponible partout, même sans connexion internet.",
      tips: null,
      action: null
    },
    {
      icon: '🏢',
      titre: 'Votre profil éleveur',
      texte: "Commencez par renseigner votre affixe, SIREN et coordonnées. Ces informations apparaîtront automatiquement sur vos certificats de cession et vos exports PDF.",
      tips: ['Votre affixe est votre "signature" officielle', 'Le SIREN est demandé lors des contrôles'],
      action: { label: '👤 Compléter mon profil', page: 'profile' }
    },
    {
      icon: '🐾',
      titre: 'Vos animaux',
      texte: "Ajoutez chacun de vos animaux : puce ICAD, photos, statut reproducteur. Pour les femelles, vous pourrez suivre leurs cycles de chaleurs avec courbe de progestérone.",
      tips: ['Utilisez le bouton + en bas à droite pour ajouter rapidement', 'Les femelles ont accès au module Chaleurs & Cycles'],
      action: { label: '🐾 Voir mes animaux', page: 'animals' }
    },
    {
      icon: '📋',
      titre: 'Journal sanitaire',
      texte: "Enregistrez vaccins, vermifuges et visites vétérinaires. ElevApp calcule les prochaines échéances et vous avertit avant qu'elles n'arrivent.",
      tips: ['Les rappels apparaissent sur votre tableau de bord', 'Activez les notifications pour être alerté sur votre téléphone'],
      action: { label: '📋 Voir le journal', page: 'health' }
    },
    {
      icon: '🌡️',
      titre: 'Chaleurs & Portées',
      texte: "Tracez chaque cycle : date, relevés de progestérone, saillie et résultat. ElevApp prédit la prochaine chaleur et génère un export PDF complet du suivi reproducteur.",
      tips: ['Accédez aux chaleurs depuis la fiche de chaque femelle', 'Reliez chaque chaleur à la portée correspondante'],
      action: null
    },
    {
      icon: '📅',
      titre: 'Exports & Calendrier',
      texte: "Exportez votre agenda d'élevage en .ics pour l'importer dans Google Calendar ou Apple Calendar. Générez vos certificats de cession et registres en PDF.",
      tips: ['Menu Plus → Exports pour tous les exports disponibles', 'Menu Plus → Aide si vous avez une question'],
      action: { label: '🏠 Commencer !', page: 'dashboard', primary: true }
    }
  ];

  // ---- Vérifier si on doit afficher ----
  function checkAndShow(uid) {
    _uid = uid || null;
    const key = _uid ? `${STORAGE_KEY_BASE}_${_uid}` : STORAGE_KEY_BASE;
    if (!localStorage.getItem(key)) {
      currentStep = 0;
      // Légère temporisation pour laisser le dashboard s'afficher en premier
      setTimeout(() => _renderStep(currentStep), 600);
    }
  }

  // ---- Afficher manuellement (depuis Aide) ----
  function show() {
    currentStep = 0;
    _renderStep(currentStep);
  }

  // ---- Rendu d'une étape ----
  function _renderStep(stepIdx) {
    const step = STEPS[stepIdx];
    const total = STEPS.length;
    const isLast = stepIdx === total - 1;
    const isFirst = stepIdx === 0;

    // Indicateur de progression (dots)
    const dotsHtml = STEPS.map((_, i) =>
      `<span style="
        display:inline-block;width:${i === stepIdx ? '20px' : '8px'};height:8px;
        border-radius:4px;
        background:${i === stepIdx ? 'var(--primary)' : 'var(--border)'};
        margin:0 3px;transition:all 0.3s;
      "></span>`
    ).join('');

    const tipsHtml = step.tips ? `
      <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:12px;margin-bottom:16px;text-align:left;">
        ${step.tips.map(tip => `
          <div style="display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">
            <span style="flex-shrink:0;color:var(--primary);">💡</span>
            <span>${tip}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const html = `
      <div style="text-align:center;padding:4px 0 8px;">

        <!-- Étape et icône -->
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
          Étape ${stepIdx + 1} sur ${total}
        </div>
        <div style="font-size:3rem;margin-bottom:12px;">${step.icon}</div>
        <h2 style="font-size:1.15rem;margin:0 0 10px;font-weight:800;">${step.titre}</h2>
        <p style="color:var(--text-muted);font-size:0.87rem;line-height:1.55;margin:0 0 16px;">${step.texte}</p>

        <!-- Tips -->
        ${tipsHtml}

        <!-- Dots de progression -->
        <div style="margin-bottom:20px;">${dotsHtml}</div>

        <!-- Bouton d'action optionnel -->
        ${step.action ? `
          <button class="btn ${step.action.primary ? 'btn-primary' : 'btn-secondary'} btn-block mb-2" id="ob-action-btn">
            ${step.action.label}
          </button>
        ` : ''}

        <!-- Navigation précédent / suivant -->
        <div style="display:flex;gap:8px;margin-top:${step.action ? '4px' : '0'};">
          ${!isFirst
            ? `<button class="btn btn-secondary" style="flex:1;" id="ob-prev-btn">← Précédent</button>`
            : `<div style="flex:1;"></div>`
          }
          ${!isLast
            ? `<button class="btn btn-primary" style="flex:1;" id="ob-next-btn">Suivant →</button>`
            : ''
          }
        </div>

        <!-- Passer le tutoriel -->
        ${!isLast ? `
          <button style="background:none;border:none;color:var(--text-muted);font-size:0.78rem;margin-top:14px;cursor:pointer;padding:4px 8px;text-decoration:underline;" id="ob-skip-btn">
            Passer le tutoriel
          </button>
        ` : ''}

      </div>
    `;

    UI.openModal(html, {
      onOpen: () => {
        // Suivant
        document.getElementById('ob-next-btn')?.addEventListener('click', () => {
          currentStep++;
          _renderStep(currentStep);
        });

        // Précédent
        document.getElementById('ob-prev-btn')?.addEventListener('click', () => {
          currentStep--;
          _renderStep(currentStep);
        });

        // Passer
        document.getElementById('ob-skip-btn')?.addEventListener('click', () => {
          _dismiss();
        });

        // Bouton d'action de l'étape
        document.getElementById('ob-action-btn')?.addEventListener('click', () => {
          if (isLast) {
            _dismiss();
          }
          if (step.action && step.action.page) {
            _dismiss();
            if (step.action.page !== 'dashboard') {
              UI.navigateTo(step.action.page);
            }
          } else {
            currentStep++;
            _renderStep(currentStep);
          }
        });
      }
    });
  }

  // ---- Marquer comme fait et fermer ----
  function _dismiss() {
    const key = _uid ? `${STORAGE_KEY_BASE}_${_uid}` : STORAGE_KEY_BASE;
    localStorage.setItem(key, '1');
    UI.closeModal();
  }

  // ---- Réinitialiser (pour tester) ----
  function reset() {
    const key = _uid ? `${STORAGE_KEY_BASE}_${_uid}` : STORAGE_KEY_BASE;
    localStorage.removeItem(key);
    UI.toast('Tutoriel réinitialisé', 'info');
  }

  return { checkAndShow, show, reset };
})();
