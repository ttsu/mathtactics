// Loads and validates the real `/data/*.json` content for the browser build (TR §9, task 05
// decision: "import the /data JSON via Vite and run parseGameData at startup"). The Node-side
// equivalent (for tests/CLIs) is `/tests/helpers/loadDataFiles.ts`.

import levels from '../../data/levels.json';
import difficulty from '../../data/difficulty.json';
import economy from '../../data/economy.json';
import presentation from '../../data/presentation.json';
import robots from '../../data/robots.json';
import shop from '../../data/shop.json';
import tiles from '../../data/tiles.json';
import waves from '../../data/waves.json';
import { parseGameData } from '../../sim/data/load';
import type { GameData } from '../../sim/data/schemas';

/** Validated `/data` content, parsed once at module load. Throws (loudly, at startup) if any
 * `/data/*.json` file is invalid — see `parseGameData`. */
export const gameData: GameData = parseGameData({
  tiles,
  robots,
  economy,
  shop,
  waves,
  difficulty,
  levels,
  presentation,
});
