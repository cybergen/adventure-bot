import { InputContext, OutboundMessage } from './InputContext';
import { ModalSubmitInteraction } from 'discord.js';
import { MsgContext } from './MsgContext';

export const KEY_INPUT = 'input';

export class ModalContext extends InputContext {
  
  private readonly _modal: ModalSubmitInteraction;

  public get channelId(): string {
    return this._modal.channelId;
  }
  
  public get userId(): string {
    return this._modal.user.id;
  }
  
  public get userIcon(): string {
    return this._modal.user.displayAvatarURL();
  }
  
  public get input(): string {
    return this._modal.fields.getTextInputValue(KEY_INPUT);
  }
  
  public constructor(modal: ModalSubmitInteraction) {
    super(modal);
    this._modal = modal;
  }
  
  public override continue(msg: OutboundMessage): Promise<MsgContext> {
    this._modal.deferUpdate();
    return super.continue(msg);
  }
}