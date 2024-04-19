import { Client, Events, GatewayIntentBits, Interaction, Message, MessageType } from 'discord.js';
import { Emitter } from './Emitter';

export interface DiscordEvents {
  messageRx: {
    channelId: string,
    author: {
      id: string,
      name: string
    },
    message: string
  }
}

export class DiscordAPI extends Emitter<DiscordEvents> {
  
  private _client: Client
  
  public constructor() {
    super();
    
    this._client = new Client({ intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.MessageContent, 
      GatewayIntentBits.GuildMessageReactions, 
      GatewayIntentBits.GuildMembers
    ]});
    
    this._client.on('ready', () => {
      console.log('Discord bot ready.');
    });
    this._client.on(Events.MessageCreate, this.OnMessage);
    this._client.on(Events.InteractionCreate, this.OnInteraction);
    
    this._client.login(process.env.DISCORD_API_KEY);
  }
  
  private async OnMessage(msg: Message) {
    if (msg.author.bot) return;
    
    const channelId = msg.channelId;
    
    if (!msg.content.startsWith('!adventure') && msg.type !== MessageType.Reply) return;
    
    if (msg.reference) {
      // TODO: Discordjs caches fetch resolves I think? Check this.
      const replyOf = await msg.channel.messages.fetch(msg.reference.messageId!);
      if (replyOf.author.id !== this._client.user?.id) return;
    }

    this.emit('messageRx', {
      channelId,
      author: {
        id: msg.author.id,
        name: msg.author.displayName
      },
      message: msg.content
    });
  }
  
  private async OnInteraction(interaction: Interaction) {
    
  }
}