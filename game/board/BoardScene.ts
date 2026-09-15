// The planning board scene (task 09): static chrome, plus a `BoardRenderer` kept in sync with the
// store and a `DragController` that turns drags into planning commands.
//
// Board sync follows TR §10 flow step 5: during planning Phaser renders straight from `run`.
// While a resolved turn is playing back, the board is left alone (the playback Director, task
// 10, owns it then) and re-syncs when playback finishes.

import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import { isPlaybackActive, type AppStore } from '../state/store';
import { BoardRenderer } from './BoardRenderer';
import { bindStore } from './bindStore';
import { DragController } from './DragController';
import { drawBoardBackground } from './drawBoardBackground';
import { boardSliceChanged } from './pieces';

export class BoardScene extends Phaser.Scene {
  constructor(private readonly store: StoreApi<AppStore>) {
    super('board');
  }

  create(): void {
    drawBoardBackground(this);
    const renderer = new BoardRenderer(this, this.store.getState().data);
    const drag = new DragController(this.store, renderer);
    drag.attach(this);
    renderer.sync(this.store.getState().run);

    bindStore(this, this.store, (state, previous) => {
      if (isPlaybackActive(state)) {
        if (!isPlaybackActive(previous)) drag.cancel();
        return;
      }
      const playbackEnded = isPlaybackActive(previous);
      if (!playbackEnded && !boardSliceChanged(previous.run, state.run)) return;
      drag.cancel();
      renderer.sync(state.run);
    });
  }
}
