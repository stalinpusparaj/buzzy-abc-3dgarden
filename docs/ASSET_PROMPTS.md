# Buzzy ABC Garden: asset prompt pack

The video's pipeline (lyrics → song → images → animation → edit), retargeted to produce **game assets** instead of a one-off YouTube video. The game only uses each asset once you've logged it in `ASSETS.md`.

---

## 0. Style lock (paste at the end of EVERY visual prompt)

> chunky low-poly toy style, soft rounded shapes, matte clay-like material, bright saturated pastel colours, gentle soft lighting, simple readable silhouette, no text, no logos, single object, centered, plain white background, front three-quarter view, preschool friendly, original design

Reusing the same lock in every prompt is what keeps 30 AI assets looking like one game. Never add "in the style of [show name]": it's both a legal risk and the reason AI kids content all looks the same.

---

## 1. Songs (video steps 1–2: ChatGPT/Claude → Suno)

### 1a. Lyrics prompt (English)

```
Write lyrics for an ORIGINAL preschool song, "Buzzy's ABC Garden", for ages 3–6.
Rules:
- Letters A–F only, one verse line per letter, in order.
- Each letter line follows this exact shape: "<L>, <L>, <L> is for <Word>, <short fun action or sound>!"
  Words are fixed: A Apple, B Bee, C Cat, D Duck, E Egg, F Fish.
- Max 8 syllables after "is for". Simple words a 3-year-old knows.
- After F, a 4-line chorus inviting kids to "come and play in Buzzy's garden" that ends by naming A to F.
- Use song tags: [Intro] [Verse] [Chorus] [Outro]. Put each letter line on its own line.
- No brand names, no existing nursery rhyme lines or melodies.
Give me 3 versions, then the one you think a 4-year-old would sing back fastest, and why.
```

Seed to compare against (mine, original):

```
A, A, A is for Apple, crunchy apple, yum!
B, B, B is for Bee, buzz buzz, here I come!
C, C, C is for Cat, meow meow meow!
D, D, D is for Duck, quack quack, wow!
E, E, E is for Egg, crack! Who's inside?
F, F, F is for Fish, splash and swim and glide!
```

### 1b. Lyrics prompt (Tamil, uyir ezhuthukkal அ–ஊ)

```
குழந்தைகளுக்கான (3–6 வயது) ஒரு புதிய, சொந்தமான பாடல் எழுது: "தேனீ பஸ்ஸியின் எழுத்துத் தோட்டம்".
விதிகள்:
- உயிர் எழுத்துக்கள் அ, ஆ, இ, ஈ, உ, ஊ மட்டும், வரிசையாக.
- ஒவ்வொரு வரியும் இந்த வடிவில்: "<எழுத்து> <எழுத்து> <சொல்>, <சிறிய செயல்/ஒலி>!"
- சொற்கள்: அ அணில், ஆ ஆடு, இ இலை, ஈ ஈ, உ உரல், ஊ ஊஞ்சல்.
- மிக எளிய பேச்சுத் தமிழ், 3 வயது குழந்தை பாடக்கூடியது.
- இறுதியில் 4 வரி பல்லவி: "பஸ்ஸியின் தோட்டத்தில் விளையாட வா" என்ற கருத்துடன்.
- [Intro] [Verse] [Chorus] [Outro] குறிச்சொற்கள் பயன்படுத்து.
3 பதிப்புகள் கொடு.
```

Seed to compare against (have a Tamil teacher check it):

```
அ அ அணில், மரத்தில் ஓடும் அணில்!
ஆ ஆ ஆடு, புல்லைத் தின்னும் ஆடு!
இ இ இலை, பச்சைப் பச்சை இலை!
ஈ ஈ ஈ, பறந்து போகும் ஈ!
உ உ உரல், நெல்லு இடிக்கும் உரல்!
ஊ ஊ ஊஞ்சல், ஆடி மகிழும் ஊஞ்சல்!
```

### 1c. Suno settings (Custom mode)

- **Lyrics:** paste the chosen version with its tags
- **Style (EN):** `preschool nursery pop, 100 bpm, ukulele, glockenspiel, hand claps, bright friendly female vocal, slow clear diction, major key, simple singable melody`
- **Style (TA):** the same, plus `Tamil lyrics, clear Tamil pronunciation`
- Generate several takes per language. Pick the take with the **cleanest pause between letter lines**, because the game slices one line per letter.
- Also generate an **instrumental** of the chosen take. That becomes the garden's background music loop.
- Then slice the per-letter lines in Audacity and record the cue times with the game's dev Cue Recorder (`/?dev=cues`).

**Licence reality check:**

- Suno songs made on the **free plan are non-commercial**, and subscribing later doesn't fix them retroactively. Generate on a paid plan from day one.
- Suno's own terms say you're "generally not considered the owner" of outputs. For a theme song you plan to **license to schools**, that's weak footing. Consider paying a local composer and singer for a one-time buyout of the theme song, and use Suno only for prototyping.
- AI vocals can blur Tamil phonemes (ழ/ள/ல, ண/ன). Have a native speaker check every line before shipping, and re-record any line that's off.

---

## 2. Voice-over script (record per language; ids match `vo-manifest.json`)

| id | English | Tamil (REVIEW) |
|---|---|---|
| tap_to_start | Tap to play! | தொட்டு விளையாடு! |
| welcome | Hi! I'm Buzzy! Welcome to my garden! | வணக்கம்! நான் பஸ்ஸி! என் தோட்டத்துக்கு வா! |
| pick_flower | Pick a flower! | ஒரு பூவைத் தொடு! |
| pp_instruction | Pop the bubbles with {glyph}! | {glyph} இருக்கும் குமிழ்களை உடை! |
| tt_instruction | Trace {glyph} with your finger. Follow me! | விரலால் {glyph} வரை. என் பின்னால் வா! |
| bm_instruction | Which one starts with {sound}? Put it in my basket! | {glyph}-வில் தொடங்குவது எது? கூடையில் போடு! |
| great_1 / 2 / 3 | Yay! / Great job! / You did it! | சூப்பர்! / அருமை! / நீ செய்துட்டே! |
| try_again | Oops! Try this one! | அச்சச்சோ! இதை முயற்சி செய்! |
| look_here | Look here! | இங்கே பார்! |
| letter_is_for | {glyph} is for {word}! | {glyph}, {word}! |
| sing_intro | Let's sing the garden song! | தோட்டப் பாட்டு பாடலாம் வா! |
| sleepy | Buzzy is sleepy… let's play more tomorrow! | பஸ்ஸிக்குத் தூக்கம் வருது… நாளைக்கு விளையாடலாம்! |
| parent_gate_hint | Grown-ups only! | பெரியவர்களுக்கு மட்டும்! |

Record each `{glyph}` and `{word}` combination as its own file (for example `A_isfor.mp3`), not as a sentence stitched together at runtime. Stitched VO sounds robotic to kids.

**Voice direction:** warm, smiling, slow (about 20% slower than adult speech), with a small pause before the letter.

A human voice is strongly preferred for Tamil. If you use a TTS service, test the Tamil output with a native listener first.

---

## 3. Buzzy character (video step 3 → image-to-3D)

### 3a. Turnaround sheet (image model, 16:9)

```
Character turnaround sheet of Buzzy, an original cute round bumblebee mascot for a preschool learning game:
chubby round yellow body (#FFD23F) with two dark brown stripes (#3B2A20), oversized friendly eyes,
small smile, rosy pink cheeks, two short antennae, small translucent wings, tiny arms, no clothing.
Show FRONT, SIDE, BACK and THREE-QUARTER views in a row, identical proportions in every view,
neutral standing pose, wings spread, evenly lit. [STYLE LOCK]
```

If your mobile game already has a Buzzy design, **attach that art as the reference image** and say "match this character exactly". One Buzzy, everywhere. Brand consistency is the asset.

### 3b. Image-to-3D

1. Feed the front or three-quarter view into an image-to-3D tool (Meshy, Tripo, Higgsfield 3D or similar) and export a **GLB**.
2. Cleanup in Blender:
   - Decimate to **≤ 8k tris**, apply transforms, put the origin at the feet, height about 1 unit.
   - Separate the wings and the eyes into their own meshes, so the game can flap the wings and track with the eyes.
   - Bake textures to **vertex colours** where possible (smaller files, cleaner toon look).
3. Export the GLB, drop it into `public/assets/models/`, and run `npm run optimize-assets`.

---

## 4. Props (one prompt each: `<object description> + [STYLE LOCK]`)

| model id | prompt body | tri budget |
|---|---|---|
| apple | a shiny round red apple with one green leaf and short brown stem | 1.5k |
| bee | a small cute bee (different from Buzzy: smaller, lighter yellow) | 2k |
| cat | a friendly sitting orange kitten, big head, small body | 3k |
| duck | a yellow baby duck with orange beak, standing | 3k |
| egg | a smooth cream-white egg with a tiny crack on top | 0.8k |
| fish | a cheerful round blue fish with big fins, side pose | 2k |
| squirrel (அணில்) | an Indian palm squirrel with three light stripes on its back, sitting, holding a nut | 3k |
| goat (ஆடு) | a small friendly white goat with short horns, standing | 3k |
| leaf (இலை) | a single big glossy green leaf with visible vein | 0.8k |
| fly (ஈ) | a very cute cartoon housefly with big eyes and round body, not scary | 2k |
| ural (உரல்) | a traditional South Indian stone mortar (ural) with a wooden pestle | 2k |
| swing (ஊஞ்சல்) | a wooden plank swing hanging from a short branch by two ropes | 2k |
| bud | a giant closed flower bud on a thick stem, petals tightly closed | 2k |
| bloom | the same flower fully open, wide petals, flat centre for a letter | 3k |
| basket | a woven picnic basket with handle, open top | 2k |
| gazebo | a small round garden gazebo with a flower-vine roof | 5k |
| tree, rock, bush | a round fluffy tree / smooth rounded rock / round bush | 1.5k each |

**Tip:** generate all the props in one session with the same seed or settings, reject anything that drifts from the style lock, and write every accepted asset into `ASSETS.md` immediately.

---

## 5. Promo video (the video's original idea, used as marketing, not as the business)

Once the game exists, reuse the **same song, Buzzy model and props** to cut a 60-second sing-along Short and a 16:9 version that end with "Play Buzzy's ABC Garden: link for grown-ups in the description".

- Mark them **Made for Kids**, use the **AI disclosure** toggle, and keep a consistent recurring character and real creative input.
- Channels that pump out templated AI kids' clips with interchangeable characters are exactly what YouTube's inauthentic-content enforcement targets. A consistent original character with an actual game behind it is not.
