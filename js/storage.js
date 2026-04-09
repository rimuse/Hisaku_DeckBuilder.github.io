const Storage = (() => {
  const KEYS = { cards: 'hisaku_cards', skills: 'hisaku_skills', ougi: 'hisaku_ougi' };

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Cards
  const cards = {
    getAll: () => load(KEYS.cards),
    get: (id) => load(KEYS.cards).find(c => c.id === id),
    save: (card) => {
      const list = load(KEYS.cards);
      if (card.id) {
        const idx = list.findIndex(c => c.id === card.id);
        if (idx >= 0) list[idx] = card; else list.push(card);
      } else {
        card.id = genId();
        list.push(card);
      }
      save(KEYS.cards, list);
      return card;
    },
    delete: (id) => {
      const list = load(KEYS.cards).filter(c => c.id !== id);
      save(KEYS.cards, list);
    }
  };

  // Skills
  const skills = {
    getAll: () => load(KEYS.skills),
    get: (id) => load(KEYS.skills).find(s => s.id === id),
    save: (skill) => {
      const list = load(KEYS.skills);
      if (skill.id) {
        const idx = list.findIndex(s => s.id === skill.id);
        if (idx >= 0) list[idx] = skill; else list.push(skill);
      } else {
        skill.id = genId();
        list.push(skill);
      }
      save(KEYS.skills, list);
      return skill;
    },
    delete: (id) => {
      const list = load(KEYS.skills).filter(s => s.id !== id);
      save(KEYS.skills, list);
    }
  };

  // Ougi
  const ougi = {
    getAll: () => load(KEYS.ougi),
    get: (id) => load(KEYS.ougi).find(o => o.id === id),
    save: (item) => {
      const list = load(KEYS.ougi);
      if (item.id) {
        const idx = list.findIndex(o => o.id === item.id);
        if (idx >= 0) list[idx] = item; else list.push(item);
      } else {
        item.id = genId();
        list.push(item);
      }
      save(KEYS.ougi, list);
      return item;
    },
    delete: (id) => {
      const list = load(KEYS.ougi).filter(o => o.id !== id);
      save(KEYS.ougi, list);
    }
  };

  return { cards, skills, ougi };
})();
