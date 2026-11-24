/* Talk Time: content + forgiving answer checking. Pure logic, no DOM (unit-tested in Node). */
(function (root) {
  'use strict';

  /* ---------------- content ----------------
     w  = word to say, e = picture, a = other answers we accept,
     x  = an "expansion" sentence (speech therapists model one step longer) */
  const WORDS = [
    // animals
    { e: '🐶', w: 'dog', a: ['doggy', 'doggie', 'puppy', 'dogs'], x: 'A happy dog. Woof woof!' },
    { e: '🐱', w: 'cat', a: ['kitty', 'kitten', 'cats'], x: 'A soft cat. Meow!' },
    { e: '🐄', w: 'cow', a: ['cows'], x: 'A big cow. Moo!' },
    { e: '🦆', w: 'duck', a: ['ducky', 'duckie', 'ducks'], x: 'A little duck. Quack quack!' },
    { e: '🐟', w: 'fish', a: ['fishy', 'fishes'], x: 'A fish. It swims in water.' },
    { e: '🐦', w: 'bird', a: ['birdie', 'birdy', 'birds'], x: 'A bird. It can fly.' },
    { e: '🐓', w: 'hen', a: ['chicken', 'chick'], x: 'A hen. Cluck cluck!' },
    { e: '🐴', w: 'horse', a: ['horsey', 'horsie', 'pony'], x: 'A horse. Clip clop!' },
    { e: '🐑', w: 'sheep', a: ['lamb'], x: 'A fluffy sheep. Baa!' },
    { e: '🦁', w: 'lion', a: ['lions'], x: 'A big lion. Roar!' },
    { e: '🐘', w: 'elephant', a: ['ellie', 'elefant'], x: 'A big elephant.' },
    { e: '🐒', w: 'monkey', a: ['monkeys'], x: 'A funny monkey.' },
    { e: '🐰', w: 'rabbit', a: ['bunny', 'bunnie'], x: 'A rabbit. Hop hop!' },
    { e: '🐸', w: 'frog', a: ['froggy', 'froggie'], x: 'A green frog. Ribbit!' },
    { e: '🐝', w: 'bee', a: ['bees'], x: 'A busy bee. Buzz!' },
    { e: '🐢', w: 'turtle', a: ['tortoise'], x: 'A slow turtle.' },
    // food and drink
    { e: '🍎', w: 'apple', a: ['apples'], x: 'A red apple. Yummy!' },
    { e: '🍌', w: 'banana', a: ['nana', 'bananas'], x: 'A yellow banana.' },
    { e: '🥭', w: 'mango', a: ['mangoes', 'mangos'], x: 'A sweet mango.' },
    { e: '🍇', w: 'grapes', a: ['grape'], x: 'Little grapes.' },
    { e: '🍊', w: 'orange', a: ['oranges'], x: 'A round orange.' },
    { e: '🥛', w: 'milk', a: ['milky'], x: 'A cup of milk.' },
    { e: '💧', w: 'water', a: ['wawa', 'waters'], x: 'Cool water.' },
    { e: '🥚', w: 'egg', a: ['eggs'], x: 'An egg.' },
    { e: '🎂', w: 'cake', a: ['cakes'], x: 'A birthday cake!' },
    { e: '🍚', w: 'rice', a: [], x: 'A bowl of rice.' },
    { e: '🍞', w: 'bread', a: [], x: 'Some bread.' },
    { e: '🍪', w: 'biscuit', a: ['cookie', 'biscuits', 'cookies'], x: 'A crunchy biscuit.' },
    // things
    { e: '⚽', w: 'ball', a: ['balls', 'football'], x: 'A round ball. Kick!' },
    { e: '🚗', w: 'car', a: ['cars'], x: 'A car. Beep beep!' },
    { e: '🚌', w: 'bus', a: ['buses'], x: 'A big bus.' },
    { e: '🚂', w: 'train', a: ['trains', 'choo choo'], x: 'A train. Choo choo!' },
    { e: '✈️', w: 'plane', a: ['aeroplane', 'airplane', 'planes'], x: 'A plane in the sky.' },
    { e: '⛵', w: 'boat', a: ['boats', 'ship'], x: 'A boat on the water.' },
    { e: '🚲', w: 'cycle', a: ['bicycle', 'bike'], x: 'A cycle. Ring ring!' },
    { e: '🥤', w: 'cup', a: ['cups', 'glass'], x: 'A cup.' },
    { e: '🥄', w: 'spoon', a: ['spoons'], x: 'A spoon for eating.' },
    { e: '🪑', w: 'chair', a: ['chairs'], x: 'A chair to sit on.' },
    { e: '🛏️', w: 'bed', a: ['beds'], x: 'A cosy bed.' },
    { e: '📕', w: 'book', a: ['books'], x: 'A book to read.' },
    { e: '👟', w: 'shoe', a: ['shoes'], x: 'A shoe for your foot.' },
    { e: '🧢', w: 'cap', a: ['hat', 'caps'], x: 'A cap for your head.' },
    { e: '🧸', w: 'teddy', a: ['teddy bear', 'bear', 'teddies'], x: 'A soft teddy.' },
    { e: '🎈', w: 'balloon', a: ['balloons'], x: 'A balloon. Pop!' },
    { e: '🔑', w: 'key', a: ['keys'], x: 'A key for the door.' },
    { e: '🕰️', w: 'clock', a: ['clocks'], x: 'A clock. Tick tock!' },
    { e: '🚪', w: 'door', a: ['doors'], x: 'Open the door.' },
    { e: '📱', w: 'phone', a: ['phones', 'mobile'], x: 'A phone. Hello!' },
    { e: '☂️', w: 'umbrella', a: ['brella'], x: 'An umbrella for the rain.' },
    // body
    { e: '👃', w: 'nose', a: ['noses'], x: 'Your nose. Sniff sniff!' },
    { e: '👂', w: 'ear', a: ['ears'], x: 'An ear for listening.' },
    { e: '👁️', w: 'eye', a: ['eyes', 'i'], x: 'An eye for seeing.' },
    { e: '✋', w: 'hand', a: ['hands'], x: 'A hand. Wave hello!' },
    { e: '🦶', w: 'foot', a: ['feet'], x: 'A foot for walking.' },
    { e: '👄', w: 'mouth', a: ['lips'], x: 'Your mouth for talking.' },
    // nature and people
    { e: '☀️', w: 'sun', a: ['sunny', 'son'], x: 'The hot sun.' },
    { e: '🌙', w: 'moon', a: ['moons'], x: 'The moon at night.' },
    { e: '⭐', w: 'star', a: ['stars'], x: 'A shiny star.' },
    { e: '🌳', w: 'tree', a: ['trees'], x: 'A tall tree.' },
    { e: '🌸', w: 'flower', a: ['flowers'], x: 'A pretty flower.' },
    { e: '🌧️', w: 'rain', a: ['raining'], x: 'Rain. Pitter patter!' },
    { e: '👶', w: 'baby', a: ['babies'], x: 'A little baby.' }
  ];

  /* "What does the ___ say?" */
  const SOUNDS = [
    { e: '🐄', n: 'cow', s: 'moo', a: ['mu', 'move', 'mooo', 'boo', 'moon'] },
    { e: '🐶', n: 'dog', s: 'woof woof', a: ['woof', 'wolf', 'bow wow', 'bow', 'wow', 'roof', 'boo'] },
    { e: '🐱', n: 'cat', s: 'meow', a: ['miaow', 'mew', 'me', 'now', 'mao', 'mia'] },
    { e: '🦆', n: 'duck', s: 'quack quack', a: ['quack', 'quake', 'crack', 'back', 'track'] },
    { e: '🐑', n: 'sheep', s: 'baa', a: ['ba', 'bah', 'bar', 'baaa', 'ma'] },
    { e: '🦁', n: 'lion', s: 'roar', a: ['raw', 'roll', 'row', 'ra', 'raa', 'war', 'rawr'] },
    { e: '🐓', n: 'hen', s: 'cluck cluck', a: ['cluck', 'bok', 'buck', 'click', 'luck'] },
    { e: '🐍', n: 'snake', s: 'hiss', a: ['his', 'sss', 'is', 'this', 'shh'] },
    { e: '🐝', n: 'bee', s: 'buzz', a: ['bus', 'buzzz', 'was', 'does', 'bzz'] },
    { e: '🐸', n: 'frog', s: 'ribbit', a: ['rabbit', 'ribit', 'rebbit', 'robert'] },
    { e: '🦉', n: 'owl', s: 'hoo hoo', a: ['hoo', 'who', 'hu', 'whoo', 'who who'] },
    { e: '🚂', n: 'train', s: 'choo choo', a: ['choo', 'chu', 'shoe', 'chew', 'two'] }
  ];

  /* Finish the line: we stop before the last word and let the child say it. */
  const RHYMES = [
    { e: '⭐', start: 'Twinkle, twinkle, little', w: 'star', a: ['stars', 'start'] },
    { e: '🐑', start: 'Baa, baa, black', w: 'sheep', a: ['ship', 'cheap'] },
    { e: '🥚', start: 'Humpty Dumpty sat on a', w: 'wall', a: ['ball', 'war', 'all', 'walls'] },
    { e: '🌧️', start: 'Rain, rain, go', w: 'away', a: ['way', 'a way'] },
    { e: '🚣', start: 'Row, row, row your', w: 'boat', a: ['boats', 'both', 'bought'] },
    { e: '⛰️', start: 'Jack and Jill went up the', w: 'hill', a: ['hills', 'heel', 'he'] },
    { e: '🚌', start: 'The wheels on the bus go round and', w: 'round', a: ['around', 'rounds'] },
    { e: '🚜', start: 'Old MacDonald had a', w: 'farm', a: ['firm', 'from', 'fun', 'far'] },
    { e: '🐑', start: 'Mary had a little', w: 'lamb', a: ['lam', 'lamp', 'land'] },
    { e: '🐒', start: 'Five little monkeys jumping on the', w: 'bed', a: ['bad', 'bread', 'bet'] },
    { e: '🦶', start: 'Head, shoulders, knees and', w: 'toes', a: ['toe', 'those', 'toys'] },
    { e: '🕰️', start: 'Hickory, dickory,', w: 'dock', a: ['doc', 'duck', 'dog', 'dark'] }
  ];

  /* Two-word phrases: the next step after single words at 2-3 years. */
  const PHRASES = [
    { e: '⚽', big: true, p: 'big ball' },
    { e: '🍎', p: 'red apple' },
    { e: '🥛', p: 'more milk' },
    { e: '👶💤', p: 'baby sleep' },
    { e: '👋', p: 'bye bye' },
    { e: '🚗💨', p: 'car go' },
    { e: '☕', p: 'hot tea' },
    { e: '👟👟', p: 'my shoes' },
    { e: '🎂', p: 'yummy cake' },
    { e: '🐟💧', p: 'fish swim' },
    { e: '🐦', p: 'bird fly' },
    { e: '🧼✋', p: 'wash hands' },
    { e: '🐶', p: 'hello doggy' },
    { e: '🌙', p: 'good night' },
    { e: '🍌', p: 'eat banana' }
  ];

  /* Prompts the parrot uses to suggest something to say. */
  const PARROT_PROMPTS = [
    'Say hello!', 'Say ball!', 'Say banana!', 'Say bye bye!', 'Say your name!',
    'Make a funny sound!', 'Say I love you!', 'Say mama!', 'Say papa!', 'Sing a song!',
    'Say yummy!', 'Say thank you!', 'Say good morning!', 'Say moo!', 'Laugh! Ha ha ha!'
  ];

  const PRAISE = ['Yes!', 'Well done!', 'Great talking!', 'Super!', 'You said it!', 'Lovely!', 'Good job!'];
  const TRY_PRAISE = ['Good try!', 'Nice try!', 'Lovely trying!', 'Almost!', 'Good talking!'];

  /* ---------------- matching ---------------- */
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * Toddler sound key: groups sounds that 2-3 year olds swap.
   *  k/g/c/q -> t/d (fronting: "tat" for cat), r/l/y -> w ("wabbit"), th -> d/f,
   *  s-clusters lose the s ("poon", "tar"), vowels merge, h is dropped.
   */
  function sk(w) {
    let x = norm(w).replace(/\s+/g, '');
    if (!x) return '';
    x = x.replace(/^s(?=[ptkmnlw])/, '')          // spoon -> poon, star -> tar
         .replace(/ph/g, 'f').replace(/th/g, 'd').replace(/sh|ch|tch|j|z|x/g, 's')
         .replace(/ck|qu|q|c(?=[aou]|$)|k|g/g, 't').replace(/c/g, 's')
         .replace(/[dt]/g, 't').replace(/[bp]/g, 'p').replace(/[fv]/g, 'f')
         .replace(/[rlwy]/g, 'w').replace(/[mn]/g, 'm').replace(/h/g, '')
         .replace(/[aeiou]+/g, 'a').replace(/(.)\1+/g, '$1');
    return x;
  }
  /** Sounds like the target, the way a toddler would say it. */
  function soundsLike(tok, target) {
    const a = sk(tok), b = sk(target);
    if (!a || !b || a.length < 2) return false;
    if (a === b) return true;
    if (b.length >= 4 && a[0] === b[0] && lev(a, b) <= 1) return true;
    if (a.length >= 2 && b.startsWith(a) && a.length >= b.length - 2) return true;   // dropped ending: "ba" ~ ball
    if (a.length >= 3 && b.endsWith(a)) return true;                                   // dropped start: "nana"
    return false;
  }

  /** Every phrase/word the recogniser offered, as normalised strings and single tokens. */
  function candidates(heard) {
    const list = (Array.isArray(heard) ? heard : [heard]).map(norm).filter(Boolean);
    const tokens = new Set();
    list.forEach(p => { tokens.add(p); p.split(' ').forEach(t => t && tokens.add(t)); });
    return { phrases: list, tokens: [...tokens] };
  }

  function strictHit(tok, target) {
    if (tok === target) return true;
    const L = target.length;
    if (L >= 5 && lev(tok, target) <= 1) return true;      // "elefant", "bananna"
    if (L >= 4 && Math.abs(tok.length - L) <= 1 && tok.length >= 3 && lev(tok, target) <= 1 && tok[0] === target[0]) return true; // toddler sound swaps / dropped endings: "bawl", "fis", "duk"
    return false;
  }

  function looseHit(tok, target) {
    if (!tok || !target) return false;
    const L = target.length;
    if (lev(tok, target) <= (L <= 3 ? 1 : 2)) return true;          // ball~bowl, dog~dug
    if (tok.length >= 3 && target.endsWith(tok)) return true;        // nana -> banana
    if (tok.length >= 2 && target.startsWith(tok) && L >= 3) return true; // "bana", "ele", "ca"
    if (tok.length === 2 && tok[0] === target[0] && /[aeiou]/.test(tok[1])) return true; // first syllable: "ba", "bo", "ka"
    if (tok[0] === target[0] && Math.abs(tok.length - L) <= 1 && L >= 3 && lev(tok, target) <= Math.ceil(L / 2)) return true;
    return false;
  }

  /**
   * Judge one turn.
   *  heard  = array of recogniser alternatives (may be empty)
   *  target = main word or phrase, accept = other accepted answers
   * returns 'yes' | 'close' | 'no'
   */
  function judge(heard, target, accept) {
    const t = norm(target);
    const ok = [t].concat((accept || []).map(norm)).filter(Boolean);
    const { phrases, tokens } = candidates(heard);
    if (!phrases.length) return 'no';

    // exact word or accepted variant anywhere in what was heard ("choochoo" counts as "choo choo")
    for (const o of ok) {
      if (o.includes(' ') && tokens.includes(o.replace(/ /g, ''))) return 'yes';
      if (o.includes(' ')) {
        if (phrases.some(p => (' ' + p + ' ').includes(' ' + o + ' '))) return 'yes';
      } else if (tokens.some(tok => strictHit(tok, o))) return 'yes';
    }
    // close enough to count as a real attempt at the word
    for (const o of ok) {
      const parts = o.split(' ');
      if (parts.some(part => part.length >= 2 && tokens.some(tok => looseHit(tok, part) || soundsLike(tok, part)))) return 'close';
      if (tokens.some(tok => soundsLike(tok, o))) return 'close';
    }
    return 'no';
  }

  /** Two-word phrase: 'yes' if both words, 'half' if one, else 'no'. */
  function judgePhrase(heard, phrase) {
    const words = norm(phrase).split(' ');
    const { phrases, tokens } = candidates(heard);
    if (!phrases.length) return 'no';
    const joined = words.join('');
    if (tokens.some(tok => tok === joined || (joined.length >= 6 && lev(tok, joined) <= 1))) return 'yes';
    let hits = 0, near = 0;
    for (const w of words) {
      if (tokens.some(tok => strictHit(tok, w))) hits++;
      else if (tokens.some(tok => looseHit(tok, w) || soundsLike(tok, w))) near++;
    }
    if (hits === words.length) return 'yes';
    if (hits + near >= words.length && hits >= 1) return 'yes';
    if (hits + near >= 1) return 'half';
    return 'no';
  }

  /** Shuffled bag: no repeats until every item has been used. */
  function Bag(items, rand) {
    const r = rand || Math.random;
    let pool = [];
    let last = null;
    this.next = function () {
      if (!pool.length) {
        pool = items.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        if (pool.length > 1 && pool[pool.length - 1] === last) { const t = pool[0]; pool[0] = pool[pool.length - 1]; pool[pool.length - 1] = t; }
      }
      last = pool.pop();
      return last;
    };
  }

  const pickOne = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const API = { WORDS, SOUNDS, RHYMES, PHRASES, PARROT_PROMPTS, PRAISE, TRY_PRAISE,
    norm, lev, sk, soundsLike, judge, judgePhrase, Bag, pickOne, cap };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Core = API;
})(typeof window !== 'undefined' ? window : globalThis);
