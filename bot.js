const { Client, GatewayIntentBits } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// When the client is ready, run this code
client.once('ready', () => {
    console.log('Ready!');
});

// Listen for messages
client.on('messageCreate', message => {
  // Ignore messages sent by the bot itself
  if (message.author.bot) return;
  
  console.log(`Message from ${message.author.tag}: ${message.content}`);
  //console.log(`Rest of message info: ${JSON.stringify(message)}`);
  //console.log(`Message authorId ${message.authorId} and type ${typeof(message.authorId)}`)
  console.log(`Properties ${Object.keys(message)}`);
  console.log(`Author ${Object.keys(message.author)}`);

  if (message.author.id == 203643843764158465) {
    message.reply('ay james can go fuck himself');
  }

  if (message.author.id == 203557247454806016) {
    //message.reply('i can hear you');
    console.log('Brian posted');
  }    
});

// Login to Discord with your app's token
client.login('MTIyNjcyNjYxNDg4NTMzNTE2Mg.GtEOHd.XRZgKJGceKjP-T_5zaF-gDI41q-2sgzTewxvQE');