// World 6-3 — converted from FSM World63 (night tree/platform gauntlet with
// springboards, balance scales and falling platforms)
export const world63Data = {
  "name": "6-3",
  "locations": [{ "entry": "Plain" }],
  "areas": [
    {
      "setting": "Night",
      "blockBoundaries": true,
      "creation": [
        { "macro": "CastleSmall" },
        { "macro": "Pattern", "pattern": "BackCloud", "y": 4, "repeat": 4 },
        { "macro": "Floor", "width": 128 },

        { "macro": "Tree", "x": 144, "width": 24 },
        { "macro": "Tree", "x": 168, "y": 32, "width": 24 },
        { "macro": "Tree", "x": 192, "width": 24 },
        { "thing": "Platform", "x": 224, "width": 16, "floating": true, "begin": 0, "end": 56 },
        { "macro": "Fill", "thing": "Coin", "x": 226, "y": 87, "xnum": 2, "xwidth": 8 },

        { "macro": "Tree", "x": 248, "y": 32, "width": 32 },
        { "macro": "Tree", "x": 296, "width": 24 },
        { "thing": "Springboard", "x": 304, "y": 14.5 },
        { "macro": "Tree", "x": 344, "width": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 345, "y": 71, "xnum": 7, "xwidth": 8 },
        { "thing": "Platform", "x": 348, "y": 64, "width": 16, "sliding": true, "begin": 312, "end": 364 },
        { "thing": "Platform", "x": 388, "y": 47, "width": 16, "sliding": true, "begin": 356, "end": 400 },
        { "macro": "Tree", "x": 392, "y": 16, "width": 32 },

        { "thing": "Block", "x": 440, "y": 80, "contents": "Mushroom" },
        { "thing": "Platform", "x": 444, "y": 56, "width": 16, "sliding": true, "begin": 408, "end": 464 },
        { "thing": "Platform", "x": 480, "y": 7, "width": 16, "floating": true, "begin": -8, "end": 52 },
        { "macro": "Tree", "x": 520, "y": 32, "width": 40 },

        { "macro": "Scale", "x": 572, "y": 86, "width": 8, "platWidth": 16, "left": 4, "right": 12 },
        { "macro": "Scale", "x": 636, "y": 86, "width": 6, "platWidth": 16, "left": 4, "right": 12 },

        { "macro": "Tree", "x": 680, "y": 24, "width": 40 },
        { "macro": "Tree", "x": 680, "y": 80, "width": 24 },
        { "macro": "Fill", "thing": "Coin", "x": 681, "y": 87, "xnum": 3, "xwidth": 8 },
        { "macro": "Tree", "x": 720, "y": 40, "width": 24 },
        { "macro": "Tree", "x": 744, "width": 24 },
        { "macro": "Tree", "x": 776, "width": 32 },
        { "macro": "Fill", "thing": "Coin", "x": 801, "y": 39, "xnum": 4, "xwidth": 8 },
        { "macro": "Tree", "x": 824, "width": 24 },
        { "macro": "Tree", "x": 856, "y": 32, "width": 40 },
        { "macro": "Tree", "x": 904, "width": 40 },
        { "thing": "Springboard", "x": 928, "y": 14.5 },

        { "thing": "Platform", "x": 972, "y": 63, "width": 16, "sliding": true, "begin": 940, "end": 992 },
        { "macro": "Tree", "x": 984, "width": 24 },
        { "macro": "Scale", "x": 1020, "y": 86, "width": 6, "platWidth": 16, "left": 6, "right": 12 },
        { "macro": "Tree", "x": 1056, "width": 32 },
        { "macro": "Tree", "x": 1056, "y": 64, "width": 24 },
        { "macro": "Tree", "x": 1080, "y": 32, "width": 32 },

        { "thing": "Platform", "x": 1128, "y": 47, "width": 16, "falling": true },
        { "thing": "Platform", "x": 1160, "y": 55, "width": 16, "falling": true },
        { "macro": "Fill", "thing": "Coin", "x": 1161, "y": 47, "xnum": 2, "xwidth": 8 },
        { "thing": "Platform", "x": 1192, "y": 39, "width": 16, "falling": true },
        { "thing": "Platform", "x": 1224, "y": 47, "width": 16, "falling": true },
        { "macro": "Fill", "thing": "Coin", "x": 1233, "y": 79, "xnum": 2, "xwidth": 8 },
        { "macro": "Tree", "x": 1248, "y": 64, "width": 24 },

        { "macro": "Floor", "x": 1280, "width": 256 },
        { "macro": "EndOutsideCastle", "x": 1332, "large": true, "walls": 13, "transport": { "map": "6-4" } }
      ]
    }
  ]
};
