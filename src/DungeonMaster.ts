import { Adventure } from './Adventure';
import { CHAT_INVOKE_CMD } from './Constants';
import { ButtonContext } from './ButtonContext';
import { InvokeContext } from './InvokeContext';

export class DungeonMaster {
  
  // Eventually: Backup this state out of runtime memory.
  private _adventures: Record<string, Adventure> = {};
  
  public async StartAdventure(config: InvokeContext) {
    const existing: Adventure = this._adventures[config.channelId];
    if (existing) {
      config.reply({
        ephemeral: true,
        plainTxt: "An adventure is currently ongoing in this channel!"
      });
      return;
    }

    // Spinup new adventure
    const adventure = new Adventure();
    this._adventures[config.channelId] = adventure;

    adventure.on('concluded', () => {
      delete this._adventures[config.channelId];
    });
    
    adventure.initialize(config);
  }
  
  public async ProcessInteraction(ctx: ButtonContext) {
    const adventure: Adventure = this._adventures[ctx.channelId];
    if (!adventure) {
      console.log('Button click but no active adventure.');
      return;
    }
    
    adventure.handlePlayerInput(ctx);
  }
}