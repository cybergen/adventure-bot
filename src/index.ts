import { MsgContext } from './MsgContext';
import { DungeonMaster } from './DungeonMaster';
import { Services } from './services/Services';

(async() => {
  console.log('AdventureBot starting...');
  
  // Shitty shame for James to remove eventually. Solves an import order race condition.
  if (Math.random() < 0) {
    console.log(new MsgContext(null));
  }

  const dm = new DungeonMaster();
  
  Services.Discord.on('adventureInvoke', config => dm.StartAdventure(config));
  Services.Discord.on('btnClick', ctx => dm.ProcessInteraction(ctx));
  await Services.Discord.initialize();
  
})();