import { Message, ReactionCollector } from 'discord.js';
import { InputContext } from './InputContext';

export class MsgContext extends InputContext {
  
  private readonly _message: Message;
  private _usersReacted: string[];
  private _reactionCollector: ReactionCollector;
  
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
  
  public startReactionCollection() {
    this._usersReacted = [];
    
    this._reactionCollector = this._message.createReactionCollector();
    this._reactionCollector.on('collect', (reaction, user) => {
      console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);

      if (user.bot) return;
      if (this._usersReacted.includes(user.id)) return;
      this._usersReacted.push(user.id);
    });
  }
  
  public stopReactionCollection(): string[] {
    this._reactionCollector.stop();
    return this._usersReacted;
  }
}