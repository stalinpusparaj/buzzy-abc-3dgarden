/** Palette tokens (brief §4). BUZZY_SPEC values are placeholders until the app's real spec lands. */
export const palette = {
  grass: 0x7bc950,
  grassDark: 0x5fae3c,
  path: 0xf2d7a1,
  skyTop: 0x8ed1fc,
  skyBottom: 0xe0f4ff,
  petals: [0xff8fa3, 0xffb84c, 0xb28dff, 0x6fd3e8, 0xff6b6b, 0x9be15d],
  stem: 0x4fa83d,
  soil: 0x9a6b4f,
  rock: 0xb9b3c9,
  trunk: 0x9a6b4f,
  water: 0x6fd3e8,
  cloud: 0xffffff,
  wood: 0xd9a066,
  cloth: 0xff8fa3,
  // BUZZY_SPEC placeholder (brief §4).
  buzzyBody: 0xffd23f,
  buzzyStripe: 0x3b2a20,
  buzzyWing: 0xffffff,
  buzzyWingOpacity: 0.45,
  buzzyCheek: 0xff8fa3,
  eyeWhite: 0xffffff,
  pupil: 0x1d1720,
  glyph: 0xffffff,
  glyphOutline: 0x3b2a20,
  trail: 0xffe066,
  startDot: 0x3ccf4e,
} as const;

/** CSS-side tokens for DOM overlays (parent zone, HUD). */
export const cssTokens = {
  ink: '#2b2233',
  paper: '#fffaf0',
  accent: '#ff8fa3',
  focus: '#2f6fd6',
} as const;
