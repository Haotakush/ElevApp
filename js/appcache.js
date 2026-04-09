/**
 * ElevApp — Module AppCache
 * Cache mémoire côté client avec TTL (60s par défaut)
 * Évite les allers-retours Firestore répétés lors de la navigation
 */

const AppCache = (() => {
  'use strict';

  const TTL = 60 * 1000; // 60 secondes
  const store = new Map();

  /** Lire depuis le cache. Retourne null si absent ou expiré. */
  function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL) {
      store.delete(key);
      return null;
    }
    return entry.data;
  }

  /** Écrire dans le cache. */
  function set(key, data) {
    store.set(key, { data, ts: Date.now() });
    return data;
  }

  /**
   * Helper : retourne la valeur en cache ou exécute fetchFn pour la remplir.
   * Usage : AppCache.getOrFetch('animals_uid123', () => DB.getAnimals(uid))
   */
  async function getOrFetch(key, fetchFn) {
    const cached = get(key);
    if (cached !== null) return cached;
    const data = await fetchFn();
    return set(key, data);
  }

  /**
   * Invalider toutes les entrées dont la clé commence par un préfixe.
   * Ex : AppCache.invalidate('animals_') → invalide le cache animaux de tous les users
   */
  function invalidate(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  /** Vider tout le cache (ex: lors d'un logout). */
  function clear() {
    store.clear();
  }

  return { get, set, getOrFetch, invalidate, clear };
})();
