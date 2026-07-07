// Villager dialogue: DOM overlay + streaming client for the local LLM
// (proxied through server.js /api/chat, so any Ollama/OpenAI-compatible
// backend works). Each villager keeps its own conversation history and a
// system prompt rebuilt from live game state every time you talk.

const Dialogue = {
  world: null, villager: null, isOpen: false, busy: false, llm: null,

  init() {
    this.box = document.getElementById('dlg');
    this.head = document.getElementById('dlg-head');
    this.log = document.getElementById('dlg-log');
    this.input = document.getElementById('dlg-input');
    this.status = document.getElementById('dlg-status');
    this.input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') this.send();
      if (ev.key === 'Escape') this.close();
    });
    document.getElementById('dlg-send').addEventListener('click', () => this.send());
    document.getElementById('dlg-close').addEventListener('click', () => this.close());
    this.crow = document.getElementById('dlg-craft');
    document.getElementById('dlg-craft-btn').addEventListener('click', () => this.attemptWeave());
    this.qrow = document.getElementById('dlg-quest');
    document.getElementById('dlg-quest-btn').addEventListener('click', () => {
      this.qrow.style.display = 'none';
      if (this.world) this.world.acceptQuest('lostblade');
      const msg = QUESTS.lostblade.accept;
      this.villager.chat.push({ role: 'assistant', content: msg });
      this.addBubble('npc', msg);
    });
    this.srow = document.getElementById('dlg-shop');
    document.getElementById('dlg-shop-btn').addEventListener('click', () => {
      this.close();
      if (this.world) this.world.openShop();
    });
    fetch('/api/llm').then(r => r.json()).then(j => { this.llm = j; }).catch(() => { this.llm = { available: false }; });
  },

  openFor(entity, worldScene) {
    this.world = worldScene;
    this.villager = entity;
    this.isOpen = true;
    this.head.textContent = entity.name;
    // portrait: real face asset if one exists (face_<id> via assets/manifest.json),
    // else the villager's billboard art
    const face = document.getElementById('dlg-face');
    const faceArt = (typeof ART !== 'undefined') && (ART['face_' + entity.villager.id] || ART[entity.villager.art]);
    if (face && faceArt) face.src = faceArt.toDataURL();
    this.log.innerHTML = '';
    for (const m of entity.chat) {
      if (!m._hidden) this.addBubble(m.role === 'assistant' ? 'npc' : 'you', m.content);
    }
    this.status.textContent = this.llm && this.llm.available
      ? `voiced by ${this.llm.model} (${this.llm.kind})`
      : 'No local LLM detected — start Ollama, then reload the page.';
    this.status.className = this.llm && this.llm.available ? 'ok' : 'bad';
    this.box.style.display = 'flex';
    // defer focus one tick so the T keypress that opened us can't type into the input
    this.input.value = '';
    setTimeout(() => { this.input.value = ''; this.input.focus(); }, 0);
    // instant canned greeting on first meeting; the LLM picks it up from there
    if (entity.chat.length === 0 && entity.villager.greeting) {
      entity.chat.push({ role: 'assistant', content: entity.villager.greeting });
      this.addBubble('npc', entity.villager.greeting);
    }

    // Odo runs a shop
    this.srow.style.display = entity.villager.id === 'odo' ? 'flex' : 'none';

    // spellcraft hook (Xarthax weaves described spells into the world)
    this.crow.style.display = entity.villager.id === 'xarthax' ? 'flex' : 'none';

    // quest hooks (Bram's Lost Blade)
    this.qrow.style.display = 'none';
    if (entity.villager.id === 'bram') {
      const q = GameData.quests.lostblade;
      if (q !== 'done' && GameData.flags.hasLostBlade) {
        const msg = QUESTS.lostblade.complete;
        entity.chat.push({ role: 'assistant', content: msg });
        this.addBubble('npc', msg);
        this.world.completeQuest('lostblade');
      } else if (q === 'available') {
        this.qrow.style.display = 'flex';
      }
    }
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.box.style.display = 'none';
    if (this.world) this.world.dialogueClosed();
  },

  send() {
    const text = this.input.value.trim();
    if (!text || this.busy || !this.isOpen) return;
    this.input.value = '';
    this.villager.chat.push({ role: 'user', content: text });
    this.addBubble('you', text);
    this.request();
  },

  async request() {
    this.busy = true;
    const v = this.villager;
    const bubble = this.addBubble('npc', '…');
    const messages = [{ role: 'system', content: this.buildSystem(v) }]
      .concat(v.chat.slice(-10).map(m => ({ role: m.role, content: m.content })));

    let acc = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) throw new Error('the local LLM did not answer (' + res.status + ')');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let j; try { j = JSON.parse(line); } catch { continue; }
          if (j.error) throw new Error(j.error);
          if (j.delta) { acc += j.delta; this.setBubble(bubble, acc.trimStart()); }
        }
      }
      acc = acc.trim();
      if (!acc) throw new Error('an empty reply came back');
      this.setBubble(bubble, acc);
      v.chat.push({ role: 'assistant', content: acc });
    } catch (err) {
      this.setBubble(bubble, `(${v.name} seems lost in thought — ${err.message})`);
    }
    this.busy = false;
    if (this.isOpen) this.input.focus();
  },

  // Xarthax's weaving: conversation → strict-JSON LLM call → validated spec →
  // a real spell. The client-side validator is the authority (never eval).
  async attemptWeave() {
    if (this.busy || !this.isOpen || !this.villager) return;
    this.busy = true;
    const bubble = this.addBubble('npc', '…Xarthax closes his eyes and pulls at threads only he can see…');
    const talk = this.villager.chat.filter(m => !m._hidden).slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: craftSystemPrompt() }]
      .concat(talk)
      .concat([{ role: 'user', content: 'Weave the spell we discussed into the JSON now. Output only the JSON object.' }]);
    let acc = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) throw new Error('the shard is silent — is Ollama running?');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let j; try { j = JSON.parse(line); } catch (e2) { continue; }
          if (j.error) throw new Error(j.error);
          if (j.delta) acc += j.delta;
        }
      }
      const spec = extractJSON(acc);
      if (!spec) throw new Error('the threads tangled — describe your idea once more, plainly');
      const v2 = validateSpellSpec(spec);
      if (!v2.ok) throw new Error('the weave rejects it: ' + v2.errors.join(', '));
      spec.cost = v2.cost;
      const price = v2.cost * 15;
      if (GameData.gold < price) throw new Error(`such a weaving costs ${price} gold, and you carry but ${GameData.gold}`);
      const learner = GameData.party.find(x => x.hp > 0 && HERO_SCHOOLS[x.name].includes(spec.school));
      if (!learner) throw new Error(`none among you can hold ${SCHOOLS[spec.school] ? SCHOOLS[spec.school].name : spec.school} magic`);
      GameData.gold -= price;
      this.world.registerCraftedSpell(spec, learner);
      const done = `It is DONE! "${spec.name}" — ${spec.desc || 'a new thread in the weave'}. ` +
        `${learner.name} carries it now, ${spec.cost} mp a casting. That will be ${price} gold — already counted, naturally.`;
      this.setBubble(bubble, done);
      this.villager.chat.push({ role: 'assistant', content: done });
    } catch (err) {
      this.setBubble(bubble, `Xarthax frowns: "${err.message}."`);
    }
    this.busy = false;
    if (this.isOpen) this.input.focus();
  },

  buildSystem(v) {
    const w = this.world, cfg = v.villager;
    const enemies = w.entities.filter(e => e.kind === 'enemy');
    const chests = w.entities.filter(e => e.kind === 'chest');
    const byType = {};
    enemies.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
    const census = Object.entries(byType)
      .map(([t, n]) => `${n} ${t === 'wolf' ? 'dire wolf' : t}${n > 1 ? (t === 'wolf' ? 'ves' : 's') : ''}`)
      .join(', ') || 'none — the vale has been cleared';
    const nearest = list => list.reduce((a, b) =>
      (dist(a.x, a.y, START.x, START.y) <= dist(b.x, b.y, START.x, START.y) ? a : b));

    let facts = `Monsters still roaming the vale: ${census}. The fountain on the village green heals all wounds.`;
    if (cfg.specialty === 'chests') {
      facts += chests.length
        ? ` ${chests.length} treasure chest${chests.length > 1 ? 's' : ''} remain unclaimed out there; the nearest lies roughly ${dirName(nearest(chests).x - START.x, nearest(chests).y - START.y)} of the village.`
        : ' Every treasure chest in the vale has already been claimed.';
    } else if (cfg.specialty === 'monsters') {
      const wolves = enemies.filter(e => e.type === 'wolf');
      if (wolves.length) facts += ` The dire wolves hunt ${dirName(nearest(wolves).x - START.x, nearest(wolves).y - START.y)} of here — warn them.`;
    } else if (cfg.specialty === 'party') {
      const hurt = GameData.party.filter(h => h.hp < h.maxHp * 0.6);
      facts += hurt.length
        ? ` ${hurt.map(h => h.name).join(' and ')} look badly wounded; you would urge them to drink from the fountain.`
        : ' The party before you looks fit and battle-ready.';
    } else if (cfg.specialty === 'silly') {
      facts += ` You mostly gossip about frogs, chickens and village nonsense, though you did overhear that ${chests.length || 'no'} chests remain hidden in the vale.`;
    } else if (cfg.specialty === 'rumors') {
      facts += chests.length
        ? ` A guest whispered that treasure waits ${dirName(nearest(chests).x - START.x, nearest(chests).y - START.y)} of the village, and you repeat every word of it.`
        : ' Your guests say every treasure in the vale has been found.';
    } else if (cfg.specialty === 'wolves') {
      const wolves = enemies.filter(e => e.type === 'wolf');
      facts += wolves.length
        ? ` By your reckoning ${wolves.length} dire ${wolves.length > 1 ? 'wolves' : 'wolf'} still run the vale; the nearest pack prowls ${dirName(nearest(wolves).x - START.x, nearest(wolves).y - START.y)} of the village.`
        : ' You have run down the last of the dire wolves — the vale is clear of them, for now.';
    }

    if (cfg.id === 'bram') {
      const q = GameData.quests.lostblade;
      if (q === 'available') facts += ' Goblins stole your masterwork blade and hauled it east across the river ford. You dearly want these adventurers to bring it home — an offer sits before them.';
      else if (q === 'active') facts += ' These adventurers agreed to recover your stolen masterwork blade from a goblin camp east across the river ford. You are anxious for news.';
      else if (q === 'done') facts += ' These adventurers returned your stolen masterwork blade. You are overjoyed and forever in their debt.';
    }

    const party = GameData.party.map(h => `${h.name} the ${h.cls} (level ${h.level})`).join(', ');
    const abode = cfg.locale || 'You live in Emberfall, a tiny palisaded frontier village in a monster-haunted vale — it has a timbered town hall, a stone smithy, the Silver Stoat tavern, a plank-walled trading post, a well, and a healing fountain on the green. One gate faces east toward the wilds.';
    return `You are ${v.name}, ${cfg.persona} ${abode} You are usually found at ${cfg.home}. ` +
      `The adventurers speaking with you: ${party}. They carry ${GameData.gold} gold. ${facts} ` +
      `Stay in character at all times, medieval fantasy tone. Keep every reply to 1-3 short sentences of plain spoken dialogue — no narration, no asterisks, no lists. ` +
      `Never mention computers, games, models, or the modern world.`;
  },

  addBubble(kind, text) {
    const d = document.createElement('div');
    d.className = 'dlg-msg ' + kind;
    d.textContent = text;
    this.log.appendChild(d);
    this.log.scrollTop = this.log.scrollHeight;
    return d;
  },

  setBubble(el, text) {
    el.textContent = text;
    this.log.scrollTop = this.log.scrollHeight;
  },
};

document.addEventListener('DOMContentLoaded', () => Dialogue.init());
