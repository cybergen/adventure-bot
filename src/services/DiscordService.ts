import { Client, Events, GatewayIntentBits, Interaction, Message, MessageType } from 'discord.js';
import { Emitter } from '../Emitter';
import { CHAT_INVOKE_CMD } from '../Constants';
import { MsgContext } from '../MsgContext';

export interface DiscordEvents {
  messageRx: MsgContext
}

export class DiscordService extends Emitter<DiscordEvents> {

  private _client: Client
  
  public async initialize() {
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
    this._client.on(Events.MessageCreate, this.OnMessage.bind(this));
    this._client.on(Events.InteractionCreate, this.OnInteraction.bind(this));

    this._client.login(process.env.DISCORD_API_KEY);
  }

  private async OnMessage(msg: Message) {
    if (msg.author.bot) return;

    if (!msg.content.startsWith(CHAT_INVOKE_CMD) && msg.type !== MessageType.Reply) {
      return;
    }

    if (msg.reference) {
      // TODO: Discordjs caches fetch resolves I think? Check this.
      const replyOf = await msg.channel.messages.fetch(msg.reference.messageId!);
      if (replyOf.author.id !== this._client.user?.id) return;
    }

    console.log('should emit')
    this.emit('messageRx', new MsgContext(msg));
  }

  private async OnInteraction(interaction: Interaction) {

  }
  
}