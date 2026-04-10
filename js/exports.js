/**
 * ElevApp — Module Exports
 * Export PDF registre sanitaire + Snapshot semestriel
 * Utilise jsPDF côté client
 */

const Exports = (() => {
  'use strict';

  // Helper: download jsPDF doc as Blob
  // NOTE: Pas de target="_blank" — en mode PWA standalone, cela navigue TOUTE la fenêtre
  // vers le blob URL et détruit l'app. L'attribut `download` seul suffit pour le téléchargement.
  function _downloadPDF(doc, fileName) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  async function render() {
    const uid = Auth.getUid();
    if (!uid) {
      UI.setContent('<p class="text-center text-muted" style="padding:40px 0;">Chargement…</p>');
      return;
    }

    UI.setContent(`
      <div class="section-title"><div class="section-icon">${Icons.get('lineChart', 18)}</div> Exports & Archivage</div>

      <!-- Export PDF -->
      <div class="card mb-2">
        <div class="card-header">
          <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('fileDown', 22)}</div>
          <div>
            <div class="card-title">Export PDF — Registre sanitaire</div>
            <div class="card-subtitle">Générer un PDF conforme du registre complet</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="export-pdf-btn">
          Générer le PDF
        </button>
      </div>

      <!-- Certificat de cession -->
      <div class="card mb-2">
        <div class="card-header">
          <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('fileText', 22)}</div>
          <div>
            <div class="card-title">Certificat de cession / vente</div>
            <div class="card-subtitle">Attestation conforme Art. L214-8 Code rural</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" data-nav="cession-form">
          Créer un certificat de cession
        </button>
      </div>

      <!-- Export agenda .ics -->
      <div class="card mb-2">
        <div class="card-header" style="justify-content:space-between;align-items:flex-start;">
          <div style="display:flex;gap:12px;align-items:center;">
            <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('calendar', 22)}</div>
            <div>
              <div class="card-title">Export agenda Google Calendar</div>
              <div class="card-subtitle">Rappels vaccins, mises bas prévues, chaleurs — fichier .ics universel</div>
            </div>
          </div>
          <button id="ics-help-btn" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-muted);padding:4px;flex-shrink:0;">ℹ️</button>
        </div>
        <button class="btn btn-primary btn-block" id="export-ics-btn">
          Télécharger le fichier .ics
        </button>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">
          Compatible Google Calendar, Apple Calendar (iPhone/Mac), Outlook. Ouvrez le fichier téléchargé → "Importer dans votre agenda".
        </div>
      </div>

      <!-- Registre Entrées/Sorties -->
      <div class="card mb-2">
        <div class="card-header">
          <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('bookOpen', 22)}</div>
          <div>
            <div class="card-title">Registre des entrées / sorties</div>
            <div class="card-subtitle">Art. 7-8 — Enregistrement sous 72h obligatoire</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" data-nav="registre">
          Ouvrir le registre
        </button>
      </div>

      <!-- Autocontrôles -->
      <div class="card mb-2">
        <div class="card-header">
          <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('clipboardCheck', 22)}</div>
          <div>
            <div class="card-title">Autocontrôles</div>
            <div class="card-subtitle">Art. 9 — Grille d'inspection périodique</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" data-nav="autocontrole">
          Ouvrir les autocontrôles
        </button>
      </div>

      <!-- Snapshot semestriel -->
      <div class="card mb-2">
        <div class="card-header">
          <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);">${Icons.get('lineChart', 22)}</div>
          <div>
            <div class="card-title">Snapshot semestriel</div>
            <div class="card-subtitle">Archive non modifiable avec hash d'intégrité</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="snapshot-btn">
          Générer le snapshot ${Utils.getSemester()}
        </button>
      </div>

      <!-- Historique snapshots -->
      <div class="section-title mt-3"><div class="section-icon">${Icons.get('bookOpen', 18)}</div> Historique des snapshots</div>
      <div id="snapshots-list">
        <div class="skeleton skeleton-card"></div>
      </div>
    `);

    // Charger les snapshots
    loadSnapshots(uid);

    // Events
    document.getElementById('export-pdf-btn').addEventListener('click', () => generatePDF(uid));
    document.getElementById('export-ics-btn').addEventListener('click', () => ICS.exportAgenda());
    document.getElementById('snapshot-btn').addEventListener('click', () => generateSnapshot(uid));
    document.getElementById('ics-help-btn').addEventListener('click', () => UI.showHelp('Export agenda .ics', 'Le fichier .ics (iCalendar) est un format universel d\'agenda.<br><br><strong>Comment l\'importer :</strong><br>• <strong>Google Calendar</strong> : Paramètres → Importer → ouvrir le fichier<br>• <strong>Apple Calendar (iPhone/Mac)</strong> : ouvrir le fichier .ics → "Importer"<br>• <strong>Outlook</strong> : Fichier → Ouvrir et exporter → Importer<br><br>Le fichier contient vos rappels santé, les prochaines chaleurs prédites et les dates de mise bas estimées.'));
  }

  async function loadSnapshots(uid) {
    const listEl = document.getElementById('snapshots-list');
    try {
      const snapshots = await DB.getSnapshots(uid);
      if (snapshots.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Aucun snapshot généré</p>';
        return;
      }

      listEl.innerHTML = snapshots.map(snap => `
        <div class="card mb-1">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>Snapshot ${snap.periode || '#' + snap.numero}</strong>
              <div class="card-subtitle">${Utils.formatDate(snap.date)}</div>
            </div>
            <span class="badge badge-green">Archivé</span>
          </div>
          ${snap.hash ? `<div class="form-hint mt-1" style="word-break:break-all;">SHA-256 : ${snap.hash.substring(0, 20)}...</div>` : ''}
          ${snap.pdfURL ? `<a href="${snap.pdfURL}" target="_blank" class="btn btn-secondary btn-sm mt-1">${Icons.get('download', 14)} Télécharger</a>` : ''}
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = '<p class="text-muted">Erreur de chargement</p>';
    }
  }

  // ---- Génération PDF ----
  async function generatePDF(uid) {
    const btn = document.getElementById('export-pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Génération en cours...';

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let y = margin;

      // Charger tout en parallèle — élimine le pattern N+1 du loop ci-dessous
      const [profile, animals, allHealthEntries] = await Promise.all([
        DB.getUserProfile(uid),
        DB.getAnimals(uid),
        DB.getAllHealthEntries(uid)
      ]);
      // Index par animalId pour un accès O(1) dans le loop
      const entriesByAnimal = {};
      for (const e of allHealthEntries) {
        if (!entriesByAnimal[e.animalId]) entriesByAnimal[e.animalId] = [];
        entriesByAnimal[e.animalId].push(e);
      }

      // ---- En-tête ----
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Registre Sanitaire d\'Élevage', pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Conforme à l'arrêté du 19 juin 2025`, pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Infos éleveur
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Éleveur :', margin, y);
      doc.setFont(undefined, 'normal');
      doc.text(profile?.nom || '—', margin + 20, y); y += 5;

      doc.setFont(undefined, 'bold');
      doc.text('Adresse :', margin, y);
      doc.setFont(undefined, 'normal');
      doc.text(profile?.adresse || '—', margin + 20, y); y += 5;

      if (profile?.siret) {
        doc.setFont(undefined, 'bold');
        doc.text('SIRET :', margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(profile.siret, margin + 20, y); y += 5;
      }

      if (profile?.vetoSanitaire?.nom) {
        doc.setFont(undefined, 'bold');
        doc.text('Vétérinaire :', margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${profile.vetoSanitaire.nom} — ${profile.vetoSanitaire.telephone || ''}`, margin + 28, y); y += 5;
      }

      doc.setFont(undefined, 'bold');
      doc.text('Date :', margin, y);
      doc.setFont(undefined, 'normal');
      doc.text(new Date().toLocaleDateString('fr-FR'), margin + 15, y); y += 10;

      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // ---- Pour chaque animal ----
      for (const animal of animals) {
        // Vérifier espace restant
        if (y > pageHeight - 60) {
          addPageNumber(doc, pageWidth, pageHeight);
          doc.addPage();
          y = margin;
        }

        // Titre animal
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`${animal.espece === 'canin' ? '[CANIN]' : '[FÉLIN]'} ${animal.nom}`, margin, y);
        y += 6;

        // Infos animal
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        const infoLines = [
          `Race : ${getRaceLabel(animal)} | Sexe : ${Utils.SEXES[animal.sexe] || '—'}`,
          `Date de naissance : ${Utils.formatDate(animal.dateNaissance)}${animal.dateNaissanceApprox ? ' (approx.)' : ''} | Identification : ${animal.puce || '—'}`,
          `Robe : ${animal.couleurRobe || '—'} | Reproducteur : ${Utils.STATUTS_REPRODUCTEUR[animal.statutReproducteur] || '—'}`,
          `Statut : ${Utils.STATUTS_ANIMAL[animal.statut] || '—'}${animal.signesParticuliers ? ' | Signes : ' + animal.signesParticuliers : ''}`
        ];

        infoLines.forEach(line => {
          doc.text(line, margin, y);
          y += 4;
        });
        y += 3;

        // Conformité reproduction (femelles actives non stérilisées)
        if (animal.sexe === 'femelle' && animal.statutReproducteur === 'nonSterilise' && animal.statut === 'actif') {
          const entries2 = entriesByAnimal[animal.id] || [];
          const cesariennes = Utils.countCesariennes(entries2);
          const portees2ans = Utils.countPortees2Ans(entries2);
          const age = Utils.ageInYears(animal.dateNaissance);
          const limiteAge = Utils.AGE_LIMITE_REPRO[animal.espece] || 8;
          const hasExamen = Utils.hasRecentExamenPreRepro(entries2);
          const reproAlertes = Utils.analyseReproduction(animal, entries2);

          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          doc.text('Conformité reproduction (Art. 26) :', margin, y);
          y += 4;
          doc.setFont(undefined, 'normal');
          doc.text(`Césariennes : ${cesariennes}/${Utils.MAX_CESARIENNES} | Portées (2 ans) : ${portees2ans}/${Utils.MAX_PORTEES_2ANS} | Âge : ${age} ans (limite : ${limiteAge})`, margin + 2, y);
          y += 4;
          if (age >= limiteAge) {
            doc.text(`Examen pré-reproduction : ${hasExamen ? 'Valide (< 12 mois)' : 'REQUIS'}`, margin + 2, y);
            y += 4;
          }
          if (reproAlertes.length > 0) {
            doc.setTextColor(200, 0, 0);
            reproAlertes.forEach(ra => {
              doc.text(`ALERTE : ${ra.titre}`, margin + 2, y);
              y += 4;
            });
            doc.setTextColor(0, 0, 0);
          }
          y += 2;
        }

        // Entrées sanitaires (déjà chargées en amont)
        const entries = entriesByAnimal[animal.id] || [];
        if (entries.length > 0) {
          // En-tête tableau
          doc.setFillColor(240, 238, 234);
          doc.rect(margin, y - 1, contentWidth, 5, 'F');
          doc.setFontSize(7);
          doc.setFont(undefined, 'bold');
          doc.text('Date', margin + 1, y + 3);
          doc.text('Type', margin + 25, y + 3);
          doc.text('Titre', margin + 60, y + 3);
          doc.text('Détails', margin + 110, y + 3);
          y += 7;

          doc.setFont(undefined, 'normal');
          for (const entry of entries) {
            if (y > pageHeight - 20) {
              addPageNumber(doc, pageWidth, pageHeight);
              doc.addPage();
              y = margin;
            }

            const typeLabel = Utils.TYPES_SANTE[entry.type]?.label || entry.type;
            const dateStr = Utils.formatDate(entry.date);
            const titre = (entry.titre || '').substring(0, 30);
            const details = (entry.details || '').substring(0, 40);

            doc.text(dateStr, margin + 1, y);
            doc.text(typeLabel.substring(0, 18), margin + 25, y);
            doc.text(titre, margin + 60, y);
            doc.text(details, margin + 110, y);
            y += 4;
          }
        } else {
          doc.setFontSize(7);
          doc.setFont(undefined, 'italic');
          doc.text('Aucun événement sanitaire enregistré', margin, y);
          y += 4;
        }

        y += 6;
        doc.setDrawColor(220);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
      }

      // Dernière page
      addPageNumber(doc, pageWidth, pageHeight);

      // Sauvegarder
      const fileName = `registre_sanitaire_${new Date().toISOString().split('T')[0]}.pdf`;
      _downloadPDF(doc, fileName);

      btn.disabled = false;
      btn.textContent = 'Générer le PDF';
      UI.toast('PDF généré avec succès !', 'success');

      return doc;
    } catch (err) {
      console.error('Erreur génération PDF', err);
      btn.disabled = false;
      btn.textContent = 'Générer le PDF';
      UI.toast('Erreur lors de la génération du PDF', 'error');
    }
  }

  // ---- Snapshot semestriel ----
  async function generateSnapshot(uid) {
    const btn = document.getElementById('snapshot-btn');
    btn.disabled = true;
    btn.textContent = 'Génération en cours...';

    try {
      // Générer le PDF
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const profile = await DB.getUserProfile(uid);
      const animals = await DB.getAnimals(uid);
      const snapshots = await DB.getSnapshots(uid);

      const numero = snapshots.length + 1;
      const periode = Utils.getSemester();
      const now = new Date();

      // Contenu du snapshot (simplifié - même logique que le PDF)
      let contentForHash = `SNAPSHOT|${periode}|${numero}|${now.toISOString()}|`;

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(`Snapshot semestriel #${numero}`, 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Période : ${periode}`, 105, 28, { align: 'center' });
      doc.text(`Généré le : ${Utils.formatDate(now)}`, 105, 34, { align: 'center' });
      doc.text(`Éleveur : ${profile?.nom || '—'}`, 15, 45);
      doc.text(`SIRET : ${profile?.siret || '—'}`, 15, 50);

      let y = 60;

      for (const animal of animals) {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`${animal.nom} (${animal.espece})`, 15, y);
        contentForHash += `${animal.nom}|${animal.puce}|`;
        y += 5;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`ID: ${animal.puce || '—'} | Race: ${animal.race || '—'} | Statut: ${Utils.STATUTS_ANIMAL[animal.statut]}`, 15, y);
        y += 4;

        // Fetch des entrées santé une seule fois par animal (évite le double appel)
        const entries = await DB.getHealthEntries(uid, animal.id);

        // Conformité reproduction dans snapshot
        if (animal.sexe === 'femelle' && animal.statutReproducteur === 'nonSterilise' && animal.statut === 'actif') {
          const cesariennes = Utils.countCesariennes(entries);
          const portees2ans = Utils.countPortees2Ans(entries);
          const reproAlertes = Utils.analyseReproduction(animal, entries);
          doc.text(`  Repro Art.26 : Cesar. ${cesariennes}/3 | Portées 2ans ${portees2ans}/3${reproAlertes.length > 0 ? ' | ALERTES' : ' | OK'}`, 15, y);
          contentForHash += `repro|${cesariennes}|${portees2ans}|`;
          y += 4;
        }

        for (const entry of entries) {
          if (y > 270) { doc.addPage(); y = 15; }
          const typeLabel = Utils.TYPES_SANTE[entry.type]?.label || entry.type;
          doc.text(`  ${Utils.formatDate(entry.date)} — ${typeLabel} : ${(entry.titre || '').substring(0, 50)}`, 15, y);
          contentForHash += `${entry.type}|${entry.titre}|`;
          y += 4;
        }
        y += 4;
      }

      // Hash d'intégrité
      const hash = await Utils.sha256(contentForHash);

      // Ajouter le hash en bas de la dernière page
      doc.setFontSize(7);
      doc.text(`Hash SHA-256 : ${hash}`, 15, 290);

      // Sauvegarder le PDF localement
      const fileName = `snapshot_${periode}_${numero}.pdf`;
      _downloadPDF(doc, fileName);

      // Enregistrer dans Firestore
      await DB.addSnapshot(uid, {
        date: firebase.firestore.Timestamp.fromDate(now),
        numero: numero,
        periode: periode,
        pdfURL: '', // On ne fait pas d'upload Storage pour la v0.1, juste le download local
        hash: hash
      });

      // Mettre à jour le profil
      await DB.setUserProfile(uid, {
        dernierSnapshot: firebase.firestore.Timestamp.fromDate(now)
      });

      btn.disabled = false;
      btn.textContent = `Générer le snapshot ${Utils.getSemester()}`;
      UI.toast(`Snapshot ${periode} #${numero} généré !`, 'success');

      // Recharger la liste
      loadSnapshots(uid);

    } catch (err) {
      console.error('Erreur génération snapshot', err);
      btn.disabled = false;
      btn.textContent = `Générer le snapshot ${Utils.getSemester()}`;
      UI.toast('Erreur lors de la génération du snapshot', 'error');
    }
  }

  function addPageNumber(doc, pageWidth, pageHeight) {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(`Page ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  function getRaceLabel(animal) {
    if (!animal.race) return '—';
    if (animal.raceType === 'lof') return `${animal.race} (LOF)`;
    if (animal.raceType === 'loof') return `${animal.race} (LOOF)`;
    if (animal.raceType === 'apparence') return `d'apparence ${animal.race}`;
    if (animal.raceType === 'nonRace') return "N'appartient pas à une race";
    return animal.race;
  }

  return { render };
})();
