import { AllDoneScreen } from './AllDoneScreen';
import { Hud } from './Hud';
import { LevelClearedOverlay } from './LevelClearedOverlay';
import { MainMenu } from './MainMenu';
import { RotateOverlay } from './RotateOverlay';
import { useAppStore } from './StoreContext';
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
        </>
      )}
      {screen === 'allDone' && <AllDoneScreen />}
      <RotateOverlay />
    </>
  );
}
