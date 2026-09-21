import { AllDoneScreen } from './AllDoneScreen';
import { DifficultyScreen } from './DifficultyScreen';
import { DebugHost } from './debug';
import { Hud } from './Hud';
import { LevelClearedOverlay } from './LevelClearedOverlay';
import { LoseScreen } from './LoseScreen';
import { MainMenu } from './MainMenu';
import { PuzzleSelectScreen } from './PuzzleSelectScreen';
import { RotateOverlay } from './RotateOverlay';
import { SettingsScreen } from './SettingsScreen';
import { ShopScreen } from './ShopScreen';
import { UpdateBanner } from './UpdateBanner';
import { useAppStore } from './StoreContext';
import { WaveClearedOverlay } from './WaveClearedOverlay';
import { WinScreen } from './WinScreen';
import './ui.css';

export function App() {
  const screen = useAppStore((state) => state.screen);

  return (
    <DebugHost>
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && (
        <>
          <Hud />
          <LevelClearedOverlay />
          <WaveClearedOverlay />
        </>
      )}
      {screen === 'shop' && <ShopScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'difficulty' && <DifficultyScreen />}
      {screen === 'levelSelect' && <PuzzleSelectScreen />}
      {screen === 'allDone' && <AllDoneScreen />}
      {screen === 'won' && <WinScreen />}
      {screen === 'lost' && <LoseScreen />}
      <RotateOverlay />
      <UpdateBanner />
    </DebugHost>
  );
}
