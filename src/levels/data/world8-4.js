// World 8-4 — converted from FSM World84: the final maze. Five castle rooms
// connected by pipes; only one pipe per room leads onward, the rest send you
// back to the hub pipe in room 1. Ends in the underwater fire-bar corridor
// and the final boss.
export const world84Data = {
  "name": "8-4",
  "locations": [
    { "entry": "Castle" }, { "entry": "PipeVertical" }, { "entry": "PipeVertical" },
    { "entry": "PipeVertical" }, { "entry": "PipeVertical" }, { "entry": "PipeVertical" }
  ],
  "areas": [
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "StartInsideCastle", "width": 40 },
        { "thing": "Stone", "x": 40, "y": 24, "height": 24 },
        { "thing": "Stone", "x": 40, "y": 88, "width": 256, "height": 8 },
        { "macro": "Water", "x": 48, "width": 80 },
        { "thing": "Stone", "x": 88, "width": 64 },
        { "macro": "Pipe", "x": 152, "height": 88, "piranha": true, "entrance": 1 },
        { "macro": "Floor", "x": 168, "width": 88 },

        { "macro": "Floor", "x": 256, "width": 240 },
        { "thing": "Stone", "x": 256, "y": 88, "width": 664, "height": 8 },
        { "macro": "Pipe", "x": 496, "height": 88, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 512, "width": 72 },
        { "macro": "Fill", "thing": "Goomba", "x": 532, "y": 8, "xnum": 3, "xwidth": 12 },
        { "macro": "Floor", "x": 584, "y": 24, "width": 32 },
        { "macro": "Water", "x": 616, "width": 272 },
        { "thing": "Platform", "x": 648, "width": 16, "sliding": true, "begin": 636, "end": 728 },
        { "macro": "Floor", "x": 752, "y": 24, "width": 48 },
        { "thing": "Stone", "x": 760, "y": 56, "width": 32 },
        { "macro": "Pipe", "x": 800, "y": 40, "height": 40, "piranha": true, "transport": 2 },
        { "macro": "Floor", "x": 816, "y": 24, "width": 56 },
        { "macro": "Pipe", "x": 872, "y": 48, "height": 48, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 888, "y": 24, "width": 32 }
      ]
    },
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "Floor", "width": 240 },
        { "thing": "Stone", "y": 88, "width": 720, "height": 8 },
        { "macro": "Pipe", "x": 240, "height": 88, "piranha": true, "entrance": 2 },
        { "macro": "Floor", "x": 256, "width": 40 },
        { "macro": "Pipe", "x": 296, "y": 24, "height": 24, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 312, "width": 64 },
        { "macro": "Fill", "thing": "BuzzyBeetle", "x": 344, "y": 8.5, "xnum": 2, "xwidth": 16 },
        { "macro": "Pipe", "x": 376, "height": 88, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 392, "width": 64 },
        { "thing": "Koopa", "x": 432, "y": 32, "jumping": true },
        { "thing": "Koopa", "x": 448, "y": 24, "jumping": true },
        { "macro": "Pipe", "x": 456, "y": 24, "height": 24, "piranha": true, "transport": 1 },
        { "macro": "Water", "x": 472, "width": 48 },
        { "macro": "Floor", "x": 496, "width": 344 },
        { "thing": "Block", "x": 520, "y": 32, "contents": "Coin", "hidden": true },
        { "thing": "Stone", "x": 536, "y": 32, "width": 16 },
        { "macro": "Pipe", "x": 536, "y": 32, "height": 24, "piranha": true, "transport": 3 },
        { "thing": "Koopa", "x": 560, "y": 20, "jumping": true },
        { "thing": "Koopa", "x": 576, "y": 24, "jumping": true }
      ]
    },
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "Floor", "width": 24 },
        { "thing": "Stone", "y": 88, "width": 560, "height": 8 },
        { "macro": "Pipe", "x": 24, "height": 88, "piranha": true, "entrance": 3 },
        { "macro": "Floor", "x": 40, "width": 8 },
        { "macro": "Floor", "x": 48, "y": 24, "width": 48 },
        { "macro": "Pipe", "x": 96, "y": 40, "height": 40, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 112, "y": 24, "width": 48 },
        { "macro": "Pipe", "x": 160, "y": 48, "height": 48, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 176, "y": 24, "width": 48 },
        { "macro": "Water", "x": 224, "width": 64 },
        { "macro": "Floor", "x": 256, "y": 24, "width": 32 },
        { "macro": "Pipe", "x": 288, "y": 40, "height": 40, "piranha": true, "transport": 4 },
        { "macro": "Floor", "x": 304, "y": 24, "width": 240 }
      ]
    },
    {
      "setting": "Underwater",
      "underwater": true,
      "blockBoundaries": true,
      "creation": [
        { "thing": "Stone", "y": 88, "width": 16, "height": 88 },
        { "macro": "Floor", "x": 16, "width": 8 },
        { "macro": "Pipe", "x": 24, "height": 88, "entrance": 4 },
        { "macro": "Floor", "x": 40, "width": 536 },
        { "thing": "Stone", "x": 48, "y": 24, "width": 40, "height": 24 },
        { "thing": "Stone", "x": 48, "y": 80, "width": 40, "height": 16 },
        { "thing": "Stone", "x": 48, "y": 88, "width": 528, "height": 8 },
        { "thing": "Stone", "x": 88, "y": 32, "width": 56, "height": 32 },
        { "thing": "Stone", "x": 88, "y": 80, "width": 56, "height": 24 },
        { "thing": "CastleBlock", "x": 160, "y": 46, "fireballs": 6, "direction": 1 },
        { "thing": "Blooper", "x": 224, "y": 16 },
        { "thing": "CastleBlock", "x": 248, "y": 22, "fireballs": 6, "direction": 1 },
        { "thing": "Stone", "x": 312, "y": 24, "width": 24, "height": 24 },
        { "thing": "Stone", "x": 312, "y": 80, "width": 24, "height": 24 },
        { "thing": "CastleBlock", "x": 320, "y": 54, "fireballs": 6, "direction": 1 },
        { "thing": "Blooper", "x": 408, "y": 24 },
        { "thing": "Blooper", "x": 424, "y": 56 },
        { "thing": "CastleBlock", "x": 446, "y": 38, "fireballs": 6, "direction": 1 },
        { "thing": "CastleBlock", "x": 512, "y": 44, "fireballs": 6, "direction": 1 },
        { "thing": "Stone", "x": 536, "y": 32, "width": 40, "height": 32 },
        { "thing": "Stone", "x": 536, "y": 80, "width": 40, "height": 24 },
        { "thing": "PipeHorizontal", "x": 544, "y": 48, "transport": 5 },
        { "thing": "Stone", "x": 552, "y": 56, "width": 24, "height": 24 }
      ]
    },
    {
      "setting": "Castle",
      "blockBoundaries": true,
      "creation": [
        { "macro": "Pipe", "height": 88, "piranha": true, "entrance": 5 },
        { "thing": "Stone", "y": 88, "width": 232, "height": 8 },
        { "macro": "Floor", "x": 16, "width": 40 },
        { "macro": "Pipe", "x": 56, "height": 88, "piranha": true, "transport": 1 },
        { "macro": "Floor", "x": 72, "width": 72 },
        { "thing": "HammerBro", "x": 112, "y": 12 },
        { "macro": "Water", "x": 128, "width": 112 },
        { "thing": "Podoboo", "x": 160, "y": -32 },
        { "macro": "Floor", "x": 184, "y": 24, "width": 48 },
        { "thing": "Stone", "x": 184, "y": 80, "width": 48, "height": 16 },
        { "macro": "EndInsideCastle", "x": 232, "hard": true }
      ]
    }
  ]
};
