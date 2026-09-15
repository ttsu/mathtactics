import { AllDoneScreen } from './AllDoneScreen';
import { Hud } from './Hud';
import { LevelClearedOverlay } from './LevelClearedOverlay';
import { LoseScreen } from './LoseScreen';
import { MainMenu } from './MainMenu';
import { RotateOverlay } from './RotateOverlay';
import { UpdateBanner } from './UpdateBanner';
import { useAppStore } from './StoreContext';
import { WaveClearedOverlay } from './WaveClearedOverlay';
import { WinScreen } from './WinScreen';
import './ui.css';

export function App() {
  const screen = useAppStore((state) => state.screen);

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && (
        <>
          <Hud />
          <LevelClearedOverlay />
          <WaveClearedOverlay />
        </>
      )}
      {screen === 'allDone' && <AllDoneScreen />}
      {screen === 'won' && <WinScreen />}
      {screen === 'lost' && <LoseScreen />}
      <RotateOverlay />
      <UpdateBanner />
    </>
  );
}
