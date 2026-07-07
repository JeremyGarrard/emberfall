# Real-asset overrides (optional)

The game paints every texture in code, so this folder can stay empty forever.
But any image listed in `manifest.json` **replaces** the painted version at its
native resolution — everywhere it's used (HUD, dialogue, 3D billboards, panels).

`manifest.json` format:

```json
[
  { "key": "pt_roderick",  "file": "portraits/roderick.png" },
  { "key": "face_maren",   "file": "faces/maren.png" },
  { "key": "elder",        "file": "billboards/elder.png" }
]
```

## Keys worth overriding first

| Key | Used for | Suggested size |
|---|---|---|
| `pt_roderick` `pt_wren` `pt_serena` `pt_malwick` | party portraits (HUD, panels) | 256x256 |
| `face_<villagerId>` (`face_maren`, `face_bram`, `face_tilly`, `face_odo`, `face_hilda`, `face_marta`) | dialogue portrait (falls back to billboard) | 256x256 |
| `elder` `smith` `child` `merchant` `innkeep` `marta` | villager billboards in the 3D world | 128x128, transparent bg |
| `slime` `goblin` `wolf` | monster billboards | 128x128, transparent bg |
| `tree` `pine` | trees | 128x128, transparent bg |

Style guide + AI-generation prompts for consistent faces: see `design/GRAPHICS.md`.
Missing files log a console warning and fall back to the painter — safe to iterate.
