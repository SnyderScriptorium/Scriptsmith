/**
 * character-visuals.js — Procedural, offline character portrait generator.
 *
 * IMPORTANT PRODUCT PRINCIPLE: ScriptSmith is an offline-first, "No AI" product
 * (see README: "AI is intentionally outside the ScriptSmith product scope").
 * This module honors that principle: portraits are deterministic SVG drawings
 * composed from the character's own record data plus a seeded PRNG. There are
 * no network calls, no API keys, no cloud services, and no dependencies.
 *
 * What drives the portrait:
 *  - appearance + summary text: hair color/style, skin tone, eye color,
 *    beard/mustache, glasses, age markers (old/young), hat, scar, freckles,
 *    tattoo, earrings, necklace — matched with plain keyword regexes.
 *  - fashion text: clothing style (suit, dress, armor, cloak, robe, hoodie,
 *    uniform, leather) and clothing color.
 *  - seeded PRNG (seeded by character id + stored portraitSeed): everything
 *    not specified — background palette, clothing color/style, face
 *    proportions, mouth variant, hair color/style when undescribed.
 *  - sparse data (no appearance/fashion text): a pleasant monogram/initial
 *    avatar instead of a portrait.
 *
 * Only the SEED is stored on the record (record.portraitSeed); the SVG is
 * regenerated deterministically whenever it is needed.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (xmur3 + mulberry32). Pure functions, no DOM.
// ---------------------------------------------------------------------------

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;
const weighted = (rng, pairs) => {
  let x = rng(), acc = 0;
  for (const [v, w] of pairs) { acc += w; if (x <= acc) return v; }
  return pairs[pairs.length - 1][0];
};

function shade(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v));
  const r = c((n >> 16) + amt), g = c(((n >> 8) & 255) + amt), b = c((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const escXml = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const SKIN_TONES = ['#f7e0c6', '#f0cfa8', '#e2b183', '#c98f60', '#a06a42', '#7a4c2c', '#57351f'];

const HAIR_COLORS = {
  blonde: '#e3bd63', red: '#a8441f', auburn: '#6e3420', brown: '#4a2e1b',
  black: '#1d1410', gray: '#9b9b9b', white: '#e9e9e9',
};

const EYE_COLORS = { blue: '#4a7fae', green: '#4f8f5a', brown: '#5a3a22', hazel: '#8a6b2f', gray: '#7d8a94', amber: '#b07a2a' };

const CLOTH_COLORS = ['#3b4a6b', '#6b3b3b', '#3f6b4a', '#5a4a7a', '#2f2f33', '#7a6a4a', '#8a3b5a', '#476b7a', '#94552e'];
const TIE_COLORS = ['#8a2f2f', '#2f4a8a', '#2f6b4a', '#b08a3a', '#5a2f6b'];
const HAT_COLORS = ['#4a3b2c', '#2f3a4a', '#5a2f2f', '#3a4a3a', '#6b5a3a'];

const BG_PAIRS = [
  ['#2e3a52', '#66788f'], ['#4a2e3a', '#8f5f6b'], ['#2e4a3a', '#6b8f5f'],
  ['#3a2e52', '#6f5f8f'], ['#523a1e', '#a07a3f'], ['#1e3a4a', '#4f7a8f'],
  ['#402428', '#7a4a52'], ['#2b3a2b', '#5f7a5f'],
];

const FASHION_COLORS = [
  ['red', '#b03a3a', /\bred\b/], ['blue', '#3a5a9a', /\bblue\b/],
  ['green', '#3f7a4a', /\bgreen\b/], ['black', '#23232b', /\bblack\b/],
  ['white', '#e8e2d4', /\bwhite\b/], ['purple', '#6a4a8a', /\bpurple\b|\bviolet\b/],
  ['gold', '#b08a3a', /\bgold(?:en)?\b/], ['gray', '#8a8f96', /\bsilver\b|\bgray\b|\bgrey\b/],
  ['brown', '#5a3a2a', /\bbrown\b/], ['pink', '#b06a8a', /\bpink\b|\brose\b/],
];

// ---------------------------------------------------------------------------
// Keyword trait extraction — appearance/summary drive the body, fashion
// drives the clothing. Returns hints; null means "not specified".
// ---------------------------------------------------------------------------

function firstMatch(text, pairs) {
  for (const [key, re] of pairs) {
    const ci = re.ignoreCase ? re : new RegExp(re.source, 'i');
    if (ci.test(text)) return key;
  }
  return null;
}

export function parseTraits(record) {
  const r = record || {};
  const body = `${r.appearance || ''} ${r.summary || ''}`;
  const fashion = `${r.fashion || ''}`;

  const hairColor = firstMatch(body, [
    ['gray', /\bgr[ae]y(?:-haired)?\b|\bgrizzled\b/],
    ['white', /\bwhite hair\b|\bsilver(?:-haired)?\b|\bplatinum\b/],
    ['red', /\bred(?:dish)?\b|\bginger\b|\bauburn\b|\bstrawberry\b/],
    ['blonde', /\bblond(?:e)?\b|\bgolden\b|\bfair-haired\b/],
    ['brown', /\bbrown\b|\bbrunette\b|\bchestnut\b|\bdark-haired\b/],
    ['black', /\bblack\b|\braven\b|\bjet\b/],
  ]);

  const hairStyle = firstMatch(body, [
    ['bald', /\bbald\b|\bshaved head\b|\bshaven\b/],
    ['buzz', /\bbuzz ?cut\b|\bmilitary cut\b|\bcropped\b/],
    ['short', /\bshort(?:-cropped)? hair\b/],
    ['afro', /\bafro\b/],
    ['dreads', /\bdreadlocks?\b|\bdreads\b|\blocs\b/],
    ['braids', /\bbraids?\b|\bcornrows?\b|\bplaits?\b/],
    ['ponytail', /\bponytail\b|\bpigtails?\b/],
    ['bun', /\bbun\b|\btop ?knot\b|\bchignon\b/],
    ['long', /\blong\b[\w\s-]{0,20}\bhair\b|\bwaist[ -]?length\b|\bflowing hair\b/],
    ['medium', /\bshoulder[ -]?length\b|\bmedium[ -]?length\b|\bbob\b|\bwavy\b|\bwaves\b|\bstraight\b/],
    ['curly', /\bcurly\b|\bcurls\b|\bringlets\b/],
    ['messy', /\bmessy\b|\bunkempt\b|\btousled\b|\bwild hair\b/],
  ]);

  const skinName = firstMatch(body, [
    ['ebony', /\bebony\b|\bvery dark\b|\bdeep brown\b/],
    ['dark', /\bdark[ -]?skinned?\b|\bdark skin\b|\bdark complexion\b/],
    ['brownskin', /\bbrown[ -]?skinned?\b|\bbrown skin\b/],
    ['tan', /\btan\b|\btanned\b|\bolive[ -]?skinned?\b|\bolive skin\b|\bmedium[ -]?skinned?\b|\bbronze\b/],
    ['pale', /\bpale\b|\bfair[ -]?skinned?\b|\blight[ -]?skinned?\b|\bporcelain\b|\bivory\b/],
  ]);
  const skin = skinName === 'ebony' ? 6 : skinName === 'dark' ? 5 : skinName === 'brownskin' ? 4
    : skinName === 'tan' ? 2 : skinName === 'pale' ? 0 : null;

  const eyeM = body.match(/\b(blue|green|brown|hazel|gr[ae]y|amber|violet) eyes?\b/i);
  const eyeWord = eyeM ? eyeM[1].toLowerCase() : null;
  const eye = eyeWord ? (/^gr[ae]y$/.test(eyeWord) ? 'gray' : eyeWord) : null;

  const beard = firstMatch(body, [
    ['beard', /\bbeard\b/],
    ['goatee', /\bgoatee\b/],
    ['mustache', /\bmou?stache\b/],
    ['stubble', /\bstubble\b|\bfive o'clock shadow\b|\bunshaven\b/],
  ]);

  const glasses = firstMatch(body, [
    ['sunglasses', /\bsunglasses\b|\bshades\b|\bdark glasses\b/],
    ['glasses', /\bglasses\b|\bspectacles\b|\bbespectacled\b|\bwire[ -]?rim\b/],
  ]);

  const old = /\b(old|elderly|aged|ancient|wrinkled|senior|grandmother|grandfather)\b/i.test(body);
  const young = !old && /\b(young|youthful|teen(?:age[dr]?)?|adolescent|child|kid)\b/i.test(body);

  const hat = firstMatch(`${body} ${fashion}`, [
    ['beanie', /\bbeanie\b|\bknit cap\b|\btoque\b|\bwool(?:ly|en)? hat\b/],
    ['cap', /\bbaseball cap\b|\bflat cap\b/],
    ['wide', /\bfedora\b|\bwide[ -]?brim\b|\bcowboy hat\b|\btop hat\b|\bsun ?hat\b/],
    ['hood', /\bhood(?:ed)?\b/],
  ]);

  const clothingStyle = firstMatch(fashion, [
    ['suit', /\bsuit\b|\btuxedo\b|\bblazer\b/],
    ['dress', /\bdress\b|\bgown\b/],
    ['armor', /\barmor\b|\barmour\b|\bchainmail\b/],
    ['cloak', /\bcloak\b|\bcape\b|\bmantle\b/],
    ['robe', /\brobe\b|\bkimono\b|\bcassock\b|\bhabit\b/],
    ['hoodie', /\bhoodie\b|\bsweatshirt\b/],
    ['uniform', /\buniform\b/],
    ['leather', /\bleather\b/],
  ]);

  let clothingColor = null;
  for (const [, hex, re] of FASHION_COLORS) if (re.test(fashion)) { clothingColor = hex; break; }

  return {
    hairColor, hairStyle, skin, eye, beard, glasses, old, young, hat,
    scar: /\bscar(?:red)?\b/i.test(body),
    freckles: /\bfreckle/i.test(body),
    tattoo: /\btattoo|\binked\b/i.test(body),
    earrings: /\bearrings?\b/i.test(`${body} ${fashion}`),
    necklace: /\bnecklace\b|\bpendant\b|\blocked\b|\bchoker\b/i.test(`${body} ${fashion}`),
    clothingStyle, clothingColor,
  };
}

// ---------------------------------------------------------------------------
// Seed handling. Only the seed is stored on the record.
// ---------------------------------------------------------------------------

export function getPortraitSeed(record) {
  const r = record || {};
  const s = r.portraitSeed;
  if (Number.isFinite(s)) return Math.floor(s) >>> 0;
  // Stable default derived from the character id — identical every load.
  return xmur3(String(r.id || 'noid'))() >>> 0;
}

export function newPortraitSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

function rngFor(record, seed) {
  return mulberry32(xmur3(`${record.id || 'noid'}:${seed}`)());
}

// Fill in everything the record did not specify, deterministically.
function resolveTraits(h, rng) {
  const t = { ...h };
  t.hairColor = h.hairColor || weighted(rng, [['brown', .30], ['black', .24], ['blonde', .14], ['gray', .12], ['red', .08], ['white', .06], ['auburn', .06]]);
  // Braids/dreads are only ever keyword-driven, never randomized.
  t.hairStyle = h.hairStyle || weighted(rng, [['short', .36], ['medium', .20], ['long', .16], ['curly', .08], ['buzz', .06], ['ponytail', .05], ['bun', .04], ['bald', .03], ['messy', .02]]);
  t.skinIdx = h.skin ?? weighted(rng, [[0, .16], [1, .20], [2, .20], [3, .16], [4, .12], [5, .09], [6, .07]]);
  t.eye = h.eye || weighted(rng, [['brown', .40], ['blue', .20], ['green', .14], ['hazel', .12], ['gray', .08], ['amber', .06]]);
  t.beard = h.beard || (chance(rng, .12) ? pick(rng, ['beard', 'goatee', 'mustache', 'stubble']) : null);
  t.clothingStyle = h.clothingStyle || weighted(rng, [['casual', .52], ['suit', .10], ['dress', .10], ['hoodie', .08], ['robe', .05], ['cloak', .05], ['uniform', .05], ['leather', .05]]);
  t.clothingColor = h.clothingColor || pick(rng, CLOTH_COLORS);
  t.bg = pick(rng, BG_PAIRS);
  t.bgPattern = weighted(rng, [['halo', .40], ['rays', .25], ['dots', .20], ['plain', .15]]);
  t.faceRx = 40 + Math.floor(rng() * 8);
  t.faceRy = 54 + Math.floor(rng() * 7);
  t.mouth = weighted(rng, [['smile', .45], ['soft', .25], ['neutral', .20], ['open', .10]]);
  t.tieColor = pick(rng, TIE_COLORS);
  t.hatColor = pick(rng, HAT_COLORS);
  t.dotSeed = Math.floor(rng() * 1e9);
  return t;
}

// ---------------------------------------------------------------------------
// Portrait SVG builder — flat, abstract-stylized bust. viewBox 0 0 200 240.
// ---------------------------------------------------------------------------

function bgPatternSvg(t, gid) {
  if (t.bgPattern === 'halo') return `<circle cx="100" cy="102" r="76" fill="#ffffff" opacity="0.10"/>`;
  if (t.bgPattern === 'rays') {
    let rays = '';
    for (let a = 0; a < 360; a += 30) rays += `<rect x="97.5" y="-50" width="5" height="170" transform="rotate(${a} 100 112)"/>`;
    return `<g fill="#ffffff" opacity="0.055">${rays}</g>`;
  }
  if (t.bgPattern === 'dots') {
    const r2 = mulberry32(t.dotSeed);
    let dots = '';
    for (let i = 0; i < 16; i++) dots += `<circle cx="${(r2() * 200).toFixed(1)}" cy="${(r2() * 240).toFixed(1)}" r="${(1.5 + r2() * 2.5).toFixed(1)}" fill="#ffffff" opacity="0.09"/>`;
    return dots;
  }
  return '';
}

function backHairSvg(t, hair, hairD, clothDD) {
  const s = t.hairStyle;
  if (s === 'afro') return `<circle cx="100" cy="76" r="60" fill="${hair}"/>`;
  if (t.hat === 'hood') return `<path d="M36,132 C32,52 66,22 100,22 C134,22 168,52 164,132 C156,98 132,80 100,80 C68,80 44,98 36,132 Z" fill="${clothDD}"/>`;
  if (s === 'long' || s === 'dreads') {
    return `<path d="M62,58 C46,92 44,150 52,202 L78,202 C72,160 72,110 76,68 Z" fill="${hairD}"/>`
      + `<path d="M138,58 C154,92 156,150 148,202 L122,202 C128,160 128,110 124,68 Z" fill="${hairD}"/>`;
  }
  if (s === 'medium' || s === 'braids') {
    return `<path d="M60,60 C48,90 46,126 52,158 L76,158 C71,128 71,96 75,66 Z" fill="${hairD}"/>`
      + `<path d="M140,60 C152,90 154,126 148,158 L124,158 C129,128 129,96 125,66 Z" fill="${hairD}"/>`;
  }
  return '';
}

function topHairSvg(t, hair, hairD) {
  const s = t.hairStyle;
  const cap = `<path d="M56,104 C54,52 72,30 100,30 C128,30 146,52 144,104 Z" fill="${hair}"/>`;
  if (s === 'bald') return `<ellipse cx="82" cy="56" rx="12" ry="6" fill="#ffffff" opacity="0.22" transform="rotate(-18 82 56)"/>`;
  if (s === 'buzz') return `<path d="M58,96 C60,54 76,40 100,40 C124,40 140,54 142,96 C134,68 118,58 100,58 C82,58 66,68 58,96 Z" fill="${hair}" opacity="0.92"/>`;
  if (s === 'curly') {
    const curls = [[58, 72], [72, 50], [94, 40], [116, 44], [134, 58], [142, 80]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${hair}"/>`).join('');
    return curls + cap;
  }
  if (s === 'messy') {
    return `<path d="M54,106 C50,52 68,28 100,28 C132,28 150,52 146,106 L138,106 L134,78 L128,104 L122,74 L116,104 L110,72 L104,104 L98,74 L92,104 L86,76 L80,104 L74,80 L68,106 Z" fill="${hair}"/>`;
  }
  if (s === 'bun') return cap + `<circle cx="100" cy="24" r="13" fill="${hairD}"/>`;
  if (s === 'ponytail') {
    return `<path d="M118,44 C162,52 170,98 158,142" stroke="${hair}" stroke-width="14" stroke-linecap="round" fill="none"/>`
      + cap
      + `<circle cx="114" cy="46" r="6" fill="${hairD}"/>`;
  }
  // short (default): cap with a soft scalloped fringe.
  return `<path d="M54,106 C50,52 68,28 100,28 C132,28 150,52 146,106 C143,92 139,82 133,77 C134,85 131,91 127,93 C123,85 119,81 115,83 C113,89 109,93 105,93 C101,89 97,85 93,87 C89,91 85,93 81,91 C75,87 65,93 62,106 Z" fill="${hair}"/>`;
}

function sideHairSvg(t, hair, hairD) {
  const s = t.hairStyle;
  if (s === 'long' || s === 'dreads') {
    const base = `<path d="M58,76 C50,108 50,158 58,196 L80,196 C74,158 74,108 78,78 Z" fill="${hair}"/>`
      + `<path d="M142,76 C150,108 150,158 142,196 L120,196 C126,158 126,108 122,78 Z" fill="${hair}"/>`;
    if (s === 'dreads') {
      const seg = `<g stroke="${hairD}" stroke-width="2.5" opacity="0.8">`
        + `<path d="M62,100 L74,104 M61,130 L73,134 M61,160 L73,164 M138,100 L126,104 M139,130 L127,134 M139,160 L127,164"/></g>`;
      return base + seg;
    }
    return base;
  }
  if (s === 'medium' || s === 'braids') {
    const base = `<path d="M58,76 C50,104 50,132 56,158 L78,158 C73,132 73,104 78,78 Z" fill="${hair}"/>`
      + `<path d="M142,76 C150,104 150,132 144,158 L122,158 C127,132 127,104 122,78 Z" fill="${hair}"/>`;
    if (s === 'braids') {
      const seg = `<g stroke="${hairD}" stroke-width="2.5" opacity="0.8">`
        + `<path d="M60,92 L74,104 M59,116 L73,128 M138,92 L124,104 M139,116 L125,128"/></g>`;
      return base + seg;
    }
    return base;
  }
  return '';
}

function eyesSvg(t, eye) {
  const ry = t.young ? 7.5 : 6.5, ir = t.young ? 5 : 4.2;
  let s = `<ellipse cx="82" cy="106" rx="9" ry="${ry}" fill="#ffffff"/><ellipse cx="118" cy="106" rx="9" ry="${ry}" fill="#ffffff"/>`
    + `<circle cx="82" cy="106" r="${ir}" fill="${eye}"/><circle cx="118" cy="106" r="${ir}" fill="${eye}"/>`
    + `<circle cx="82" cy="106" r="2" fill="#191919"/><circle cx="118" cy="106" r="2" fill="#191919"/>`
    + `<circle cx="83.6" cy="104.4" r="1.1" fill="#ffffff"/><circle cx="119.6" cy="104.4" r="1.1" fill="#ffffff"/>`;
  if (t.old) s += `<g stroke="#b08a68" stroke-width="1.8" fill="none" opacity="0.8"><path d="M73,115 Q82,119 91,115"/><path d="M109,115 Q118,119 127,115"/></g>`;
  return s;
}

function glassesSvg(t) {
  if (t.glasses === 'sunglasses') {
    return `<g><rect x="63" y="94" width="74" height="26" rx="11" fill="#22262b"/>`
      + `<path d="M94,100 h12" stroke="#22262b" stroke-width="5"/>`
      + `<path d="M63,100 L56,96 M137,100 L144,96" stroke="#22262b" stroke-width="4" stroke-linecap="round"/></g>`;
  }
  if (t.glasses === 'glasses') {
    return `<g stroke="#2e2e2e" stroke-width="3.5" fill="none">`
      + `<circle cx="82" cy="106" r="13"/><circle cx="118" cy="106" r="13"/>`
      + `<path d="M95,105 h10"/><path d="M69,103 L57,99"/><path d="M131,103 L143,99"/></g>`;
  }
  return '';
}

function beardSvg(t, hairD, hair) {
  if (t.beard === 'beard') {
    return `<path d="M60,108 C58,150 76,174 100,174 C124,174 142,150 140,108 C134,140 118,150 100,150 C82,150 66,140 60,108 Z" fill="${hairD}"/>`;
  }
  if (t.beard === 'stubble') {
    return `<path d="M60,112 C60,150 76,170 100,170 C124,170 140,150 140,112 C134,142 118,152 100,152 C82,152 66,142 60,112 Z" fill="${hair}" opacity="0.28"/>`;
  }
  let s = '';
  if (t.beard === 'goatee' || t.beard === 'mustache') {
    s += `<path d="M86,137 Q100,131 114,137 Q107,144 100,143 Q93,144 86,137 Z" fill="${hairD}"/>`;
  }
  if (t.beard === 'goatee') s += `<ellipse cx="100" cy="161" rx="13" ry="11" fill="${hairD}"/>`;
  return s;
}

function mouthSvg(t) {
  const c = t.beard === 'beard' ? '#d8a58c' : '#8a4a3c';
  if (t.mouth === 'smile') return `<path d="M86,142 Q100,152 114,142" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (t.mouth === 'soft') return `<path d="M90,143 Q100,148 110,143" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if (t.mouth === 'open') return `<path d="M88,141 Q100,140 112,141 Q107,154 100,154 Q93,154 88,141 Z" fill="#7a3a2e"/>`;
  return `<path d="M89,143 L111,143" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`;
}

function clothingSvg(t, cloth, clothD, clothDD, skin) {
  switch (t.clothingStyle) {
    case 'suit':
      return `<path d="M90,174 L100,208 L110,174 Z" fill="#f4efe6"/>`
        + `<path d="M90,174 L100,208 L82,176 Z" fill="${clothD}"/><path d="M110,174 L100,208 L118,176 Z" fill="${clothD}"/>`
        + `<path d="M96,184 L104,184 L102,206 L98,206 Z" fill="${t.tieColor}"/>`;
    case 'dress':
      return `<ellipse cx="100" cy="180" rx="26" ry="13" fill="${skin}"/>`
        + `<path d="M74,180 Q100,206 126,180" stroke="${clothD}" stroke-width="3" fill="none"/>`;
    case 'armor':
      return `<ellipse cx="50" cy="198" rx="28" ry="17" fill="#9aa0a8"/><ellipse cx="150" cy="198" rx="28" ry="17" fill="#9aa0a8"/>`
        + `<g fill="#5a5f66"><circle cx="42" cy="196" r="2.4"/><circle cx="50" cy="200" r="2.4"/><circle cx="58" cy="196" r="2.4"/><circle cx="142" cy="196" r="2.4"/><circle cx="150" cy="200" r="2.4"/><circle cx="158" cy="196" r="2.4"/></g>`
        + `<path d="M100,178 L100,240" stroke="#5a5f66" stroke-width="3"/>`;
    case 'cloak':
      return `<circle cx="100" cy="184" r="7" fill="#d8b34a"/>`
        + `<path d="M100,191 L88,240 M100,191 L112,240" stroke="${clothD}" stroke-width="3"/>`;
    case 'robe':
      return `<path d="M84,174 L100,202 L116,174" stroke="${clothD}" stroke-width="5" fill="none"/>`;
    case 'hoodie':
      return `<path d="M92,180 L90,208 M108,180 L110,208" stroke="#e8e2d6" stroke-width="3.5" stroke-linecap="round"/>`
        + `<rect x="72" y="212" width="56" height="20" rx="6" fill="${clothD}" opacity="0.55"/>`;
    case 'uniform':
      return `<rect x="40" y="182" width="26" height="9" rx="4" fill="#d8b34a"/><rect x="134" y="182" width="26" height="9" rx="4" fill="#d8b34a"/>`
        + `<g fill="${clothDD}"><circle cx="100" cy="196" r="3"/><circle cx="100" cy="210" r="3"/><circle cx="100" cy="224" r="3"/></g>`;
    case 'leather':
      return `<path d="M78,174 L100,196 L88,176 Z" fill="${clothDD}"/><path d="M122,174 L100,196 L112,176 Z" fill="${clothDD}"/>`
        + `<line x1="100" y1="196" x2="100" y2="240" stroke="#c9c9c9" stroke-width="3"/>`;
    default:
      return `<path d="M82,172 Q100,188 118,172" stroke="${clothD}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
}

function hatTopSvg(t) {
  const c = t.hatColor;
  if (t.hat === 'cap') {
    return `<path d="M60,64 C62,30 80,20 100,20 C120,20 138,30 140,64 L132,64 C130,44 118,34 100,34 C82,34 70,44 68,64 Z" fill="${c}"/>`
      + `<ellipse cx="100" cy="64" rx="48" ry="11" fill="${shade(c, -25)}"/>`
      + `<circle cx="100" cy="22" r="4" fill="${shade(c, -25)}"/>`;
  }
  if (t.hat === 'beanie') {
    let ribs = '';
    for (let x = 72; x <= 128; x += 14) ribs += `<line x1="${x}" y1="34" x2="${x}" y2="64" stroke="${shade(c, -25)}" stroke-width="2.5"/>`;
    return `<path d="M60,70 C62,34 80,24 100,24 C120,24 138,34 140,70 L140,78 L60,78 Z" fill="${c}"/>`
      + ribs + `<rect x="60" y="66" width="80" height="13" fill="${shade(c, -30)}"/>`
      + `<circle cx="100" cy="22" r="8" fill="${shade(c, 18)}"/>`;
  }
  if (t.hat === 'wide') {
    return `<ellipse cx="100" cy="68" rx="64" ry="14" fill="${c}"/>`
      + `<path d="M72,66 C74,36 86,28 100,28 C114,28 126,36 128,66 Z" fill="${shade(c, -15)}"/>`
      + `<rect x="72" y="56" width="56" height="9" fill="${shade(c, -35)}"/>`;
  }
  return '';
}

function buildPortrait(record, t, seed) {
  const gid = 'cv' + (xmur3(`${record.id || 'noid'}:${seed}`)() >>> 0).toString(36);
  const skin = SKIN_TONES[t.skinIdx];
  const skinD = shade(skin, -28);
  const hair = HAIR_COLORS[t.hairColor];
  const hairD = shade(hair, -22);
  const cloth = t.clothingColor;
  const clothD = shade(cloth, -30);
  const clothDD = shade(cloth, -55);
  const browC = (t.hairColor === 'gray' || t.hairColor === 'white') ? '#5a5a5a' : shade(hair, -48);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img" aria-label="Procedural character portrait">`
    + `<defs><linearGradient id="${gid}bg" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${t.bg[0]}"/><stop offset="1" stop-color="${t.bg[1]}"/></linearGradient></defs>`
    + `<rect width="200" height="240" fill="url(#${gid}bg)"/>`
    + bgPatternSvg(t, gid)
    + backHairSvg(t, hair, hairD, clothDD)
    // neck + shoulders
    + `<rect x="87" y="134" width="26" height="42" rx="10" fill="${skinD}"/>`
    + `<path d="M14,240 C24,198 60,172 100,172 C140,172 176,198 186,240 Z" fill="${cloth}"/>`
    + `<path d="M14,240 C24,198 60,172 100,172 L100,240 Z" fill="#000000" opacity="0.06"/>`
    + clothingSvg(t, cloth, clothD, clothDD, skin);

  if (t.tattoo) {
    s += `<g stroke="#3a3a3a" stroke-width="2" fill="none" opacity="0.75"><circle cx="150" cy="212" r="7"/><circle cx="150" cy="212" r="2" fill="#3a3a3a" stroke="none"/></g>`;
  }

  // face
  s += `<ellipse cx="100" cy="102" rx="${t.faceRx}" ry="${t.faceRy}" fill="${skin}"/>`
    + `<ellipse cx="57" cy="106" rx="7" ry="10" fill="${skin}"/><ellipse cx="143" cy="106" rx="7" ry="10" fill="${skin}"/>`
    + `<path d="M57,100 q4,6 0,12 M143,100 q-4,6 0,12" stroke="${skinD}" stroke-width="1.8" fill="none"/>`
    + topHairSvg(t, hair, hairD)
    + sideHairSvg(t, hair, hairD);

  // features
  s += `<path d="M70,90 Q82,84 94,89" stroke="${browC}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    + `<path d="M106,89 Q118,84 130,90" stroke="${browC}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + eyesSvg(t, EYE_COLORS[t.eye])
    + glassesSvg(t)
    + `<path d="M100,112 C99,120 97,126 94,130 C97,133 102,133 105,131" stroke="${skinD}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

  if (t.old) {
    s += `<g stroke="${skinD}" stroke-width="2" fill="none" opacity="0.65">`
      + `<path d="M78,68 Q100,62 122,68"/><path d="M82,78 Q100,73 118,78"/>`
      + `<path d="M66,104 l-7,-3 M66,109 l-7,1 M134,104 l7,-3 M134,109 l7,1"/>`
      + `<path d="M86,130 Q82,140 84,148 M114,130 Q118,140 116,148"/></g>`;
  }
  if (t.freckles) {
    s += `<g fill="#9a6242" opacity="0.75">`
      + `<circle cx="88" cy="120" r="1.3"/><circle cx="95" cy="124" r="1.3"/><circle cx="105" cy="124" r="1.3"/>`
      + `<circle cx="112" cy="120" r="1.3"/><circle cx="100" cy="128" r="1.3"/><circle cx="80" cy="114" r="1.3"/><circle cx="120" cy="114" r="1.3"/></g>`;
  }
  if (t.scar) {
    s += `<path d="M126,116 L138,129" stroke="#b57a6a" stroke-width="2.5" stroke-linecap="round"/>`
      + `<path d="M130,119 l6,-5" stroke="#b57a6a" stroke-width="1.8" stroke-linecap="round"/>`;
  }

  s += beardSvg(t, hairD, hair) + mouthSvg(t);

  if (t.necklace) {
    s += `<path d="M76,194 Q100,214 124,194" stroke="#d8b34a" stroke-width="3" fill="none"/>`
      + `<circle cx="100" cy="208" r="4" fill="#d8b34a"/>`;
  }
  if (t.earrings) {
    s += `<circle cx="57" cy="122" r="3.5" fill="#d8b34a"/><circle cx="143" cy="122" r="3.5" fill="#d8b34a"/>`;
  }
  s += hatTopSvg(t);
  s += `</svg>`;
  return s;
}

// ---------------------------------------------------------------------------
// Monogram fallback — pleasant initial-based avatar when the record has too
// little visual data (no appearance/fashion notes) to draw a portrait from.
// ---------------------------------------------------------------------------

function initialsFor(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return escXml(((words[0][0] || '') + (words[1] ? words[1][0] : '')).toUpperCase());
}

function monogramSVG(record, seed) {
  const gid = 'cv' + (xmur3(`${record.id || 'noid'}:${seed}`)() >>> 0).toString(36);
  const r2 = mulberry32(xmur3(`${record.id || 'noid'}:${seed}:mono`)());
  const bg = pick(r2, BG_PAIRS);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img" aria-label="Character monogram">`
    + `<defs><linearGradient id="${gid}mg" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>`
    + `<rect width="200" height="240" fill="url(#${gid}mg)"/>`
    + `<circle cx="100" cy="112" r="62" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.30"/>`
    + `<circle cx="100" cy="112" r="54" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.18"/>`
    + `<text x="100" y="138" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="76" fill="#f7f1e7" opacity="0.95">${initialsFor(record.name)}</text>`
    + `</svg>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point. Returns { svg, monogram, seed, traits }.
 * Pure function of the record: same record (same id + portraitSeed) always
 * yields the identical SVG. Fully offline, zero dependencies.
 */
export function portraitForRecord(record) {
  const r = record || {};
  const seed = getPortraitSeed(r);
  const visualText = `${r.appearance || ''} ${r.fashion || ''}`.trim();
  if (visualText.length < 12) {
    return { svg: monogramSVG(r, seed), monogram: true, seed, traits: null };
  }
  const hints = parseTraits(r);
  const t = resolveTraits(hints, rngFor(r, seed));
  return { svg: buildPortrait(r, t, seed), monogram: false, seed, traits: t };
}
