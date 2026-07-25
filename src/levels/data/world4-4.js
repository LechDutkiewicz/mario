// World 4-4 — converted from FSM World44 (Castle maze). FSM builds this from
// repeating "sections" where the wrong path loops back; here the three
// sections are laid out linearly (bstretch = 30), so the route is a straight
// run through all the maze rooms instead of a loop.
export const world44Data = {
  "name": "4-4",
  "locations": [{ "entry": "Castle" }],
  "areas": [
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "StartInsideCastle", "width": 40 },
        { "macro": "Floor", "x": 40, "y": 24, "width": 16 },
        { "thing": "Stone", "x": 40, "y": 88, "width": 88, "height": 8 },
        { "macro": "Water", "x": 56, "width": 32 },
        { "macro": "Floor", "x": 72, "y": 24, "width": 16 },
        { "macro": "Water", "x": 88, "width": 32 },
        { "macro": "Floor", "x": 104, "y": 24, "width": 24 },

        { "macro": "Floor", "x": 128, "width": 640 },
        { "thing": "Stone", "x": 128, "y": 88, "width": 640, "height": 8 },
        { "thing": "Stone", "x": 144, "y": 56, "width": 48, "height": 32 },
        { "macro": "Fill", "thing": "Stone", "x": 200, "y": 56, "xnum": 5, "xwidth": 16, "width": 8, "height": 32 },
        { "thing": "Stone", "x": 280, "y": 56, "width": 24, "height": 32 },
        { "thing": "Stone", "x": 304, "y": 56, "width": 48, "height": 8 },
        { "macro": "Pipe", "x": 320, "height": 24, "piranha": true },
        { "thing": "Stone", "x": 352, "y": 56, "width": 136, "height": 32 },
        { "thing": "CastleBlock", "x": 424, "y": 56, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 480, "y": 32, "fireballs": 6, "direction": 1 },
        { "thing": "Stone", "x": 488, "y": 56, "width": 240, "height": 32 },
        { "thing": "Stone", "x": 744, "y": 24, "width": 24, "height": 24 },
        { "thing": "Stone", "x": 744, "y": 80, "width": 24, "height": 24 },

        { "macro": "Floor", "x": 768, "width": 64 },
        { "thing": "Stone", "x": 768, "y": 88, "width": 576, "height": 8 },
        { "thing": "Stone", "x": 816, "y": 24, "width": 16 },
        { "macro": "Water", "x": 832, "width": 32 },
        { "thing": "Stone", "x": 840, "y": 40, "width": 16 },
        { "macro": "Water", "x": 848, "width": 80 },
        { "macro": "Floor", "x": 848, "y": 16, "width": 8 },
        { "thing": "Stone", "x": 848, "y": 24, "width": 40 },
        { "thing": "Stone", "x": 872, "y": 48 },
        { "thing": "Stone", "x": 880, "y": 40, "height": 16 },
        { "macro": "Floor", "x": 888, "width": 216 },
        { "thing": "Stone", "x": 888, "y": 56, "height": 16 },
        { "thing": "Stone", "x": 896, "y": 24, "width": 208 },
        { "thing": "Stone", "x": 896, "y": 56, "width": 16 },
        { "thing": "Stone", "x": 928, "y": 56, "width": 32 },
        { "thing": "Stone", "x": 968, "y": 48, "height": 24 },
        { "thing": "Stone", "x": 968, "y": 56, "width": 24 },
        { "thing": "Stone", "x": 1008, "y": 56, "width": 96 },
        { "thing": "CastleBlock", "x": 1048, "y": 56, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 1096, "y": 24, "fireballs": 6, "direction": 1 },
        { "macro": "Floor", "x": 1104, "width": 240 },
        { "thing": "Stone", "x": 1104, "y": 24, "width": 240 },
        { "thing": "Stone", "x": 1104, "y": 56, "width": 240 },

        { "thing": "Stone", "x": 1344, "y": 64, "height": 40 },
        { "thing": "Stone", "x": 1344, "y": 88, "width": 264, "height": 24 },
        { "thing": "Stone", "x": 1352, "y": 80, "width": 16, "height": 16 },
        { "macro": "Floor", "x": 1344, "width": 80 },
        { "macro": "Floor", "x": 1416, "y": 24, "width": 32 },
        { "thing": "Stone", "x": 1416, "y": 88, "width": 64, "height": 8 },
        { "macro": "Floor", "x": 1440, "width": 32 },
        { "macro": "Floor", "x": 1464, "y": 24, "width": 16 },

        { "macro": "EndInsideCastle", "x": 1480 }
      ]
    }
  ]
};
