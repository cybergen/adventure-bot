import { Message } from 'discord.js';
import { InputContext } from './InputContext';

export class MsgContext extends InputContext {
  
  private readonly _message: Message;
  
  public get channelId(): string {
    return this._message.channelId;
  }
  
  public get content(): string {
    return this._message.content;
  }
  
  public get userId(): string {
    return this._message.author.id;
  }

  public get userIcon(): string {
    return this._message.member.displayAvatarURL();
  }
  
  public get guild() {
    return this._message.guild;
  }
  
  public constructor(message: Message) {
    super(message);
    this._message = message;
  }
  
  public async getReactions(time: number): Promise<Array<string>> {
    const collector = this._message.createReactionCollector({ time });
    
    const users: string[] = [];
    
    collector.on('collect', (reaction, user) => {
      console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
      
      if (user.bot) return;
      if (users.includes(user.id)) return;
      users.push(user.id);
    });
    await new Promise(resolve => collector.on('end', resolve));
    
    return users;
  }
  
  // Returns the total number of users who reacted at least once.
  public countUsersWhoReacted(): number {
    const users = [];
    this._message.reactions.cache.forEach(r => {
      r.users.cache.forEach(u => {
        if (users.includes(u.id)) return;
        users.push(u.id);
      });
    });
    return users.length;
  }
}