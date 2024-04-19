import { Adventure } from './Adventure';
import { CHAT_INVOKE_CMD } from './Constants';
import { MsgContext } from './MsgContext';

export class DungeonMaster {
  
  // Eventually: Backup this state out of runtime memory.
  private _adventures: Adventure[] = [];
  
  public async ProcessMessage(msg: MsgContext) {
    const adventure = this._adventures[msg.channelId];
    if (!adventure) {
      console.log('maybe')
      if (!msg.content.toLowerCase().startsWith(CHAT_INVOKE_CMD)) return;
      console.log('woo');
      
      // Spinup new adventure
      // const adventure = new Adventure();
      // this._adventures[msg.channelId] = adventure;
      
      // adventure.initialize(msg);
    } else {
      // Continue existing adventure
    }
  }
}