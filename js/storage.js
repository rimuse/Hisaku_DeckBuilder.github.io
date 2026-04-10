/**
 * Storage — localStorage CRUD for cards, skills, ougi.
 */
const Storage = (() => {
  const KEY = { cards: 'hisaku_cards', skills: 'hisaku_skills', ougi: 'hisaku_ougi' };

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function persist(key, list) { localStorage.setItem(key, JSON.stringify(list)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function makeStore(key) {
    return {
      getAll() { return load(key); },
      get(id)  { return load(key).find(x => x.id === id) || null; },
      save(item) {
        const list = load(key);
        if (item.id) {
          const i = list.findIndex(x => x.id === item.id);
          if (i >= 0) list[i] = item; else list.push(item);
        } else {
          item.id = uid();
          list.push(item);
        }
        persist(key, list);
        return item;
      },
      delete(id) { persist(key, load(key).filter(x => x.id !== id)); }
    };
  }

  return {
    cards:  makeStore(KEY.cards),
    skills: makeStore(KEY.skills),
    ougi:   makeStore(KEY.ougi)
  };
})();
