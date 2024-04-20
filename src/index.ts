import { DungeonMaster } from './DungeonMaster';
import { Services } from './services/Services';

(async() => {
  console.log('AdventureBot starting...');

  const dm = new DungeonMaster();
  
  Services.Discord.on('messageRx', ctx => {
    dm.ProcessMessage(ctx);
  });
  await Services.Discord.initialize();
  
})();