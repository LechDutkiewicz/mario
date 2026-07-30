// World 5-4 — converted from FSM World54 (castle: long fire-bar gauntlet,
// lava pits with Podoboos, platform-generator lift section, boss)
export const world54Data = {
  "name": "5-4",
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

        { "macro": "Water", "x": 128, "width": 256 },
        { "thing": "Podoboo", "x": 128, "y": -32 },
        { "thing": "Stone", "x": 144, "y": 32, "width": 16, "height": 8 },
        { "thing": "Podoboo", "x": 160, "y": -24 },
        { "thing": "Stone", "x": 176, "y": 48, "width": 24, "height": 8 },
        { "thing": "CastleBlock", "x": 184, "y": 48, "fireballs": 12, "direction": 1 },
        { "thing": "Block", "x": 184, "y": 80, "contents": "Mushroom" },
        { "thing": "Stone", "x": 216, "y": 32, "width": 16, "height": 8 },
        { "thing": "Podoboo", "x": 240, "y": -32 },

        { "macro": "Floor", "x": 256, "width": 416 },
        { "thing": "Stone", "x": 256, "y": 24, "width": 16, "height": 24 },
        { "thing": "Stone", "x": 272, "y": 88, "width": 392, "height": 32 },
        { "thing": "Stone", "x": 296, "y": 32, "width": 288, "height": 8 },
        { "thing": "CastleBlock", "x": 344, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 392, "y": 32, "fireballs": 6 },
        { "thing": "CastleBlock", "x": 440, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 440, "y": 64, "fireballs": 6 },
        { "thing": "CastleBlock", "x": 488, "y": 32, "fireballs": 6 },
        { "thing": "CastleBlock", "x": 536, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 584, "y": 32, "fireballs": 6 },
        { "thing": "Stone", "x": 640, "y": 24, "width": 32, "height": 32 },
        { "thing": "CastleBlock", "x": 656, "y": 56, "fireballs": 6 },

        { "macro": "PlatformGenerator", "x": 686, "width": 3, "direction": -1 },
        { "macro": "PlatformGenerator", "x": 710, "width": 3, "direction": 1 },

        { "macro": "Floor", "x": 736, "y": 16, "width": 8 },
        { "thing": "CastleBlock", "x": 736, "y": 24, "fireballs": 6, "direction": 1 },
        { "macro": "Floor", "x": 744, "y": 24, "width": 48 },
        { "thing": "Stone", "x": 744, "y": 88, "width": 48, "height": 24 },
        { "macro": "Floor", "x": 792, "width": 80 },
        { "macro": "Fill", "thing": "Coin", "x": 817, "y": 7, "xnum": 3, "ynum": 2, "xwidth": 8, "yheight": 32 },
        { "thing": "CastleBlock", "x": 824, "y": 16, "fireballs": 6 },

        { "thing": "Stone", "x": 864, "y": 24, "height": 24 },
        { "macro": "Water", "x": 872, "width": 32 },
        { "thing": "Podoboo", "x": 872, "y": -32 },
        { "macro": "Floor", "x": 888, "y": 24, "width": 16 },
        { "macro": "Water", "x": 904, "width": 32 },
        { "thing": "Podoboo", "x": 904, "y": -32 },

        { "macro": "Floor", "x": 920, "width": 104 },
        { "thing": "Stone", "x": 920, "y": 24, "width": 40, "height": 24 },
        { "thing": "Stone", "x": 920, "y": 88, "width": 104, "height": 24 },
        { "macro": "Fill", "thing": "Stone", "x": 976, "y": 24, "xnum": 2, "xwidth": 32, "width": 16, "height": 24 },

        { "macro": "Fill", "thing": "Brick", "x": 1024, "y": 64, "xnum": 6, "xwidth": 8 },
        { "macro": "EndInsideCastle", "x": 1024 },
        { "thing": "Podoboo", "x": 1048, "y": -40 }
      ]
    }
  ]
};
