import { Message } from 'discord.js';

export class MsgContext {
  
  private readonly _message: Message;
  
  public get channelId(): string {
    return this._message.channelId;
  }
  
  public get content(): string {
    return this._message.content;
  }
  
  public get author(): { id: string, name: string } {
    return {
      id: this._message.author.id,
      name: this._message.member.displayName
    };
  }
  
  public get guild() {
    return this._message.guild;
  }
  
  public constructor(message: Message) {
    this._message = message;
  }
  
  public async reply(msg: string) {
    await this._message.reply({
      content: msg,
      allowedMentions: { repliedUser: true }
    });
  }
  
  public async continue(msg: string): Promise<MsgContext> {
    const sentMsg = await this._message.channel.send(msg);
    return new MsgContext(sentMsg);
  }
  
  public async getReactions(time: number): Promise<Array<{ id: string, name: string }>> {
    const collector = this._message.createReactionCollector({ time });
    
    const users = [];
    
    collector.on('collect', (reaction, user) => {
      console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
      
      if (user.bot) return;
      users.push({ id: user.id, name: user.displayName });
    });
    await new Promise(resolve => collector.on('end', resolve));
    
    return users;
  }
}