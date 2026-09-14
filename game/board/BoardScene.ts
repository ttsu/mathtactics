// The board scene (tasks 09–10): static chrome, a `BoardRenderer` kept in sync with the store, a
// `DragController` that turns drags into planning commands, and the playback `Director`.
//
// Board sync follows TR §10 flow step 5: during planning Phaser renders straight from `run`.
// While a resolved turn (or a Replay) plays back, the Director owns the board; when playback goes
// idle the board re-syncs from `run`.

import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import { isPlaybackActive, type AppStore } from '../state/store';
import { BoardRenderer } from './BoardRenderer';
import { bindStore } from './bindStore';
import { DragController } from './DragController';
import { drawBoardBackground } from './drawBoardBackground';
import { Director } from './playback/Director';
import { boardSliceChanged } from './pieces';

export class BoardScene extends Phaser.Scene {
  private playback: Director | null = null;

  constructor(private readonly store: StoreApi<AppStore>) {
    super('board');
  }

  /** The playback Director, once the scene has been created. */
  get director(): Director | null {
    return this.playback;
  }

  create(): void {
    drawBoardBackground(this);
    const renderer = new BoardRenderer(this, this.store.getState().data);
    const drag = new DragController(this.store, renderer);
    drag.attach(this);
    const director = new Director(this, renderer, this.store);
    this.playback = director;
    renderer.sync(this.store.getState().run);

    bindStore(this, this.store, (state, previous) => {
      if (isPlaybackActive(state)) {
        if (state.playback === previous.playback) return;
        // A new sequence: a just-resolved turn, or a Replay. Either way the board first shows the
        // run as it was before that turn, then the Director performs the events on it.
        drag.cancel();
        const { lastTurn } = state;
        if (lastTurn !== null && lastTurn.events === state.playback.events) {
          renderer.sync(lastTurn.before);
        }
        director.play(state.playback.events);
        return;
      }
      const playbackEnded = isPlaybackActive(previous);
      // Normally the Director itself ended playback; if the store reset it (a state installed
      // mid-sequence), abandon what's left.
      if (playbackEnded) director.stop();
      if (!playbackEnded && !boardSliceChanged(previous.run, state.run)) return;
      drag.cancel();
      renderer.sync(state.run);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.playback = null;
    });
  }
}
