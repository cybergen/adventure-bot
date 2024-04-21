import { Adventure } from './Adventure';
import { CHAT_INVOKE_CMD } from './Constants';
import { ButtonContext } from './ButtonContext';
import { InvokeContext } from './InvokeContext';

export class DungeonMaster {
  
  // Eventually: Backup this state out of runtime memory.
  private _adventures: Adventure[] = [];
  
  public async StartAdventure(config: InvokeContext) {
    const adventure: Adventure = this._adventures[config.channelId];
    if (!adventure) {
      // Spinup new adventure
      const adventure = new Adventure();
      adventure.on('concluded', () => {
        this._adventures.splice(this._adventures.indexOf(adventure), 1);
      });

      this._adventures[config.channelId] = adventure;

      adventure.initialize(config);
    }
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