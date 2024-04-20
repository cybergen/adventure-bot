import { InputContext } from './InputContext';
import { ModalSubmitInteraction } from 'discord.js';

export class ModalContext extends InputContext {
  
  private readonly _modal: ModalSubmitInteraction;
  
  public constructor(modal: ModalSubmitInteraction) {
    super(modal);
    this._modal = modal;
  }
}