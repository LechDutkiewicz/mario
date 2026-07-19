// World 3-3 — converted from FSM World33 (Overworld Night, tree platforms).
// FSM pushPreScale (pulley platforms) approximated as vertically floating
// Platform pairs; moveFalling platforms approximated as static platforms.
export const world33Data = {
  "name": "3-3",
  "locations": [{ "entry": "Plain" }],
  "areas": [
    {
      "setting": "Night",
      "blockBoundaries": true,
      "creation": [
        { "macro": "CastleSmall" },
        { "macro": "Pattern", "pattern": "BackCloud", "y": 4, "repeat": 7 },
        { "macro": "Floor", "width": 128 },

        { "macro": "Tree", "x": 144, "y": 24, "width": 40 },
        { "macro": "Tree", "x": 176, "y": 48, "width": 48 },
        { "thing": "Goomba", "x": 208, "y": 56 },
        { "thing": "Platform", "x": 240, "y": 72, "width": 24, "sliding": true, "begin": 228, "end": 260 },
        { "macro": "Tree", "x": 240, "width": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 249, "y": 7, "xnum": 2, "xwidth": 8 },
        { "thing": "Platform", "x": 264, "y": 40, "width": 24, "sliding": true, "begin": 244, "end": 276 },
        { "macro": "Tree", "x": 288, "y": 8, "width": 56 },
        { "thing": "Coin", "x": 298, "y": 55 },
        { "macro": "Fill", "thing": "Coin", "x": 337, "y": 55, "xnum": 3, "xwidth": 8 },
        { "macro": "Tree", "x": 344, "y": 32, "width": 32 },
        { "macro": "Tree", "x": 368, "y": 16, "width": 80 },
        { "macro": "Tree", "x": 376, "y": 48, "width": 48 },
        { "thing": "Block", "x": 392, "y": 80, "contents": "Mushroom" },
        { "macro": "Fill", "thing": "Coin", "x": 417, "y": 31, "xnum": 3, "xwidth": 8 },
        { "thing": "Koopa", "x": 416, "y": 60, "smart": true },
        { "thing": "Koopa", "x": 432, "y": 28, "smart": true },
        { "macro": "Tree", "x": 440, "y": 80, "width": 32 },
        { "macro": "Fill", "thing": "Coin", "x": 449, "y": 87, "xnum": 2, "xwidth": 8 },
        { "thing": "Platform", "x": 482, "y": 56, "width": 24, "falling": true },

        { "macro": "Tree", "x": 520, "width": 128 },
        { "macro": "Tree", "x": 520, "y": 48, "width": 24 },
        { "thing": "Coin", "x": 529, "y": 55 },
        { "macro": "Tree", "x": 552, "y": 48, "width": 24 },
        { "thing": "Coin", "x": 561, "y": 55 },
        { "thing": "Koopa", "x": 584, "y": 12, "smart": true },
        { "macro": "Tree", "x": 584, "y": 48, "width": 24 },
        { "thing": "Coin", "x": 593, "y": 55 },
        { "macro": "Tree", "x": 616, "y": 72, "width": 24 },
        { "thing": "Coin", "x": 625, "y": 79 },

        { "thing": "Platform", "x": 660, "y": 62, "width": 24, "floating": true, "begin": 24, "end": 76 },
        { "thing": "Platform", "x": 740, "y": 62, "width": 24, "floating": true, "begin": 24, "end": 76 },
        { "macro": "Tree", "x": 672, "y": 16, "width": 32 },

        { "thing": "Platform", "x": 752, "y": 32, "width": 24, "falling": true },
        { "thing": "Platform", "x": 768, "y": 64, "width": 24, "falling": true },
        { "macro": "Tree", "x": 776, "y": 32, "width": 24 },
        { "thing": "Platform", "x": 824, "y": 16, "width": 24, "falling": true },
        { "macro": "Tree", "x": 832, "y": 64, "width": 32 },
        { "macro": "Fill", "thing": "Coin", "x": 841, "y": 71, "xnum": 2, "xwidth": 8 },
        { "macro": "Tree", "x": 856, "y": 16, "width": 40 },
        { "thing": "Coin", "x": 865, "y": 23 },
        { "macro": "Tree", "x": 864, "y": 48, "width": 24 },
        { "thing": "Coin", "x": 873, "y": 55 },

        { "thing": "Koopa", "x": 912, "y": 66, "smart": true, "jumping": true, "floating": true, "begin": 14, "end": 66 },
        { "macro": "Tree", "x": 928, "width": 24 },
        { "macro": "Tree", "x": 952, "y": 24, "width": 96 },
        { "macro": "Fill", "thing": "Koopa", "x": 992, "y": 36, "xnum": 2, "xwidth": 14, "smart": true },
        { "thing": "Platform", "x": 1056, "y": 56, "width": 24 },

        { "thing": "Platform", "x": 1100, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 76 },
        { "thing": "Platform", "x": 1164, "y": 62, "width": 24, "floating": true, "begin": 30, "end": 76 },

        { "macro": "Floor", "x": 1152, "width": 256 },
        { "macro": "EndOutsideCastle", "x": 1204, "large": true, "walls": 13, "transport": { "map": "3-4" } }
      ]
    }
  ]
};
