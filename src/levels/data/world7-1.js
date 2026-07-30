// World 7-1 — converted from FSM World71. The cannon gauntlet: 13 Bill
// Blasters plus four Cubones.
export const world71Data = {
  "name": "7-1",
  "locations": [{ "entry": "Plain" }, { "entry": "PipeVertical" }, { "area": 1 }],
  "areas": [
    {
      "setting": "Overworld",
      "blockBoundaries": true,
      "creation": [
        { "macro": "CastleLarge", "x": 0 },
        { "macro": "Pattern", "pattern": "BackFence", "repeat": 6 },
        { "macro": "Floor", "width": 584 },
        { "thing": "Cannon", "x": 152, "y": 16, "height": 2 },
        { "thing": "Koopa", "x": 208, "y": 22, "jumping": true },
        { "thing": "Brick", "x": 216, "y": 64, "contents": "Mushroom" },
        { "thing": "Cannon", "x": 224, "y": 8, "height": 1 },
        { "thing": "Cannon", "x": 224, "y": 24, "height": 2 },
        { "macro": "Fill", "thing": "Brick", "x": 224, "y": 64, "xnum": 2, "xwidth": 8 },
        { "thing": "Cannon", "x": 288, "y": 16, "height": 2 },
        { "macro": "Fill", "thing": "Block", "x": 312, "y": 32, "xnum": 4, "xwidth": 8 },
        { "thing": "Koopa", "x": 352, "y": 28, "jumping": true },
        { "thing": "Cannon", "x": 368, "y": 24, "height": 3 },
        { "thing": "Koopa", "x": 424, "y": 22, "jumping": true },
        { "thing": "Cannon", "x": 448, "y": 8, "height": 1 },
        { "thing": "Cannon", "x": 448, "y": 24, "height": 2 },
        { "macro": "Fill", "thing": "Brick", "x": 496, "y": 32, "xnum": 2, "xwidth": 8 },
        { "thing": "Stone", "x": 512, "y": 32 },
        { "thing": "Cannon", "x": 512, "y": 48, "height": 2 },
        { "thing": "Koopa", "x": 520, "y": 16, "jumping": true },
        { "thing": "Brick", "x": 520, "y": 32, "contents": "Coin" },
        { "thing": "Brick", "x": 528, "y": 32 },
        { "thing": "Cannon", "x": 544, "y": 16, "height": 2 },

        { "macro": "Floor", "x": 600, "width": 616 },
        { "macro": "Pipe", "x": 608, "height": 24, "piranha": true },
        { "macro": "Fill", "thing": "Brick", "x": 656, "y": 32, "xnum": 7, "ynum": 2, "xwidth": 8, "yheight": 32 },
        { "thing": "HammerBro", "x": 680, "y": 44 },
        { "thing": "HammerBro", "x": 692, "y": 76 },
        { "macro": "Pipe", "x": 744, "height": 24, "piranha": true, "transport": 2 },
        { "thing": "Block", "x": 744, "y": 64, "contents": "Mushroom1Up", "hidden": true },
        { "thing": "Cannon", "x": 832, "y": 16, "height": 2 },
        { "macro": "Pipe", "x": 872, "height": 24, "piranha": true },
        { "thing": "Koopa", "x": 912, "y": 12 },
        { "macro": "Pipe", "x": 920, "height": 16, "piranha": true, "entrance": 1 },
        { "thing": "Cannon", "x": 976, "y": 16, "height": 2 },
        { "macro": "Pipe", "x": 1024, "height": 16, "piranha": true },
        { "macro": "Fill", "thing": "Brick", "x": 1072, "y": 32, "xnum": 5, "ynum": 2, "xwidth": 8, "yheight": 32 },
        { "thing": "HammerBro", "x": 1080, "y": 12 },
        { "thing": "HammerBro", "x": 1096, "y": 44 },
        { "thing": "Stone", "x": 1128, "y": 24, "height": 24 },
        { "thing": "Cannon", "x": 1168, "y": 8, "height": 1 },
        { "thing": "Cannon", "x": 1168, "y": 24, "height": 2 },
        { "macro": "Fill", "thing": "Brick", "x": 1192, "y": 40, "xnum": 2, "xwidth": 8 },
        { "thing": "Springboard", "x": 1208, "y": 14.5 },
        { "thing": "Brick", "x": 1208, "y": 88, "contents": "Mushroom" },

        { "macro": "Floor", "x": 1224, "width": 400 },
        { "thing": "Stone", "x": 1224, "y": 8 },
        { "macro": "Fill", "thing": "Brick", "x": 1224, "y": 56, "xnum": 2, "xwidth": 8 },
        { "thing": "Stone", "x": 1232, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 1240, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 1248, "y": 32, "height": 32 },
        { "thing": "Stone", "x": 1256, "y": 40, "height": 40 },
        { "thing": "Stone", "x": 1264, "y": 48, "height": 48 },

        { "thing": "Stone", "x": 1296, "y": 8 },
        { "thing": "Stone", "x": 1304, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 1312, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 1320, "y": 32, "height": 32 },
        { "thing": "Stone", "x": 1328, "y": 40, "height": 40 },
        { "thing": "Stone", "x": 1336, "y": 48, "height": 48 },
        { "thing": "Stone", "x": 1344, "y": 56, "height": 56 },
        { "thing": "Stone", "x": 1352, "y": 64, "width": 16, "height": 64 },
        { "thing": "BuzzyBeetle", "x": 1352, "y": 72.5 },

        { "macro": "EndOutsideCastle", "x": 1428, "transport": { "map": "7-2" } }
      ]
    },
    {
      "setting": "Underworld",
      "blockBoundaries": true,
      "creation": [
        { "macro": "Ceiling", "x": 32, "width": 56 },
        { "macro": "Floor", "width": 136 },
        { "macro": "Fill", "thing": "Brick", "y": 8, "ynum": 11, "yheight": 8 },
        { "macro": "Fill", "thing": "Brick", "x": 32, "y": 8, "xnum": 7, "ynum": 3, "xwidth": 8, "yheight": 8 },
        { "macro": "Fill", "thing": "Coin", "x": 33, "y": 31, "xnum": 7, "ynum": 2, "xwidth": 8, "yheight": 16 },
        { "macro": "Fill", "thing": "Coin", "x": 41, "y": 63, "xnum": 5, "xwidth": 8 },
        { "thing": "PipeHorizontal", "x": 104, "y": 16, "transport": 1 },
        { "thing": "PipeVertical", "x": 120, "y": 88, "height": 88 }
      ]
    }
  ]
};
