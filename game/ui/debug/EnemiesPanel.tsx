import { useState } from 'react';
import { LANES, type Lane } from '../../../sim/core/coords';
import { DEBUG_HP_PRESETS, debugAddRobot, defaultDebugHp } from '../../state/debug';
import { useAppStore } from '../StoreContext';
import { useDebugUi } from './DebugContext';

function templateLabel(id: string): string {
  return id.replace(/-/g, ' ');
}

export function EnemiesPanel() {
  const debug = useDebugUi();
  const robots = useAppStore((state) => state.data.robots);
  const [templateId, setTemplateId] = useState(robots[0]?.id ?? 'basic');
  const template = robots.find((robot) => robot.id === templateId) ?? robots[0];
  const [lane, setLane] = useState<Lane>(2);
  const [hp, setHp] = useState(defaultDebugHp(template?.isBoss ?? false));

  if (!template) {
    return (
      <div className="debug-panel" data-testid="debug-panel-enemies">
        <p className="debug-note">No robot templates in data.</p>
      </div>
    );
  }

  return (
    <div className="debug-panel" data-testid="debug-panel-enemies">
      <p className="debug-note">
        Spawns on the chosen lane, rightmost free cell. Starts a new run if you are on the menu.
      </p>
      <h3 className="debug-heading">Kind</h3>
      <div className="debug-grid">
        {robots.map((robot) => (
          <button
            key={robot.id}
            type="button"
            className={`debug-chip${robot.id === template.id ? ' is-selected' : ''}`}
            data-testid={`debug-robot-${robot.id}`}
            aria-pressed={robot.id === template.id}
            onClick={() => {
              setTemplateId(robot.id);
              setHp(defaultDebugHp(robot.isBoss));
            }}
          >
            {templateLabel(robot.id)}
          </button>
        ))}
      </div>
      <h3 className="debug-heading">Lane</h3>
      <div className="debug-grid">
        {Array.from({ length: LANES }, (_, index) => index as Lane).map((value) => (
          <button
            key={value}
            type="button"
            className={`debug-chip${value === lane ? ' is-selected' : ''}`}
            data-testid={`debug-lane-${value}`}
            aria-pressed={value === lane}
            onClick={() => setLane(value)}
          >
            {value + 1}
          </button>
        ))}
      </div>
      <h3 className="debug-heading">HP</h3>
      <div className="debug-grid">
        {DEBUG_HP_PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            className={`debug-chip${value === hp ? ' is-selected' : ''}`}
            data-testid={`debug-hp-${value}`}
            aria-pressed={value === hp}
            onClick={() => setHp(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="debug-action"
        data-testid="debug-add-enemy"
        onClick={() =>
          debug.apply(
            debugAddRobot(
              debug.store.getState().run,
              debug.store.getState().data,
              { templateId: template.id, lane, hp },
              debug.seed(),
            ),
          )
        }
      >
        Add {templateLabel(template.id)} · lane {lane + 1} · {hp} HP
      </button>
    </div>
  );
}
