import {
  ActionRowBuilder,
  ButtonInteraction,
  ComponentType,
  Interaction, ModalSubmitInteraction, SelectMenuBuilder,
  SelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { InputContext, OutboundMessage } from './InputContext';
import { InteractionId, InteractionIntent } from './discord-utils/InteractionId';
import { KEY_INPUT, ModalContext } from './ModalContext';

export class ButtonContext extends InputContext {
  
  private readonly _interaction: ButtonInteraction;
  private static _invokeCounters = {}; 

  public get channelId(): string {
    return this._interaction.channelId;
  }

  public get userId(): string {
    return this._interaction.user.id;
  }
  
  public get userIcon(): string {
    return this._interaction.user.displayAvatarURL();
  }
  
  public get intent(): InteractionIntent {
    return InteractionId.getIntent(this._interaction.customId);
  }
  
  public constructor(interaction: ButtonInteraction) {
    super(interaction);
    this._interaction = interaction;
  }
  
  public async spawnModal(): Promise<ModalContext>   {
    const userInvokeCount = (ButtonContext._invokeCounters[this.userId] ?? 0) + 1;
    ButtonContext._invokeCounters[this.userId] = userInvokeCount;
    
    // TODO: Abstract modal config out so spawnModal is more generic
    await this._interaction.showModal({
      title: 'What would you like to do?',
      customId: `${this._interaction.customId}/Input`,
      components: [
        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(new TextInputBuilder({
            type: ComponentType.TextInput,
            customId: KEY_INPUT,
            label: 'Response',
            style: TextInputStyle.Paragraph
          })),
      ]
    });
    
    const result = await this._interaction.awaitModalSubmit({
      // IMPORTANT! Without this filter check, ANY modal submission passes this await, despite the base interaction being different.
      filter: r => 
        r.user.id === this._interaction.user.id 
        && ButtonContext._invokeCounters[this.userId] === userInvokeCount,
      time: 1000 * 60 * 15 // Longer than the stage but whatevs
    });
    
    return new ModalContext(result);
  }
  
  public markResolved(msg: OutboundMessage) {
    if (!this._interaction.deferred) {
      // TODO: Fix this if we're trying to send rich embeds via a resolution.
      this._interaction.update({
        content: msg.plainTxt,
        components: []
      });
    } else {
      this._interaction.editReply(this.buildDiscordMessage(msg));
    }
  }
  
  public async markThinking() {
    await this._interaction.deferReply();
  }
  
  public followUp(msg: OutboundMessage) {
    this._interaction.followUp({
      ...this.buildDiscordMessage(msg),
      allowedMentions: {
        repliedUser: false
      }
    });
  }
}