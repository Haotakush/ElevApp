/**
 * ElevApp — Firebase Storage
 * Upload/download photos et documents des animaux
 */

const Storage = (() => {
  let storageRef = null;

  function init() {
    if (typeof firebase !== 'undefined' && firebase.storage) {
      storageRef = firebase.storage().ref();
    }
  }

  // ── Photos animaux ──────────────────────────────────────────────────────────

  async function uploadAnimalPhoto(uid, animalId, file) {
    if (!storageRef) throw new Error('Storage non initialisé');
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
    if (!allowed.includes(ext)) throw new Error('Format non supporté (jpg, png, webp)');
    if (file.size > 5 * 1024 * 1024) throw new Error('Fichier trop lourd (max 5 Mo)');

    const ref = storageRef.child(`users/${uid}/animals/${animalId}/photo.${ext}`);
    const snap = await ref.put(file, { contentType: file.type });
    return await snap.ref.getDownloadURL();
  }

  async function deleteAnimalPhoto(uid, animalId) {
    if (!storageRef) return;
    try {
      // Essaie les extensions courantes
      for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'heic']) {
        try {
          await storageRef.child(`users/${uid}/animals/${animalId}/photo.${ext}`).delete();
          return;
        } catch {}
      }
    } catch {}
  }

  // ── Documents animaux ───────────────────────────────────────────────────────

  async function uploadAnimalDocument(uid, animalId, file) {
    if (!storageRef) throw new Error('Storage non initialisé');
    if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop lourd (max 10 Mo)');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `users/${uid}/animals/${animalId}/documents/${Date.now()}_${safeName}`;
    const ref = storageRef.child(path);
    const snap = await ref.put(file, { contentType: file.type });
    const url = await snap.ref.getDownloadURL();
    return { url, nom: file.name, path, taille: file.size, type: file.type, date: new Date().toISOString() };
  }

  async function deleteAnimalDocument(path) {
    if (!storageRef || !path) return;
    try { await storageRef.child(path).delete(); } catch {}
  }

  async function listAnimalDocuments(uid, animalId) {
    if (!storageRef) return [];
    try {
      const listRef = storageRef.child(`users/${uid}/animals/${animalId}/documents`);
      const result = await listRef.listAll();
      const docs = await Promise.all(result.items.map(async item => {
        const url = await item.getDownloadURL();
        const meta = await item.getMetadata();
        return { url, nom: meta.name.replace(/^\d+_/, ''), path: item.fullPath, taille: meta.size, type: meta.contentType };
      }));
      return docs;
    } catch { return []; }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  return {
    init,
    uploadAnimalPhoto, deleteAnimalPhoto,
    uploadAnimalDocument, deleteAnimalDocument, listAnimalDocuments,
    formatFileSize
  };
})();
