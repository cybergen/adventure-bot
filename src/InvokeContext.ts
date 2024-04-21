import { InputContext } from './InputContext';
import { ChatInputCommandInteraction } from 'discord.js';

export class InvokeContext extends InputContext {

  public channelId: string;
  public description: string;
  public difficulty: string;

  public get userId(): string {
    throw new Error('Method not implemented.');
  }
  public get userIcon(): string {
    throw new Error('Method not implemented.');
  }
  
  public constructor(cmd: ChatInputCommandInteraction) {
    super(cmd);
  }
}