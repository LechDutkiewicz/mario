// World 7-3 — converted from FSM World73 (bridges over water with leaping
// Magikarps from x:64 to x:1600)
export const world73Data = {
  "name": "7-3",
  "time": 300,
  "locations": [{ "entry": "Plain" }],
  "areas": [
    {
      "setting": "Overworld",
      "blockBoundaries": true,
      "creation": [
        { "macro": "CastleSmall" },
        { "macro": "Pattern", "pattern": "BackCloud", "y": 4, "repeat": 5 },
        { "macro": "Floor", "width": 56 },
        { "macro": "CheepsStart", "x": 64 },
        { "macro": "Tree", "x": 64, "width": 64 },
        { "thing": "Stone", "x": 80, "y": 8 },
        { "thing": "Stone", "x": 88, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 96, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 104, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 112, "y": 24, "height": 24 },
        { "macro": "Bridge", "x": 120, "y": 24, "width": 128 },
        { "thing": "Stone", "x": 248, "y": 24, "height": 24 },
        { "macro": "Bridge", "x": 256, "y": 24, "width": 120 },
        { "macro": "Fill", "thing": "Coin", "x": 290, "y": 63, "xnum": 4, "xwidth": 8 },
        { "thing": "Koopa", "x": 312, "y": 36 },
        { "thing": "Stone", "x": 376, "y": 24, "height": 24 },
        { "macro": "Bridge", "x": 384, "y": 24, "width": 128 },
        { "thing": "Koopa", "x": 416, "y": 44, "jumping": true },
        { "macro": "Fill", "thing": "Coin", "x": 441, "y": 63, "xnum": 3, "xwidth": 16 },
        { "macro": "Fill", "thing": "Coin", "x": 449, "y": 55, "xnum": 2, "xwidth": 16 },
        { "thing": "Stone", "x": 504, "y": 24, "height": 24 },

        { "thing": "Stone", "x": 544, "y": 24, "height": 24 },
        { "macro": "Bridge", "x": 552, "y": 24, "width": 80 },
        { "macro": "Fill", "thing": "Coin", "x": 578, "y": 63, "xnum": 2, "xwidth": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 586, "y": 71, "xnum": 2, "xwidth": 8 },
        { "thing": "Stone", "x": 632, "y": 24, "height": 24 },
        { "thing": "Koopa", "x": 632, "y": 36, "smart": true },

        { "thing": "Stone", "x": 672, "y": 24, "height": 24 },
        { "macro": "Bridge", "x": 680, "y": 24, "width": 80 },
        { "thing": "Stone", "x": 760, "y": 24, "height": 24 },
        { "thing": "Koopa", "x": 760, "y": 36, "smart": true },

        { "macro": "Fill", "thing": "Coin", "x": 777, "y": 63, "xnum": 3, "xwidth": 8 },
        { "thing": "Stone", "x": 792, "y": 32, "height": 32 },
        { "macro": "Bridge", "x": 800, "y": 32, "width": 40 },
        { "thing": "Block", "x": 816, "y": 64, "contents": "Mushroom" },

        { "macro": "Fill", "thing": "Coin", "x": 865, "y": 63, "xnum": 3, "xwidth": 8 },
        { "macro": "Tree", "x": 896, "width": 64 },
        { "thing": "Koopa", "x": 952, "y": 12, "smart": true },
        { "macro": "Bridge", "x": 976, "y": 24, "width": 24 },

        { "macro": "Bridge", "x": 1024, "y": 24, "width": 120 },
        { "macro": "Fill", "thing": "Coin", "x": 1065, "y": 63, "xnum": 6, "xwidth": 8 },
        { "thing": "Koopa", "x": 1120, "y": 52, "jumping": true },

        { "macro": "Bridge", "x": 1176, "y": 8, "width": 64 },
        { "macro": "Fill", "thing": "Coin", "x": 1193, "y": 39, "xnum": 4, "xwidth": 8 },
        { "thing": "Koopa", "x": 1248, "y": 36, "jumping": true },

        { "macro": "Bridge", "x": 1280, "y": 24, "width": 64 },
        { "macro": "Bridge", "x": 1368, "y": 24, "width": 16 },
        { "macro": "Fill", "thing": "Coin", "x": 1385, "y": 55, "xnum": 6, "xwidth": 8 },
        { "macro": "Bridge", "x": 1400, "y": 24, "width": 16 },
        { "macro": "Bridge", "x": 1432, "y": 24, "width": 16 },
        { "macro": "Bridge", "x": 1472, "y": 24, "width": 72 },
        { "macro": "Tree", "x": 1536, "width": 104 },
        { "thing": "Stone", "x": 1544, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 1552, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 1560, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 1568, "y": 8 },
        { "macro": "CheepsStop", "x": 1600 },

        { "macro": "Floor", "x": 1656, "width": 280 },
        { "thing": "Stone", "x": 1664, "y": 8 },
        { "thing": "Stone", "x": 1672, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 1680, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 1688, "y": 32, "height": 32 },
        { "thing": "Stone", "x": 1696, "y": 40, "height": 40 },
        { "thing": "Stone", "x": 1704, "y": 48, "height": 48 },
        { "thing": "Stone", "x": 1712, "y": 56, "height": 56 },
        { "thing": "Stone", "x": 1720, "y": 64, "width": 16, "height": 64 },
        { "macro": "EndOutsideCastle", "x": 1796, "large": true, "walls": 6, "transport": { "map": "7-4" } }
      ]
    }
  ]
};
