// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+). Keys are forever.
//
// The charging current needs none: it is a device feature, set by the core's
// own "control a device" action. The charging mode is a text select, which
// the scene editor cannot set: it gets its own action — "charge now when the
// electricity is cheap", "stop when the house draws too much".
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { UserError } from './hub.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  /**
   * @param {import('./hub.js').ChargerHub} hub
   * @param {{ charger: string, mode: 'neutral'|'on'|'off' }} fields
   */
  async set_charge_mode(hub, fields) {
    logger.debug(`Scene action set_charge_mode <- ${fields.mode}`);
    try {
      await hub.setForceMode(fields.charger, fields.mode);
    } catch (err) {
      // The scene logs the error message: say it in English, plainly.
      throw err instanceof UserError ? new Error(err.userMessage.en) : err;
    }
    return undefined;
  },
};
