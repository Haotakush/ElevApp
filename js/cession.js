/**
 * ElevApp — Module Certificat de Cession
 * Génération de certificats de cession conformes
 * Art. L214-8 Code rural, Arrêté du 19 juin 2025
 */

const Cession = (() => {
  'use strict';

  // Helper: download jsPDF doc as Blob to avoid iOS PWA navigation crash
  function _downloadPDF(doc, fileName) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  // ---- Formulaire de cession ----
  async function renderForm(animalId) {
    UI.setContent(`
      ${UI.pageHeader('Certificat de cession', animalId ? 'animal-detail' : 'exports')}
      <div class="skeleton skeleton-card"></div>
    `);

    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const [animals, profile] = await Promise.all([
        DB.getAnimals(uid),
        DB.getUserProfile(uid)
      ]);

      // Filtrer les animaux actifs seulement
      const animauxActifs = animals.filter(a => a.statut === 'actif');

      UI.setContent(`
        ${UI.pageHeader('Certificat de cession', animalId ? 'animal-detail' : 'exports')}

        <form id="cession-form">
          <!-- Sélection animal -->
          <div class="section-title"><span class="section-icon">🐾</span> Animal cédé</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label" for="cess-animal">Animal <span class="required">*</span></label>
              <select class="form-select" id="cess-animal" required>
                <option value="">Choisir un animal...</option>
                ${animauxActifs.map(a => `
                  <option value="${a.id}" ${a.id === animalId ? 'selected' : ''}>
                    ${Utils.escapeHtml(a.nom)} — ${Utils.getEspeceEmoji(a.espece)} ${Utils.escapeHtml(a.race || 'Race ?')}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Type de cession -->
          <div class="section-title"><span class="section-icon">📝</span> Type de cession</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label" for="cess-type">Type <span class="required">*</span></label>
              <select class="form-select" id="cess-type" required>
                <option value="vente">Vente</option>
                <option value="don">Don</option>
              </select>
            </div>
            <div class="form-group" id="prix-group">
              <label class="form-label" for="cess-prix">Prix TTC (€) <span class="required">*</span></label>
              <input class="form-input" type="number" id="cess-prix" min="0" step="0.01" placeholder="Ex: 1500.00">
            </div>
            <div class="form-group" id="paiement-group">
              <label class="form-label" for="cess-paiement">Mode de paiement</label>
              <select class="form-select" id="cess-paiement">
                <option value="virement">Virement bancaire</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
                <option value="cb">Carte bancaire</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="cess-date">Date de cession <span class="required">*</span></label>
              <input class="form-input" type="text" inputmode="numeric" placeholder="JJ/MM/AAAA" data-date-input="1" id="cess-date" required value="${Utils.todayInput()}">
            </div>
          </div>

          <!-- Infos acquéreur -->
          <div class="section-title"><span class="section-icon">👤</span> Acquéreur</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label" for="cess-acq-nom">Nom complet <span class="required">*</span></label>
              <input class="form-input" type="text" id="cess-acq-nom" required placeholder="Nom et prénom">
            </div>
            <div class="form-group">
              <label class="form-label" for="cess-acq-adresse">Adresse <span class="required">*</span></label>
              <textarea class="form-textarea" id="cess-acq-adresse" rows="2" required placeholder="Adresse complète"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="cess-acq-tel">Téléphone</label>
              <input class="form-input" type="tel" id="cess-acq-tel" placeholder="06 XX XX XX XX">
            </div>
            <div class="form-group">
              <label class="form-label" for="cess-acq-email">Email</label>
              <input class="form-input" type="email" id="cess-acq-email" placeholder="email@exemple.com">
            </div>
          </div>

          <!-- Documents fournis -->
          <div class="section-title"><span class="section-icon">📄</span> Documents remis</div>
          <div class="card mb-2">
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-doc-carnet" checked>
              <span>Carnet de santé / Passeport européen</span>
            </label>
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-doc-identification" checked>
              <span>Carte d'identification (I-CAD)</span>
            </label>
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-doc-certif-veto" checked>
              <span>Certificat vétérinaire (< 3 mois)</span>
            </label>
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-doc-cec">
              <span>Certificat d'engagement et de connaissance (CEC)</span>
            </label>
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-doc-pedigree">
              <span>Pedigree / Certificat LOF (ou LOOF pour les chats)</span>
            </label>
            <div class="form-hint mt-1">
              Le CEC doit être signé par l'acquéreur au moins 7 jours avant la cession (Art. L214-8-1).
            </div>
          </div>

          <!-- Obligations réglementaires -->
          <div class="section-title"><span class="section-icon">⚖️</span> Obligations réglementaires</div>
          <div class="card mb-2">
            <label class="form-toggle mb-1">
              <input type="checkbox" id="cess-presentation-mere" required>
              <span>La mère a été physiquement présentée à l'acquéreur <span class="required">*</span></span>
            </label>
            <div class="form-hint mb-1">
              Obligatoire avant toute cession (Arrêté du 19 juin 2025).
            </div>
            <label class="form-toggle mb-1" id="cess-sterilisation-group" style="display:none;">
              <input type="checkbox" id="cess-sterilisation-reforme">
              <span>L'animal réformé a été stérilisé avant cession</span>
            </label>
            <div class="form-hint" id="cess-sterilisation-hint" style="display:none;">
              Un animal réformé doit être stérilisé avant cession, sauf contre-indication vétérinaire écrite (Art. 26).
            </div>
            <label class="form-toggle mb-1" id="cess-contre-indication-group" style="display:none;">
              <input type="checkbox" id="cess-contre-indication-steril">
              <span>Contre-indication médicale à la stérilisation (certificat vétérinaire joint)</span>
            </label>
          </div>

          <!-- Observations -->
          <div class="section-title"><span class="section-icon">📋</span> Observations</div>
          <div class="card mb-2">
            <div class="form-group">
              <label class="form-label" for="cess-observations">Observations (optionnel)</label>
              <textarea class="form-textarea" id="cess-observations" rows="3" placeholder="Particularités, recommandations alimentaires, habitudes..."></textarea>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block mt-2 mb-3">
            📄 Générer le certificat de cession
          </button>
        </form>
      `);

      // Toggle prix/paiement selon type
      document.getElementById('cess-type').addEventListener('change', (e) => {
        const isDon = e.target.value === 'don';
        document.getElementById('prix-group').style.display = isDon ? 'none' : '';
        document.getElementById('paiement-group').style.display = isDon ? 'none' : '';
      });

      // Toggle stérilisation réformé selon animal sélectionné
      document.getElementById('cess-animal').addEventListener('change', (e) => {
        const selectedId = e.target.value;
        const animal = animauxActifs.find(a => a.id === selectedId);
        const isReforme = animal && animal.statut === 'reforme';
        document.getElementById('cess-sterilisation-group').style.display = isReforme ? '' : 'none';
        document.getElementById('cess-sterilisation-hint').style.display = isReforme ? '' : 'none';
        document.getElementById('cess-contre-indication-group').style.display = isReforme ? '' : 'none';
      });
      // Déclencher pour l'animal pré-sélectionné
      if (animalId) {
        const preSelected = animauxActifs.find(a => a.id === animalId);
        if (preSelected && preSelected.statut === 'reforme') {
          document.getElementById('cess-sterilisation-group').style.display = '';
          document.getElementById('cess-sterilisation-hint').style.display = '';
          document.getElementById('cess-contre-indication-group').style.display = '';
        }
      }

      // Submit
      document.getElementById('cession-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedAnimalId = document.getElementById('cess-animal').value;
        if (!selectedAnimalId) {
          UI.toast('Veuillez sélectionner un animal', 'error');
          return;
        }

        const animal = animauxActifs.find(a => a.id === selectedAnimalId);
        if (!animal) {
          UI.toast('Animal introuvable', 'error');
          return;
        }

        const healthEntries = await DB.getHealthEntries(uid, selectedAnimalId);

        const cessionData = {
          type: document.getElementById('cess-type').value,
          prix: document.getElementById('cess-prix').value || '0',
          paiement: document.getElementById('cess-paiement').value,
          date: (() => { const d = Utils.parseDateInput(document.getElementById('cess-date').value); return d ? d.toISOString().split('T')[0] : ''; })(),
          acquereur: {
            nom: document.getElementById('cess-acq-nom').value.trim(),
            adresse: document.getElementById('cess-acq-adresse').value.trim(),
            telephone: document.getElementById('cess-acq-tel').value.trim(),
            email: document.getElementById('cess-acq-email').value.trim()
          },
          documents: {
            carnet: document.getElementById('cess-doc-carnet').checked,
            identification: document.getElementById('cess-doc-identification').checked,
            certificatVeto: document.getElementById('cess-doc-certif-veto').checked,
            cec: document.getElementById('cess-doc-cec').checked,
            pedigree: document.getElementById('cess-doc-pedigree').checked
          },
          observations: document.getElementById('cess-observations').value.trim(),
          presentationMere: document.getElementById('cess-presentation-mere').checked,
          sterilisationReforme: document.getElementById('cess-sterilisation-reforme')?.checked || false,
          contreIndicationSteril: document.getElementById('cess-contre-indication-steril')?.checked || false
        };

        // Vérification présentation mère
        if (!cessionData.presentationMere) {
          UI.toast('La présentation de la mère est obligatoire', 'error');
          return;
        }

        // Avertissement stérilisation réformé
        if (animal.statut === 'reforme' && !cessionData.sterilisationReforme && !cessionData.contreIndicationSteril) {
          UI.toast('Un animal réformé doit être stérilisé ou avoir une contre-indication vétérinaire', 'error');
          return;
        }

        await generateCessionPDF(animal, healthEntries, cessionData, profile);
      });

    } catch (err) {
      console.error('Erreur formulaire cession', err);
      UI.setContent(`${UI.pageHeader('Erreur', 'exports')}<p class="text-center text-muted">Erreur de chargement</p>`);
    }
  }

  // ---- Génération PDF certificat de cession ----
  async function generateCessionPDF(animal, healthEntries, cessionData, profile) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let y = margin;

      const isVente = cessionData.type === 'vente';
      const dateCession = new Date(cessionData.date);

      // ---- TITRE ----
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(isVente ? 'ATTESTATION DE VENTE' : 'ATTESTATION DE CESSION', pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`${animal.espece === 'canin' ? 'Chien' : 'Chat'} — Art. L214-8 du Code rural`, pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.setFontSize(8);
      doc.text(`Conforme aux dispositions de l'arrêté du 19 juin 2025`, pageWidth / 2, y, { align: 'center' });
      y += 10;

      // ---- CÉDANT ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('CÉDANT (vendeur)', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const cedantLines = [
        `Nom : ${profile?.nom || '______________________________'}`,
        `Adresse : ${profile?.adresse || '______________________________'}`,
        `SIRET : ${profile?.siret || '______________________________'}`,
        `N° vétérinaire sanitaire : ${profile?.vetoSanitaire?.nom || '—'} — ${profile?.vetoSanitaire?.telephone || '—'}`
      ];
      cedantLines.forEach(line => {
        doc.text(line, margin + 2, y);
        y += 5;
      });
      y += 3;

      // ---- ACQUÉREUR ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('ACQUÉREUR', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const acqLines = [
        `Nom : ${cessionData.acquereur.nom}`,
        `Adresse : ${cessionData.acquereur.adresse}`,
        `Téléphone : ${cessionData.acquereur.telephone || '—'}`,
        `Email : ${cessionData.acquereur.email || '—'}`
      ];
      acqLines.forEach(line => {
        doc.text(line, margin + 2, y);
        y += 5;
      });
      y += 3;

      // ---- ANIMAL ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('ANIMAL', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      // Race display
      let raceLabel = animal.race || '—';
      if (animal.raceType === 'lof') raceLabel = `${animal.race} (inscrit au LOF)`;
      else if (animal.raceType === 'loof') raceLabel = `${animal.race} (inscrit au LOOF)`;
      else if (animal.raceType === 'apparence') raceLabel = `d'apparence ${animal.race}`;
      else if (animal.raceType === 'nonRace') raceLabel = "N'appartient pas à une race";

      const animalLines = [
        `Espèce : ${animal.espece === 'canin' ? 'Canine' : 'Féline'}`,
        `Nom : ${animal.nom}`,
        `Race : ${raceLabel}`,
        `Sexe : ${Utils.SEXES[animal.sexe] || '—'}`,
        `Date de naissance : ${Utils.formatDate(animal.dateNaissance)}${animal.dateNaissanceApprox ? ' (approximative)' : ''}`,
        `N° identification : ${animal.puce || '—'}`,
        `Couleur de la robe : ${animal.couleurRobe || '—'}`,
        `Signes particuliers : ${animal.signesParticuliers || 'Aucun'}`,
        `Reproducteur : ${Utils.STATUTS_REPRODUCTEUR[animal.statutReproducteur] || '—'}`
      ];
      animalLines.forEach(line => {
        doc.text(line, margin + 2, y);
        y += 5;
      });
      y += 3;

      // ---- ÉTAT SANITAIRE ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('ÉTAT SANITAIRE', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      // Derniers vaccins
      const vaccins = healthEntries.filter(e => e.type === 'vaccin');
      if (vaccins.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Vaccinations :', margin + 2, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        vaccins.slice(0, 5).forEach(v => {
          doc.text(`  • ${Utils.formatDate(v.date)} — ${(v.titre || '').substring(0, 60)}`, margin + 2, y);
          y += 4;
        });
        y += 2;
      } else {
        doc.text('Vaccinations : Aucune enregistrée', margin + 2, y);
        y += 5;
      }

      // Traitements en cours
      const traitements = healthEntries.filter(e =>
        e.type === 'traitement' || e.type === 'prophylaxie'
      );
      const traitementsRecents = traitements.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return Utils.daysBetween(d, new Date()) < 90;
      });
      if (traitementsRecents.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Traitements récents (< 3 mois) :', margin + 2, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        traitementsRecents.slice(0, 3).forEach(t => {
          doc.text(`  • ${Utils.formatDate(t.date)} — ${(t.titre || '').substring(0, 60)}`, margin + 2, y);
          y += 4;
        });
        y += 2;
      }

      // Check page overflow
      if (y > 220) {
        doc.addPage();
        y = margin;
      }

      // ---- CONFORMITÉ REPRODUCTION (si femelle non stérilisée) ----
      if (animal.sexe === 'femelle' && animal.statutReproducteur === 'nonSterilise') {
        const cesariennes = Utils.countCesariennes(healthEntries);
        const portees2ans = Utils.countPortees2Ans(healthEntries);
        const reproAlertes = Utils.analyseReproduction(animal, healthEntries);

        doc.setFillColor(240, 238, 234);
        doc.rect(margin, y - 1, contentWidth, 6, 'F');
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('CONFORMITÉ REPRODUCTION (Art. 26)', margin + 2, y + 3);
        y += 9;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Nombre de césariennes : ${cesariennes} / ${Utils.MAX_CESARIENNES} max`, margin + 2, y);
        y += 5;
        doc.text(`Portées sur 2 ans : ${portees2ans} / ${Utils.MAX_PORTEES_2ANS} max`, margin + 2, y);
        y += 5;

        if (reproAlertes.length > 0) {
          doc.setTextColor(200, 0, 0);
          reproAlertes.forEach(ra => {
            doc.text(`ATTENTION : ${ra.titre}`, margin + 2, y);
            y += 5;
          });
          doc.setTextColor(0, 0, 0);
        } else {
          doc.text('Aucune restriction de reproduction connue.', margin + 2, y);
          y += 5;
        }
        y += 3;
      }

      // Check page overflow
      if (y > 220) {
        doc.addPage();
        y = margin;
      }

      // ---- CONDITIONS DE CESSION ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('CONDITIONS DE CESSION', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      doc.text(`Date de cession : ${Utils.formatDate(dateCession)}`, margin + 2, y);
      y += 5;

      if (isVente) {
        doc.text(`Prix de vente TTC : ${parseFloat(cessionData.prix).toFixed(2)} €`, margin + 2, y);
        y += 5;
        const paiementLabels = {
          virement: 'Virement bancaire', cheque: 'Chèque',
          especes: 'Espèces', cb: 'Carte bancaire', autre: 'Autre'
        };
        doc.text(`Mode de paiement : ${paiementLabels[cessionData.paiement] || cessionData.paiement}`, margin + 2, y);
        y += 5;
      } else {
        doc.text('Cession à titre gratuit (don)', margin + 2, y);
        y += 5;
      }
      y += 2;

      // Documents remis
      doc.setFont(undefined, 'bold');
      doc.text('Documents remis à l\'acquéreur :', margin + 2, y);
      y += 5;
      doc.setFont(undefined, 'normal');

      const docsLabels = {
        carnet: 'Carnet de santé / Passeport européen',
        identification: 'Carte d\'identification (I-CAD)',
        certificatVeto: 'Certificat vétérinaire (< 3 mois)',
        cec: 'Certificat d\'engagement et de connaissance (CEC)',
        pedigree: 'Pedigree / Certificat LOF (LOOF)'
      };
      Object.entries(cessionData.documents).forEach(([key, checked]) => {
        if (checked) {
          doc.text(`  ✓ ${docsLabels[key]}`, margin + 2, y);
          y += 4;
        }
      });
      y += 3;

      // Obligations réglementaires
      doc.setFont(undefined, 'bold');
      doc.text('Obligations réglementaires (Arrêté du 19 juin 2025) :', margin + 2, y);
      y += 5;
      doc.setFont(undefined, 'normal');
      doc.text(`  ✓ Présentation physique de la mère à l'acquéreur : ${cessionData.presentationMere ? 'OUI' : 'NON'}`, margin + 2, y);
      y += 4;
      if (animal.statut === 'reforme') {
        if (cessionData.sterilisationReforme) {
          doc.text('  ✓ Animal réformé stérilisé avant cession', margin + 2, y);
        } else if (cessionData.contreIndicationSteril) {
          doc.text('  ✓ Contre-indication médicale à la stérilisation (certificat vétérinaire joint)', margin + 2, y);
        }
        y += 4;
      }
      y += 3;

      // Observations
      if (cessionData.observations) {
        doc.setFont(undefined, 'bold');
        doc.text('Observations :', margin + 2, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const obsLines = doc.splitTextToSize(cessionData.observations, contentWidth - 4);
        obsLines.forEach(line => {
          if (y > 270) { doc.addPage(); y = margin; }
          doc.text(line, margin + 2, y);
          y += 4;
        });
        y += 3;
      }

      // Check page overflow
      if (y > 210) {
        doc.addPage();
        y = margin;
      }

      // ---- MENTIONS LÉGALES ----
      doc.setFillColor(240, 238, 234);
      doc.rect(margin, y - 1, contentWidth, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('MENTIONS LÉGALES OBLIGATOIRES', margin + 2, y + 3);
      y += 9;

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');

      const mentions = [];
      if (isVente) {
        mentions.push(
          `GARANTIE LÉGALE — Vices rédhibitoires (Art. L213-1 à L213-9 Code rural) : l'acquéreur dispose d'un délai de 30 jours`,
          `à compter de la livraison pour agir en garantie des vices rédhibitoires.`,
          `Vices rédhibitoires ${animal.espece === 'canin' ? 'canins' : 'félins'} : ${(Utils.VICES_REDHIBITOIRES[animal.espece] || []).join(', ')}.`,
          ``,
          `GARANTIE LÉGALE DES DÉFAUTS CACHÉS (Art. 1641 à 1649 Code civil) : le vendeur est tenu de la garantie`,
          `à raison des défauts cachés de la chose vendue. Délai d'action : 2 ans à compter de la découverte du vice.`,
          ``,
          `DROIT DE RÉTRACTATION — En cas de vente à distance, l'acquéreur dispose d'un délai de 14 jours à compter`,
          `du jour de la livraison de l'animal pour exercer son droit de rétractation (Art. L221-18 Code de la consommation).`
        );
      }

      mentions.push(
        ``,
        `CERTIFICAT D'ENGAGEMENT ET DE CONNAISSANCE (CEC) — Art. L214-8-1 du Code rural :`,
        `l'acquéreur atteste avoir signé le CEC au moins 7 jours avant la présente cession.`,
        ``,
        `IDENTIFICATION — L'animal doit être identifié (puce électronique ou tatouage) préalablement à toute cession`,
        `(Art. L212-10 Code rural). Le changement de détenteur doit être déclaré à l'I-CAD.`,
        ``,
        `ÂGE MINIMUM DE CESSION — ${animal.espece === 'canin' ? '8 semaines' : '8 semaines'} révolues (Art. L214-8 Code rural).`
      );

      mentions.forEach(line => {
        if (y > 280) { doc.addPage(); y = margin; }
        doc.text(line, margin + 2, y);
        y += 3.5;
      });
      y += 5;

      // Check page overflow
      if (y > 240) {
        doc.addPage();
        y = margin;
      }

      // ---- SIGNATURES ----
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text('Fait en deux exemplaires originaux.', margin + 2, y);
      y += 8;

      doc.text(`Fait à __________________, le ${Utils.formatDate(dateCession)}`, margin + 2, y);
      y += 12;

      // Signature boxes
      const boxWidth = (contentWidth - 10) / 2;
      doc.setDrawColor(180);

      // Cédant
      doc.rect(margin, y, boxWidth, 30);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('Le Cédant', margin + boxWidth / 2, y + 5, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.text('(signature précédée de la mention', margin + boxWidth / 2, y + 10, { align: 'center' });
      doc.text('"Lu et approuvé")', margin + boxWidth / 2, y + 14, { align: 'center' });

      // Acquéreur
      const box2X = margin + boxWidth + 10;
      doc.rect(box2X, y, boxWidth, 30);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('L\'Acquéreur', box2X + boxWidth / 2, y + 5, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.text('(signature précédée de la mention', box2X + boxWidth / 2, y + 10, { align: 'center' });
      doc.text('"Lu et approuvé")', box2X + boxWidth / 2, y + 14, { align: 'center' });

      // ---- Numéro de page ----
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(`Page ${i}/${totalPages} — ElevApp — Document généré le ${Utils.formatDate(new Date())}`, pageWidth / 2, 290, { align: 'center' });
      }

      // Sauvegarder
      const typeLabel = isVente ? 'vente' : 'cession';
      const fileName = `certificat_${typeLabel}_${animal.nom.replace(/\s+/g, '_')}_${cessionData.date}.pdf`;
      _downloadPDF(doc, fileName);

      UI.toast('Certificat de cession généré !', 'success');

    } catch (err) {
      console.error('Erreur génération certificat', err);
      UI.toast('Erreur lors de la génération du certificat', 'error');
    }
  }

  return { renderForm };
})();
