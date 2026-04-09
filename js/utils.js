/**
 * ElevApp — Utilitaires
 * Helpers dates, validation, compression photo, constantes
 */

const Utils = (() => {
  'use strict';

  // ---- Constantes ----
  const ESPECES = ['canin', 'felin'];

  const RACE_TYPES = {
    lof: 'de race (LOF)',
    loof: 'de race (LOOF)',
    apparence: "d'apparence",
    nonRace: "n'appartient pas à une race"
  };

  const SEXES = { male: 'Mâle', femelle: 'Femelle' };

  const STATUTS_REPRODUCTEUR = {
    nonSterilise: 'Entier(ère)',
    futureRepro: 'Futur reproducteur potentiel',
    enEvaluation: 'En cours d\'évaluation',
    reproducteurConfirme: 'Reproducteur confirmé',
    retraite: 'Retraité de la reproduction',
    steriliseChirurgical: 'Stérilisé chirurgicalement',
    steriliseChimique: 'Stérilisé chimiquement',
    autre: 'Autre (préciser)'
  };

  const STATUTS_ANIMAL = {
    actif: 'Actif',
    vendu: 'Vendu',
    cede: 'Cédé',
    decede: 'Décédé',
    enPension: 'En pension',
    reforme: 'Réformé'
  };

  const TYPES_SANTE = {
    vaccin: { label: 'Vaccin', icon: 'syringe' },
    traitement: { label: 'Traitement', icon: 'bug' },
    prophylaxie: { label: 'Prophylaxie', icon: 'health' },
    chirurgie: { label: 'Chirurgie', icon: 'scissors' },
    visite_veto: { label: 'Visite vétérinaire', icon: 'heartPulse' },
    symptome: { label: 'Symptôme / Diagnostic', icon: 'thermometer' },
    isolement: { label: 'Isolement sanitaire', icon: 'alertCircle' },
    hebergement_indiv: { label: 'Hébergement individuel', icon: 'layers' },
    vice_redhibitoire: { label: 'Vice rédhibitoire', icon: 'alertTriangle' },
    suspicion_maladie: { label: 'Suspicion maladie réglementée', icon: 'alertCircle' },
    deces: { label: 'Décès', icon: 'heart' },
    euthanasie: { label: 'Euthanasie', icon: 'heart' },
    autopsie: { label: 'Autopsie', icon: 'fileText' },
    eval_comportementale: { label: 'Évaluation comportementale', icon: 'clipboardCheck' },
    reforme: { label: 'Réforme', icon: 'penLine' },
    mise_bas: { label: 'Mise bas / Portée', icon: 'litter' },
    examen_pre_repro: { label: 'Examen pré-reproduction', icon: 'eye' },
    pesee: { label: 'Pesée / Poids', icon: 'scale' }
  };

  const VICES_REDHIBITOIRES = {
    canin: [
      'Maladie de Carré',
      'Hépatite contagieuse (Rubarth)',
      'Parvovirose canine',
      'Dysplasie coxofémorale',
      'Ectopie testiculaire (>6 mois)',
      'Atrophie rétinienne'
    ],
    felin: [
      'Leucopénie infectieuse',
      'Péritonite infectieuse féline (PIF)',
      'Infection FeLV',
      'Infection FIV'
    ]
  };

  // ---- Dates ----
  function formatDate(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateShort(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function formatDateISO(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split('T')[0];
  }

  // ---- Saisie de date en format français (JJ/MM/AAAA) ----
  // Utilisé pour les champs de formulaire type="text" à la place de type="date"

  /** Formate une date Firestore/JS en "JJ/MM/AAAA" pour pré-remplir un champ texte */
  function formatDateInput(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }

  /** Retourne aujourd'hui en "JJ/MM/AAAA" pour la valeur par défaut des champs date */
  function todayInput() {
    return formatDateInput(new Date());
  }

  /**
   * Parse un champ date saisi en "JJ/MM/AAAA" (ou "YYYY-MM-DD" en fallback)
   * Retourne un objet Date ou null si invalide
   */
  function parseDateInput(str) {
    if (!str) return null;
    // Format JJ/MM/AAAA (saisie manuelle française)
    const frMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frMatch) {
      const d = new Date(parseInt(frMatch[3]), parseInt(frMatch[2]) - 1, parseInt(frMatch[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    // Fallback : format YYYY-MM-DD (anciens pickers natifs)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /**
   * Auto-formate les champs [data-date-input="1"] au fur et à mesure de la saisie.
   * À appeler UNE SEULE FOIS au démarrage de l'app (dans app.js ou utils init).
   */
  function initDateInputAutoFormat() {
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.tagName !== 'INPUT' || el.dataset.dateInput !== '1') return;
      const cursorAtEnd = el.selectionStart === el.value.length;
      let digits = el.value.replace(/\D/g, '').slice(0, 8);
      let formatted = digits;
      if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
      if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
      el.value = formatted;
      if (cursorAtEnd) el.setSelectionRange(formatted.length, formatted.length);
    });
  }

  function daysBetween(d1, d2) {
    const date1 = d1 instanceof Date ? d1 : d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2 instanceof Date ? d2 : d2.toDate ? d2.toDate() : new Date(d2);
    return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function isExpired(date) {
    if (!date) return false;
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    return d < new Date();
  }

  function isSoon(date, days = 30) {
    if (!date) return false;
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return d >= now && d <= limit;
  }

  function ageString(birthDate) {
    if (!birthDate) return '—';
    const d = birthDate instanceof Date ? birthDate : birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    let months = now.getMonth() - d.getMonth();
    let days = now.getDate() - d.getDate();
    if (days < 0) { months--; }
    if (months < 0) { years--; months += 12; }
    if (years > 0) return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`;
    if (months > 0) return `${months} mois`;
    const totalDays = daysBetween(d, now);
    return `${totalDays} jour${totalDays > 1 ? 's' : ''}`;
  }

  // ---- Validation ----
  function validatePuce(value) {
    if (!value) return false;
    // Puce électronique : 15 chiffres
    if (/^\d{15}$/.test(value)) return true;
    // Tatouage : alphanumérique 3-10 caractères
    if (/^[A-Za-z0-9]{3,10}$/.test(value)) return true;
    return false;
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateSIRET(siret) {
    if (!siret) return true; // optionnel
    return /^\d{14}$/.test(siret.replace(/\s/g, ''));
  }

  // ---- Compression photo ----
  async function compressImage(file, maxWidth = 600, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression échouée'));
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image invalide'));
      img.src = URL.createObjectURL(file);
    });
  }

  // ---- Hash SHA-256 ----
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ---- Helpers divers ----
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function getEspeceEmoji(espece) {
    if (typeof Icons !== 'undefined') return Icons.get('paw', 16);
    return espece === 'canin' ? '🐕' : '🐈'; // fallback si icons.js non chargé
  }

  function getStatutBadgeClass(statut) {
    const map = {
      actif: 'badge-status-actif',
      vendu: 'badge-status-vendu',
      cede: 'badge-status-cede',
      decede: 'badge-status-decede',
      enPension: 'badge-status-enpension',
      reforme: 'badge-status-reforme'
    };
    return map[statut] || 'badge-blue';
  }

  // ---- Conformité reproduction (Arrêté 19 juin 2025, Art. 26) ----

  // Âge limite reproduction : chiennes 8 ans, chattes 6 ans
  const AGE_LIMITE_REPRO = { canin: 8, felin: 6 };
  const MAX_CESARIENNES = 3;
  const MAX_PORTEES_2ANS = 3;

  /**
   * Calcule l'âge en années d'un animal
   */
  function ageInYears(birthDate) {
    if (!birthDate) return 0;
    const d = birthDate instanceof Date ? birthDate : birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const mDiff = now.getMonth() - d.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) years--;
    return years;
  }

  /**
   * Compte les césariennes dans l'historique sanitaire
   */
  function countCesariennes(healthEntries) {
    return healthEntries.filter(e =>
      e.type === 'chirurgie' && e.metadata?.typeChirurgie === 'cesarienne'
    ).length;
  }

  /**
   * Compte les mises bas sur les 2 dernières années
   */
  function countPortees2Ans(healthEntries) {
    const deuxAnsAvant = new Date();
    deuxAnsAvant.setFullYear(deuxAnsAvant.getFullYear() - 2);
    return healthEntries.filter(e => {
      if (e.type !== 'mise_bas' && !(e.type === 'chirurgie' && e.metadata?.typeChirurgie === 'cesarienne')) return false;
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= deuxAnsAvant;
    }).length;
  }

  /**
   * Vérifie si un examen pré-reproduction existe et est récent (< 12 mois)
   */
  function hasRecentExamenPreRepro(healthEntries) {
    const unAnAvant = new Date();
    unAnAvant.setFullYear(unAnAvant.getFullYear() - 1);
    return healthEntries.some(e => {
      if (e.type !== 'examen_pre_repro') return false;
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= unAnAvant;
    });
  }

  /**
   * Analyse complète de conformité reproduction d'une femelle
   * Retourne un tableau d'alertes
   */
  function analyseReproduction(animal, healthEntries) {
    const alertes = [];
    if (animal.sexe !== 'femelle') return alertes;
    if (animal.statut !== 'actif') return alertes;
    if (animal.statutReproducteur !== 'nonSterilise') return alertes;

    const age = ageInYears(animal.dateNaissance);
    const cesariennes = countCesariennes(healthEntries);
    const portees2ans = countPortees2Ans(healthEntries);
    const limiteAge = AGE_LIMITE_REPRO[animal.espece] || 8;

    // 1. Limite de césariennes
    if (cesariennes >= MAX_CESARIENNES) {
      alertes.push({
        type: 'red',
        icon: 'scissors',
        titre: `${animal.nom} : ${cesariennes} césariennes — reproduction interdite`,
        desc: `Art. 26 : une femelle ayant subi 3 césariennes ne peut plus être mise à la reproduction.`
      });
    }

    // 2. Limite de portées (3 max / 2 ans)
    if (portees2ans >= MAX_PORTEES_2ANS) {
      alertes.push({
        type: 'red',
        icon: 'litter',
        titre: `${animal.nom} : ${portees2ans} portées en 2 ans — limite atteinte`,
        desc: `Art. 26 : max. 3 mises bas par période de 2 ans.`
      });
    }

    // 3. Examen pré-reproduction obligatoire si âge >= limite
    if (age >= limiteAge) {
      const hasExamen = hasRecentExamenPreRepro(healthEntries);
      if (!hasExamen) {
        alertes.push({
          type: 'orange',
          icon: 'eye',
          titre: `${animal.nom} : examen pré-reproduction requis (${age} ans)`,
          desc: `Art. 26 : ${animal.espece === 'canin' ? 'chienne dès 8 ans' : 'chatte dès 6 ans'} — un vétérinaire doit confirmer l'aptitude avant toute mise à la reproduction.`
        });
      }
    }

    return alertes;
  }

  /**
   * Vérifie la consanguinité interdite entre deux animaux
   * Interdit : parents/enfants, frères/sœurs
   */
  function checkConsanguinite(animal1, animal2) {
    if (!animal1 || !animal2) return null;

    // Parent/enfant : si l'un est parent de l'autre
    if (animal1.parentMereId === animal2.id || animal1.parentPereId === animal2.id) {
      return `${animal1.nom} est un enfant de ${animal2.nom} — reproduction interdite (Art. 26)`;
    }
    if (animal2.parentMereId === animal1.id || animal2.parentPereId === animal1.id) {
      return `${animal2.nom} est un enfant de ${animal1.nom} — reproduction interdite (Art. 26)`;
    }

    // Frères/sœurs : mêmes parents
    if (animal1.parentMereId && animal1.parentMereId === animal2.parentMereId) {
      return `${animal1.nom} et ${animal2.nom} ont la même mère — reproduction interdite (Art. 26)`;
    }
    if (animal1.parentPereId && animal1.parentPereId === animal2.parentPereId) {
      return `${animal1.nom} et ${animal2.nom} ont le même père — reproduction interdite (Art. 26)`;
    }

    return null; // OK, pas de consanguinité interdite
  }

  function getSemester() {
    const now = new Date();
    const year = now.getFullYear();
    const half = now.getMonth() < 6 ? 'S1' : 'S2';
    return `${year}-${half}`;
  }

  // ---- Automates progestérone ----
  // Seuils de référence par machine (ng/mL)
  // Sources : données fabricants / vétérinaires spécialisés en reproduction
  const AUTOMATES_PROGESTERONE = {
    minividas: {
      label: 'Minividas™ Biomérieux©',
      basale:       { max: 3 },
      picLH:        { min: 3,  max: 5  },
      ovulation:    { min: 7,  max: 10 },
      postOvulation:{ min: 15, max: 25 },
      note: 'Très précis pour l\'ovulation. Très fiable pour le suivi de gestation et la détermination du part.'
    },
    aia_immulite: {
      label: 'AIA™ Tosoh© / Immulite© Roche©',
      basale:       { max: 2 },
      picLH:        { min: 2,  max: 4  },
      ovulation:    { min: 5,  max: 10 },
      postOvulation:{ min: 10, max: 20 },
      note: 'Très précis pour l\'ovulation. Maintenance complexe, réservé aux laboratoires spécialisés. Très fiable pour le suivi de gestation.'
    },
    speadreader: {
      label: 'Speadreader™ Virbac©',
      basale:       { max: 2 },
      picLH:        { min: 2,  max: 5  },
      ovulation:    { min: 4,  max: 10 },
      postOvulation:{ min: 8,  max: 15 },
      note: 'Répéter les dosages de manière rapprochée quand progestérone > 4 ng/mL pour confirmer l\'ovulation. Utilisation limitée pour le suivi de gestation.'
    },
    fujifilm: {
      label: 'AU10V™ Fujifilm©',
      basale:       { max: 2 },
      picLH:        { min: 1,  max: 3  },
      ovulation:    { min: 3,  max: 6  },
      postOvulation:{ min: 5,  max: 10 },
      note: 'Valeur ovulatoire très basse mais fiable. Contrôler 24H après > 4 ng/mL. Utilisation limitée pour le suivi de gestation.'
    },
    idexx: {
      label: 'IDEXX Catalyst© / Solo™ SCIL©',
      basale:       { max: 2 },
      picLH:        { min: 2,  max: 3  },
      ovulation:    { min: 5,  max: 12 },
      postOvulation:{ min: 13, max: null },
      note: 'Variations importantes à l\'ovulation. Interprétation difficile. Non utilisable pour le suivi de gestation.'
    }
  };

  /**
   * Interpréter une valeur de progestérone selon l'automate.
   * Retourne { phase, label, color, emoji, conseil }
   */
  function interpreterProgesterone(valeur, automateKey) {
    const automate = AUTOMATES_PROGESTERONE[automateKey];
    if (!automate || valeur === '' || valeur === null || valeur === undefined) return null;
    const v = parseFloat(valeur);
    if (isNaN(v)) return null;

    if (v < automate.basale.max) {
      return { phase: 'basale', label: 'Basale', emoji: '⚪', color: '#9E9E9E',
        conseil: 'Femelle non fertile — pas encore en phase de saillie.' };
    }
    if (v >= automate.picLH.min && v <= automate.picLH.max) {
      return { phase: 'picLH', label: 'Pic LH', emoji: '🟡', color: '#FF8F00',
        conseil: 'Pic LH détecté — début de la fenêtre de fertilité. Prévoir la saillie dans 2-3 jours.' };
    }
    if (v >= automate.ovulation.min && v <= automate.ovulation.max) {
      return { phase: 'ovulation', label: 'Ovulation', emoji: '🟠', color: '#E65100',
        conseil: 'Ovulation en cours — moment optimal pour la saillie !' };
    }
    if (v > automate.ovulation.max) {
      return { phase: 'postOvulation', label: 'Post-ovulation', emoji: '🟢', color: '#2E7D32',
        conseil: 'Post-ovulation — saillie encore possible dans les 24-48h. Fenêtre se ferme.' };
    }
    // Zone intermédiaire entre basale et picLH
    return { phase: 'montee', label: 'En montée', emoji: '🔵', color: '#1565C0',
      conseil: 'Valeur intermédiaire — relever dans 24-48h pour confirmer la tendance.' };
  }

  return {
    ESPECES, RACE_TYPES, SEXES, STATUTS_REPRODUCTEUR, STATUTS_ANIMAL,
    TYPES_SANTE, VICES_REDHIBITOIRES,
    AUTOMATES_PROGESTERONE, interpreterProgesterone,
    formatDate, formatDateShort, formatDateISO, formatDateInput, todayInput, parseDateInput, initDateInputAutoFormat,
    daysBetween, addMonths,
    isExpired, isSoon, ageString,
    validatePuce, validateEmail, validateSIRET,
    compressImage, sha256, generateId, escapeHtml, debounce,
    getEspeceEmoji, getStatutBadgeClass, getSemester,
    AGE_LIMITE_REPRO, MAX_CESARIENNES, MAX_PORTEES_2ANS,
    ageInYears, countCesariennes, countPortees2Ans,
    hasRecentExamenPreRepro, analyseReproduction, checkConsanguinite
  };
})();
