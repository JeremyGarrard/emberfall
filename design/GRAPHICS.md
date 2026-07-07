# Graphics — the "HD, not sloppy" upgrade path

Goal (user's words): *not better than Minecraft, just not sloppy.* Characters
must stop looking like "blobs of paint," especially in dialogue. Keep the
framerate (~380fps headroom) and the no-required-assets rule. Two parallel tracks.

## Track A — real faces & sprites (the asset pipeline, ALREADY BUILT)

`assets/manifest.json` maps a texture key → a PNG; it overrides the painter at
native resolution everywhere (HUD, dialogue portrait, 3D billboard). The
dialogue box now has a portrait slot that shows `face_<id>` (or the billboard).
So "better faces" = **produce face PNGs and list them**. No code.

### Where the faces come from (the user's question)

Ranked by fit for this project:

1. **AI image generation (recommended).** Generate a consistent set from one
   prompt style. Store as `assets/faces/<id>.png` + `assets/portraits/<hero>.png`,
   256x256. Suggested base prompt (keep the bracketed style block identical
   across every character for a matched set):
   > `[flat 2D painted RPG portrait, head and shoulders, warm painterly
   >  storybook style, muted medieval-fantasy palette, soft rim light, plain
   >  dark vignette background, centered, no text]` + per-character:
   > Maren: "elderly wise woman, white braided hair, green warden's cloak, kind tired eyes"
   > Bram: "burly bearded blacksmith, soot-smudged, leather apron, friendly grin"
   > Tilly: "excited farm girl about nine, freckles, straw-blond pigtails"
   > Odo: "sly middle-aged peddler, feathered cap, knowing smirk"
   > Hilda: "warm sharp-eyed tavern-keeper, auburn bun, apron"
   > Marta: "weathered wolf-hunter woman, fur-trimmed hood, scar, wary"
   > Roderick/Wren/Serena/Malwick: match the class fantasy (knight/archer/cleric/sorcerer)
   Generate → downscale → drop in → list in manifest. Iterate individuals freely.
2. **CC0 art packs.** Kenney (kenney.nl) has portrait/RPG sets; OpenGameArt has
   CC0 face packs. Zero legal friction (CC0 = public domain). Lower consistency
   than a single AI set; fine for monsters/props.
3. **Commission / draw.** Highest quality + consistency, real cost/time. Only if
   this becomes a real product.

Do NOT ship someone's copyrighted MM7 rips — that's the one hard no.

### Manifest keys to fill first (highest visual impact)
Party portraits (`pt_*`) and villager faces (`face_*`) — those are what the
player stares at in the HUD and every conversation. Then monster billboards.

## Track B — make the PAINTED look less sloppy (no assets, code only)

For anything without a real asset yet, lift the procedural quality. Each is a
small ticket:

1. ✅ **Portrait painter overhaul — DONE.** `paintPortrait` kit in BootScene
   (128px): gradient-shaded face volume, detailed eyes (sclera/iris/pupil/
   catchlight/lid), rim light, brows, nose shading, `hairMass` strand texture,
   per-character vignette bg. Repainted all 4 party `pt_*` portraits + added
   dedicated `face_<id>` dialogue portraits for all 7 villagers (Maren, Bram,
   Tilly, Odo, Hilda, Marta, Xarthax). Real PNGs via the manifest still override
   these; the painters are now a solid fallback, not blobs.
2. **Billboard shading.** Give 3D billboards a subtle vertical gradient (lit top,
   shadowed base) + a soft contact-shadow decal on the ground under each. Cheap,
   huge grounding effect.
3. **Texture resolution pass.** Bump key painters 64→128px where it shows
   (portraits, faces, item icons). Framerate can afford it.
4. **Anti-aliasing / filtering.** Currently NearestFilter everywhere for the
   pixel look. Offer a "smooth" mode: linear filter on billboards + portraits,
   mipmaps on terrain. A/B it — pick per-surface (crisp UI, smooth faces).
5. **Post one subtle effect.** A gentle vignette + slight color-grade on the
   final composite (Phaser postFX or a full-screen quad) reads as "produced"
   for near-zero effort. Don't overdo bloom.
6. **Lighting warmth.** Current hemisphere+sun is flat. Add a warm/cool split
   (warm sun, cool sky fill) and a touch of specular on water/armor. Sells depth.

## Recommended sequence
Track A for the 10 faces (immediate, dramatic — kills the "blobs" complaint) →
B1 portrait painter overhaul (covers anyone without an asset) → B2 billboard
shading + contact shadows → B5 post-grade. That order fixes the sloppy feel
fastest without touching framerate.
