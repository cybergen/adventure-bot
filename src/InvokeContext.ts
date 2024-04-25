import { InputContext } from './InputContext';
import { ChatInputCommandInteraction } from 'discord.js';

export class InvokeContext extends InputContext {

  private readonly _cmd: ChatInputCommandInteraction;
  
  public channelId: string;
  public description: string;
  public difficulty: string;
  public successCriteria: string;
  public duration: string;

  public get userId(): string {
    return this._cmd.user.id;
  }
  public get userIcon(): string {
    return this._cmd.user.displayAvatarURL();
  }
  public get userName(): string {
    // Not the right one
    return this._cmd.user.displayName;
  }
  
  public constructor(cmd: ChatInputCommandInteraction) {
    super(cmd);
    this._cmd = cmd;
  }
}