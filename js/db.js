/**
 * ElevApp — Module Base de données
 * Firestore helpers + offline queue
 */

const DB = (() => {
  'use strict';

  let db = null;
  let storage = null;
  let offlineQueue = [];
  const QUEUE_KEY = 'elevapp_offline_queue';

  function init(firestore, firebaseStorage) {
    db = firestore;
    storage = firebaseStorage;
    // Activer la persistance offline Firestore
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistence : plusieurs onglets ouverts');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistence : navigateur non supporté');
      }
    });
    loadQueue();
    // Observer la connexion
    window.addEventListener('online', processQueue);
  }

  // ---- Offline Queue ----
  function loadQueue() {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      offlineQueue = saved ? JSON.parse(saved) : [];
    } catch { offlineQueue = []; }
    updateSyncBadge();
  }

  function saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch (e) { console.error('Erreur sauvegarde queue', e); }
    updateSyncBadge();
  }

  function addToQueue(operation) {
    offlineQueue.push({ ...operation, timestamp: Date.now() });
    saveQueue();
  }

  async function processQueue() {
    if (!navigator.onLine || offlineQueue.length === 0) return;
    const queue = [...offlineQueue];
    offlineQueue = [];
    saveQueue();

    for (const op of queue) {
      try {
        switch (op.type) {
          case 'set':
            await db.doc(op.path).set(op.data, { merge: true });
            break;
          case 'update':
            await db.doc(op.path).update(op.data);
            break;
          case 'delete':
            await db.doc(op.path).delete();
            break;
        }
      } catch (e) {
        console.error('Erreur sync queue item', e);
        offlineQueue.push(op);
      }
    }
    saveQueue();
    if (offlineQueue.length === 0) {
      UI.toast('Synchronisation terminée', 'success');
    }
  }

  function updateSyncBadge() {
    const badge = document.getElementById('sync-badge');
    const count = document.getElementById('sync-count');
    if (!badge || !count) return;
    if (offlineQueue.length > 0) {
      count.textContent = offlineQueue.length;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function getQueueCount() {
    return offlineQueue.length;
  }

  // ---- Profil Utilisateur ----
  async function getUserProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  }

  async function setUserProfile(uid, data) {
    await db.collection('users').doc(uid).set(data, { merge: true });
  }

  // ---- Animaux CRUD ----
  function animalsRef(uid) {
    return db.collection('users').doc(uid).collection('animals');
  }

  async function getAnimals(uid, filters = {}) {
    const hasFilters = filters.espece || filters.statut || filters.sexe;

    // Cache uniquement pour la requête sans filtre (cas le plus fréquent)
    if (!hasFilters && typeof AppCache !== 'undefined') {
      const cached = AppCache.get(`animals_${uid}`);
      if (cached) return cached;
    }

    // Requête simple sans index composite — filtrage côté client
    const snapshot = await animalsRef(uid).get();
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Tri par date de création décroissante (avant filtrage pour garder l'ordre)
    results.sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return db2 - da;
    });

    // Mettre en cache la liste complète avant filtrage
    if (!hasFilters && typeof AppCache !== 'undefined') {
      AppCache.set(`animals_${uid}`, results);
    }

    if (filters.espece) results = results.filter(a => a.espece === filters.espece);
    if (filters.statut) results = results.filter(a => a.statut === filters.statut);
    if (filters.sexe) results = results.filter(a => a.sexe === filters.sexe);

    return results;
  }

  async function getAnimal(uid, animalId) {
    const doc = await animalsRef(uid).doc(animalId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function addAnimal(uid, data) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const docData = { ...data, createdAt: now, updatedAt: now };
    const ref = await animalsRef(uid).add(docData);
    if (typeof AppCache !== 'undefined') AppCache.invalidate(`animals_${uid}`);
    return ref.id;
  }

  async function updateAnimal(uid, animalId, data) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await animalsRef(uid).doc(animalId).update({ ...data, updatedAt: now });
    if (typeof AppCache !== 'undefined') AppCache.invalidate(`animals_${uid}`);
  }

  async function deleteAnimal(uid, animalId) {
    // Supprimer aussi les entrées sanitaires
    const healthSnap = await healthRef(uid, animalId).get();
    const batch = db.batch();
    healthSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(animalsRef(uid).doc(animalId));
    await batch.commit();
    if (typeof AppCache !== 'undefined') {
      AppCache.invalidate(`animals_${uid}`);
      AppCache.invalidate(`allHealth_${uid}`);
    }
  }

  async function getAnimalsByIds(uid, ids) {
    if (!ids || ids.length === 0) return [];
    const results = [];
    for (const id of ids) {
      const animal = await getAnimal(uid, id);
      if (animal) results.push(animal);
    }
    return results;
  }

  async function getAnimalsBySex(uid, sexe) {
    // Requête simple sans index composite — filtrage côté client
    const snapshot = await animalsRef(uid).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(a => a.sexe === sexe && a.statut === 'actif')
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }

  // ---- Journal sanitaire CRUD ----
  function healthRef(uid, animalId) {
    return db.collection('users').doc(uid).collection('animals').doc(animalId).collection('health');
  }

  async function getHealthEntries(uid, animalId, filters = {}) {
    // Requête simple sans index composite — filtrage et tri côté client
    const snapshot = await healthRef(uid, animalId).get();
    let results = snapshot.docs.map(doc => ({ id: doc.id, animalId, ...doc.data() }));

    if (filters.type) results = results.filter(e => e.type === filters.type);

    results.sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
      const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
      return db2 - da;
    });

    return results;
  }

  async function getAllHealthEntries(uid) {
    // Cache AppCache si disponible
    if (typeof AppCache !== 'undefined') {
      const cached = AppCache.get(`allHealth_${uid}`);
      if (cached) return cached;
    }

    // Fetch animals + toutes les sous-collections en parallèle
    const animals = await getAnimals(uid);
    const allEntriesArrays = await Promise.all(
      animals.map(animal => getHealthEntries(uid, animal.id).then(entries =>
        entries.map(e => ({ ...e, animalNom: animal.nom, animalId: animal.id }))
      ))
    );

    const allEntries = allEntriesArrays.flat();
    allEntries.sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return db2 - da;
    });

    if (typeof AppCache !== 'undefined') AppCache.set(`allHealth_${uid}`, allEntries);
    return allEntries;
  }

  async function addHealthEntry(uid, animalId, data) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await healthRef(uid, animalId).add({ ...data, createdAt: now });
    if (typeof AppCache !== 'undefined') AppCache.invalidate(`allHealth_${uid}`);
    return ref.id;
  }

  async function updateHealthEntry(uid, animalId, entryId, data) {
    await healthRef(uid, animalId).doc(entryId).update(data);
    if (typeof AppCache !== 'undefined') AppCache.invalidate(`allHealth_${uid}`);
  }

  async function deleteHealthEntry(uid, animalId, entryId) {
    await healthRef(uid, animalId).doc(entryId).delete();
    if (typeof AppCache !== 'undefined') AppCache.invalidate(`allHealth_${uid}`);
  }

  // ---- Rappels vaccins (entries avec rappelDate) ----
  async function getUpcomingReminders(uid, days = 30) {
    // Réutilise getAllHealthEntries (qui est lui-même mis en cache)
    const allEntries = await getAllHealthEntries(uid);
    const reminders = [];
    const now = new Date();
    const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    for (const entry of allEntries) {
      if (entry.rappelDate) {
        const rappel = entry.rappelDate.toDate ? entry.rappelDate.toDate() : new Date(entry.rappelDate);
        if (rappel <= limit) {
          reminders.push({
            ...entry,
            rappelDate: rappel,
            isExpired: rappel < now
          });
        }
      }
    }

    reminders.sort((a, b) => a.rappelDate - b.rappelDate);
    return reminders;
  }

  // ---- Snapshots ----
  function snapshotsRef(uid) {
    return db.collection('users').doc(uid).collection('snapshots');
  }

  async function getSnapshots(uid) {
    const snapshot = await snapshotsRef(uid).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return db2 - da;
      });
  }

  async function addSnapshot(uid, data) {
    const ref = await snapshotsRef(uid).add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  // ---- Upload photo (stockage base64 dans Firestore, pas besoin de Storage) ----
  async function uploadPhoto(uid, animalId, blob) {
    // Utilise Firebase Storage via le module Storage
    if (typeof Storage !== 'undefined' && Storage.uploadAnimalPhoto) {
      // blob peut être un Blob (compressé) → on le convertit en File
      const file = blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
      return await Storage.uploadAnimalPhoto(uid, animalId, file);
    }
    // Fallback base64 si Storage non disponible
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function uploadDocument(uid, animalId, file) {
    if (typeof Storage !== 'undefined' && Storage.uploadAnimalDocument) {
      return await Storage.uploadAnimalDocument(uid, animalId, file);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- Chaleurs (cycles de reproduction) ----
  function chaleursRef(uid, animalId) {
    return db.collection('users').doc(uid).collection('animals').doc(animalId).collection('chaleurs');
  }

  async function getChaleurs(uid, animalId) {
    const snapshot = await chaleursRef(uid, animalId).get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, animalId, ...doc.data() }));
    results.sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
      const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
      return db2 - da; // Plus récente en premier
    });
    return results;
  }

  async function getChaleur(uid, animalId, chaleurId) {
    const doc = await chaleursRef(uid, animalId).doc(chaleurId).get();
    return doc.exists ? { id: doc.id, animalId, ...doc.data() } : null;
  }

  async function addChaleur(uid, animalId, data) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await chaleursRef(uid, animalId).add({ ...data, createdAt: now, updatedAt: now });
    return ref.id;
  }

  async function updateChaleur(uid, animalId, chaleurId, data) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await chaleursRef(uid, animalId).doc(chaleurId).update({ ...data, updatedAt: now });
  }

  async function deleteChaleur(uid, animalId, chaleurId) {
    await chaleursRef(uid, animalId).doc(chaleurId).delete();
  }

  return {
    init, processQueue, getQueueCount,
    getUserProfile, setUserProfile,
    getAnimals, getAnimal, addAnimal, updateAnimal, deleteAnimal,
    getAnimalsByIds, getAnimalsBySex,
    getHealthEntries, getAllHealthEntries, addHealthEntry, updateHealthEntry, deleteHealthEntry,
    getUpcomingReminders,
    getSnapshots, addSnapshot,
    uploadPhoto, uploadDocument,
    getChaleurs, getChaleur, addChaleur, updateChaleur, deleteChaleur
  };
})();
