// World 3-4 — converted 1:1 from FSM World34 (Castle: rotating fire bars
// over elevated shelves, Podoboo lava pits, boss bridge). ceillev = 88.
export const world34Data = {
  "name": "3-4",
  "time": 300,
  "locations": [{ "entry": "Castle" }],
  "areas": [
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "StartInsideCastle", "width": 40 },

        { "thing": "Stone", "x": 40, "y": 88, "width": 88, "height": 24 },
        { "macro": "Floor", "x": 40, "y": 24, "width": 88 },
        { "thing": "Podoboo", "x": 128, "y": -32 },
        { "thing": "Stone", "x": 128, "y": 88, "width": 896, "height": 8 },

        { "macro": "Floor", "x": 144, "y": 24, "width": 24 },
        { "thing": "CastleBlock", "x": 152, "y": 16, "fireballs": 6 },
        { "macro": "Floor", "x": 184, "y": 24, "width": 24 },
        { "thing": "CastleBlock", "x": 192, "y": 16, "fireballs": 6 },
        { "thing": "Podoboo", "x": 208, "y": -32 },
        { "macro": "Floor", "x": 224, "y": 24, "width": 24 },
        { "thing": "CastleBlock", "x": 232, "y": 16, "fireballs": 6 },

        { "macro": "Floor", "x": 264, "width": 104 },
        { "thing": "Stone", "x": 264, "y": 24, "width": 16, "height": 24 },
        { "thing": "Stone", "x": 280, "y": 80, "width": 88, "height": 16 },
        { "thing": "Block", "x": 336, "y": 32 },
        { "thing": "Block", "x": 344, "y": 32, "contents": "Mushroom" },
        { "thing": "Block", "x": 352, "y": 32 },

        { "macro": "Floor", "x": 384, "width": 320 },
        { "thing": "Stone", "x": 424, "y": 8, "width": 24 },
        { "thing": "Stone", "x": 424, "y": 80, "width": 24, "height": 16 },
        { "thing": "CastleBlock", "x": 432, "y": 16, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 432, "y": 64, "fireballs": 6 },
        { "thing": "Stone", "x": 504, "y": 8, "width": 24 },
        { "thing": "Stone", "x": 504, "y": 80, "width": 24, "height": 16 },
        { "thing": "CastleBlock", "x": 512, "y": 16, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 512, "y": 64, "fireballs": 6 },
        { "thing": "Stone", "x": 632, "y": 8, "width": 24 },
        { "thing": "Stone", "x": 632, "y": 80, "width": 24, "height": 16 },
        { "thing": "CastleBlock", "x": 640, "y": 16, "fireballs": 6 },
        { "thing": "CastleBlock", "x": 640, "y": 64, "fireballs": 6, "direction": 1 },
        { "thing": "Podoboo", "x": 704, "y": -32 },
        { "macro": "Water", "x": 704, "width": 32 },

        { "macro": "Floor", "x": 720, "y": 24, "width": 48 },
        { "thing": "Stone", "x": 720, "y": 80, "width": 48, "height": 16 },
        { "macro": "Water", "x": 768, "width": 48 },
        { "thing": "Podoboo", "x": 776, "y": -32 },
        { "macro": "Floor", "x": 792, "y": 24, "width": 24 },
        { "macro": "Water", "x": 816, "width": 48 },
        { "thing": "Podoboo", "x": 824, "y": -32 },
        { "macro": "Floor", "x": 840, "y": 24, "width": 24 },
        { "macro": "Water", "x": 864, "width": 48 },
        { "thing": "Podoboo", "x": 872, "y": -32 },
        { "macro": "Floor", "x": 888, "width": 136 },
        { "thing": "Stone", "x": 888, "y": 24, "width": 40, "height": 24 },
        { "thing": "Stone", "x": 888, "y": 80, "width": 136, "height": 16 },
        { "thing": "Stone", "x": 944, "y": 24, "width": 80, "height": 24 },

        { "macro": "EndInsideCastle", "x": 1024 },
        { "macro": "Fill", "thing": "Brick", "x": 1056, "y": 64, "xnum": 2, "ynum": 3, "xwidth": 8, "yheight": 8 }
      ]
    }
  ]
};
