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
import { planningHintMarks } from './planningHints';
import { DangerGlow } from './playback/DangerGlow';
import { Director } from './playback/Director';
import { boardSliceChanged } from './pieces';

export class BoardScene extends Phaser.Scene {
  private playback: Director | null = null;
  private boardRenderer: BoardRenderer | null = null;

  constructor(private readonly store: StoreApi<AppStore>) {
    super('board');
  }

  /** The playback Director, once the scene has been created. */
  get director(): Director | null {
    return this.playback;
  }

  /** The board renderer, once the scene has been created (test handle `renderedBoard`). */
  get boardView(): BoardRenderer | null {
    return this.boardRenderer;
  }

  create(): void {
    drawBoardBackground(this);
    const renderer = new BoardRenderer(this, this.store.getState().data);
    this.boardRenderer = renderer;
    const drag = new DragController(this.store, renderer);
    drag.attach(this);
    const director = new Director(this, renderer, this.store);
    this.playback = director;
    const dangerGlow = new DangerGlow(this, renderer);
    const dangerSettings = () => this.store.getState().data.presentation.danger;
    const applyHints = (state: AppStore) => {
      renderer.syncHints(
        planningHintMarks(
          state.run,
          state.data,
          state.settings.hints,
          !isPlaybackActive(state),
        ),
        state.data.presentation.hints.color,
      );
    };
    // A new sequence — a just-resolved turn, a fresh run/wave's spawns, or a Replay. Either way the
    // board first shows where the sequence starts (`playback.before`: the pre-turn run, or an
    // empty wave start), then the Director performs the events on it.
    const startPlayback = (state: AppStore) => {
      drag.cancel();
      dangerGlow.sync(null, dangerSettings());
      const { before } = state.playback;
      if (before !== undefined) renderer.sync(before);
      renderer.syncHints([], state.data.presentation.hints.color);
      director.play(state.playback.events);
    };

    const initial = this.store.getState();
    renderer.sync(initial.run);
    dangerGlow.sync(isPlaybackActive(initial) ? null : initial.run, dangerSettings());
    applyHints(initial);
    // Playback may already be under way if a turn was dispatched before this scene existed.
    if (isPlaybackActive(initial)) startPlayback(initial);

    bindStore(this, this.store, (state, previous) => {
      if (isPlaybackActive(state)) {
        if (state.playback !== previous.playback) startPlayback(state);
        return;
      }
      const playbackEnded = isPlaybackActive(previous);
      // Normally the Director itself ended playback; if the store reset it (a state installed
      // mid-sequence), abandon what's left without reporting anything back.
      if (playbackEnded) director.stop();
      const boardChanged = playbackEnded || boardSliceChanged(previous.run, state.run);
      const hintsFlagChanged = previous.settings.hints !== state.settings.hints;
      const phaseChanged = previous.run?.phase !== state.run?.phase;
      if (!boardChanged && !hintsFlagChanged && !phaseChanged) return;
      if (boardChanged) {
        drag.cancel();
        renderer.sync(state.run);
        dangerGlow.sync(state.run, dangerSettings());
      }
      applyHints(state);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.playback = null;
      this.boardRenderer = null;
    });
  }
}
