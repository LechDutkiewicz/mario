// World 4-3 — converted from FSM World43 (Overworld: mushroom platforms over
// a bottomless drop). FSM pushPreScale pulleys approximated as floating
// platform pairs (same treatment as 3-3).
export const world43Data = {
  "name": "4-3",
  "locations": [{ "entry": "Plain" }],
  "areas": [
    {
      "setting": "Overworld",
      "blockBoundaries": true,
      "creation": [
        { "macro": "CastleSmall" },
        { "macro": "Pattern", "pattern": "BackCloud", "y": 4, "repeat": 3 },
        { "macro": "Floor", "width": 120 },

        { "macro": "Shroom", "x": 128, "width": 40 },
        { "macro": "Shroom", "x": 152, "y": 64, "width": 40 },
        { "macro": "Fill", "thing": "Coin", "x": 161, "y": 71, "xnum": 3, "xwidth": 8 },
        { "macro": "Shroom", "x": 184, "y": 32, "width": 56 },
        { "macro": "Fill", "thing": "Coin", "x": 193, "y": 39, "xnum": 4, "xwidth": 8 },
        { "macro": "Fill", "thing": "Koopa", "x": 224, "y": 44, "xnum": 2, "xwidth": 8, "smart": true },

        { "macro": "Shroom", "x": 256, "y": 72, "width": 24 },
        { "macro": "Shroom", "x": 288, "y": 8, "width": 56 },
        { "thing": "Koopa", "x": 288, "y": 84, "smart": true, "jumping": true, "floating": true, "begin": 32, "end": 88 },
        { "thing": "Coin", "x": 305, "y": 15 },
        { "thing": "Koopa", "x": 312, "y": 20, "smart": true },
        { "macro": "Shroom", "x": 312, "y": 64, "width": 40 },
        { "thing": "Coin", "x": 321, "y": 15 },
        { "thing": "Block", "x": 344, "y": 88, "contents": "Mushroom" },
        { "macro": "Shroom", "x": 352, "y": 32, "width": 24 },

        { "thing": "Coin", "x": 385, "y": 47 },
        { "thing": "Platform", "x": 396, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Platform", "x": 452, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "macro": "Shroom", "x": 408, "y": 40, "width": 24 },
        { "thing": "Platform", "x": 464, "y": 20, "width": 48, "floating": true, "begin": 32, "end": 88 },
        { "thing": "Platform", "x": 496, "y": 66, "width": 48, "floating": true, "begin": 32, "end": 88 },

        { "macro": "Shroom", "x": 520, "width": 40 },
        { "macro": "Shroom", "x": 536, "y": 48, "width": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 537, "y": 55, "xnum": 3, "xwidth": 8 },
        { "thing": "Koopa", "x": 544, "y": 12, "smart": true },
        { "macro": "Shroom", "x": 560, "y": 80, "width": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 561, "y": 87, "xnum": 3, "xwidth": 8 },
        { "macro": "Shroom", "x": 576, "y": 32, "width": 24 },
        { "thing": "Coin", "x": 585, "y": 39 },
        { "macro": "Shroom", "x": 592, "y": 64, "width": 40 },
        { "thing": "Koopa", "x": 624, "y": 76, "smart": true },

        { "thing": "Platform", "x": 652, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Platform", "x": 716, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Platform", "x": 740, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Platform", "x": 780, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Coin", "x": 770, "y": 47 },
        { "macro": "Shroom", "x": 792, "y": 16, "width": 24 },
        { "thing": "Platform", "x": 828, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },
        { "thing": "Platform", "x": 876, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 80 },

        { "macro": "Shroom", "x": 904, "y": 32, "width": 40 },
        { "macro": "Fill", "thing": "Coin", "x": 905, "y": 39, "xnum": 5, "xwidth": 8 },
        { "macro": "Shroom", "x": 936, "y": 56, "width": 24 },
        { "macro": "Shroom", "x": 968, "width": 56 },
        { "macro": "Shroom", "x": 1040, "y": 24, "width": 40 },
        { "thing": "Platform", "x": 1088, "y": 67, "width": 48, "floating": true, "begin": 8, "end": 88 },

        { "macro": "Floor", "x": 1128, "width": 152 },
        { "macro": "EndOutsideCastle", "x": 1172, "transport": { "map": "4-4" } }
      ]
    }
  ]
};
