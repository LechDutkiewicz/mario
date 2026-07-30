// World 8-3 — converted from FSM World83. The Hammer Bro gauntlet: eight
// Cubones behind castle walls, plus cannons.
export const world83Data = {
  "name": "8-3",
  "time": 300,
  "locations": [{ "entry": "Plain" }],
  "areas": [
    {
      "setting": "Overworld",
      "blockBoundaries": true,
      "creation": [
        { "macro": "Pattern", "pattern": "BackFenceMin", "x": -384, "repeat": 7 },
        { "macro": "CastleSmall" },
        { "macro": "Floor", "width": 552 },
        { "thing": "Cannon", "x": 144, "y": 16, "height": 2 },
        { "thing": "Koopa", "x": 240, "y": 32, "jumping": true },
        { "thing": "Cannon", "x": 272, "y": 24, "height": 3 },
        { "macro": "Pipe", "x": 424, "height": 32, "piranha": true },
        { "macro": "Fill", "thing": "Brick", "x": 480, "y": 32, "xnum": 8, "xwidth": 8 },
        { "macro": "Fill", "thing": "Brick", "x": 480, "y": 64, "xnum": 6, "xwidth": 8 },
        { "thing": "HammerBro", "x": 504, "y": 12 },
        { "thing": "HammerBro", "x": 520, "y": 44 },
        { "thing": "Brick", "x": 528, "y": 64, "contents": "Mushroom" },
        { "thing": "Brick", "x": 536, "y": 64 },

        { "macro": "Floor", "x": 568, "width": 32 },
        { "thing": "Stone", "x": 568, "y": 32, "height": 32 },
        { "thing": "Stone", "x": 576, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 584, "y": 16, "height": 16 },
        { "thing": "Stone", "x": 592, "y": 8 },

        { "macro": "Floor", "x": 616, "width": 376 },
        { "thing": "Cannon", "x": 688, "y": 16, "height": 2 },
        { "thing": "Koopa", "x": 744, "y": 24, "jumping": true },
        { "thing": "Stone", "x": 760, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 872, "y": 32, "width": 16, "height": 32 },
        { "macro": "Fill", "thing": "Brick", "x": 920, "y": 32, "xnum": 8, "xwidth": 8 },
        { "thing": "Brick", "x": 920, "y": 64 },
        { "thing": "Brick", "x": 928, "y": 64, "contents": "Mushroom" },
        { "thing": "HammerBro", "x": 936, "y": 44 },
        { "macro": "Fill", "thing": "Brick", "x": 936, "y": 64, "xnum": 6, "xwidth": 8 },
        { "thing": "HammerBro", "x": 952, "y": 12 },

        { "macro": "Floor", "x": 1008, "width": 16 },
        { "macro": "Pipe", "x": 1008, "height": 32, "piranha": true },

        { "macro": "Floor", "x": 1040, "width": 536 },
        { "thing": "Koopa", "x": 1096, "y": 12 },
        { "thing": "HammerBro", "x": 1168, "y": 12 },
        { "thing": "HammerBro", "x": 1270, "y": 12 },
        { "macro": "Pipe", "x": 1344, "height": 24, "piranha": true },
        { "thing": "HammerBro", "x": 1416, "y": 12 },
        { "thing": "HammerBro", "x": 1480, "y": 12 },
        { "thing": "Brick", "x": 1520, "y": 32, "contents": "Coin" },
        { "thing": "Stone", "x": 1560, "y": 16, "height": 16 },

        { "thing": "Stone", "x": 1584, "y": 16 },
        { "thing": "Stone", "x": 1600, "y": 32 },
        { "thing": "Stone", "x": 1616, "y": 48 },
        { "thing": "Stone", "x": 1632, "y": 64, "width": 16, "height": 8 },
        { "macro": "Floor", "x": 1664, "width": 256 },
        { "macro": "EndOutsideCastle", "x": 1708, "large": true, "walls": 11, "transport": { "map": "8-4" } }
      ]
    }
  ]
};
