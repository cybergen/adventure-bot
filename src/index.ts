import { DiscordAPI } from './DiscordAPI';

(async() => {
  console.log('AdventureBot starting...');
  
  const discord = new DiscordAPI();
  discord.on('messageRx', args => {
    console.log(args);
  });
})();