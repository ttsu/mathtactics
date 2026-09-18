// Extensible debug panels. Append to `DEBUG_PANELS` to add a future option — the menu renders
// whatever is listed here. Each panel is a React screen; mutations live in `/game/state/debug`.
import type { ComponentType } from 'react';
import { EnemiesPanel } from './EnemiesPanel';
import { JumpPanel } from './JumpPanel';
import { SnapshotPanel } from './SnapshotPanel';
import { TilesPanel } from './TilesPanel';

export interface DebugPanelDef {
  id: string;
  title: string;
  Panel: ComponentType;
}

export const DEBUG_PANELS: DebugPanelDef[] = [
  { id: 'jump', title: 'Jump', Panel: JumpPanel },
  { id: 'tiles', title: 'Tiles', Panel: TilesPanel },
  { id: 'enemies', title: 'Enemies', Panel: EnemiesPanel },
  { id: 'snapshot', title: 'Copy', Panel: SnapshotPanel },
];
