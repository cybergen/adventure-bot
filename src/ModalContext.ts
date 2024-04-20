import { InputContext } from './InputContext';
import { ModalSubmitInteraction } from 'discord.js';

export class ModalContext extends InputContext {
  
  private readonly _modal: ModalSubmitInteraction;

  public get channelId(): string {
    return this._modal.channelId;
  }
  
  public get userId(): string {
    return this._modal.user.id;
  }
  
  public constructor(modal: ModalSubmitInteraction) {
    super(modal);
    this._modal = modal;
  }
}