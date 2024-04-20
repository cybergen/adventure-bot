import { Adventure } from './Adventure';
import { CHAT_INVOKE_CMD } from './Constants';
import { MsgContext } from './MsgContext';
import { ButtonContext } from './ButtonContext';

export class DungeonMaster {
  
  // Eventually: Backup this state out of runtime memory.
  private _adventures: Adventure[] = [];
  
  public async ProcessMessage(msg: MsgContext) {
    const adventure: Adventure = this._adventures[msg.channelId];
    if (!adventure) {
      if (!msg.content.toLowerCase().startsWith(CHAT_INVOKE_CMD)) return;
      
      // Spinup new adventure
      const adventure = new Adventure();
      adventure.on('concluded', () => {
        this._adventures.splice(this._adventures.indexOf(adventure), 1);
      });
      
      this._adventures[msg.channelId] = adventure;
      
      adventure.initialize(msg);
      
    } else {
      // Continue existing adventure
      // adventure.addPlayerInput(msg);
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