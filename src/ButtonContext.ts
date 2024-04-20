import {
  ActionRowBuilder,
  ButtonInteraction,
  ComponentType,
  Interaction, ModalSubmitInteraction, SelectMenuBuilder,
  SelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { InputContext } from './InputContext';
import { InteractionId, InteractionIntent } from './discord-utils/InteractionId';
import { KEY_INPUT, ModalContext } from './ModalContext';

export class ButtonContext extends InputContext {
  
  private readonly _interaction: ButtonInteraction;

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
      time: 1000 * 60 * 15 // Longer than the stage but whatevs
    });
    
    return new ModalContext(result);
  }
}