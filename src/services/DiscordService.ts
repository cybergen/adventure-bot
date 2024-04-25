import {
  ActionRowBuilder,
  Client, ComponentType,
  Events,
  GatewayIntentBits,
  Interaction, TextInputBuilder, TextInputStyle
} from 'discord.js';
import { Emitter } from '../Emitter';
import { ButtonContext } from '../ButtonContext';
import { InvokeContext } from '../InvokeContext';

export interface DiscordEvents {
  adventureInvoke: InvokeContext
  btnClick: ButtonContext
}

export class DiscordService extends Emitter<DiscordEvents> {

  private _client: Client
  
  public async initialize() {
    this._client = new Client({ intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
      ]});

    this._client.on('ready', () => {
      console.log('Discord bot ready.');
    });
    this._client.on(Events.InteractionCreate, this.OnInteraction.bind(this));

    this._client.login(process.env.DISCORD_API_KEY);
  }

  private async OnInteraction(interaction: Interaction) {
    if (interaction.isButton()) {
      this.emit('btnClick', new ButtonContext(interaction));
    } else if (interaction.isChatInputCommand()) {
      console.log('Adventure command received!');
      await interaction.showModal({
        customId: 'AdventureAwaits',
        title: 'Craft an Adventure',
        components: [
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(new TextInputBuilder({
              type: ComponentType.TextInput,
              customId: 'desc',
              label: 'Description',
              style: TextInputStyle.Paragraph
            })),
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(new TextInputBuilder({
              type: ComponentType.TextInput,
              customId: 'difficulty',
              label: 'Difficulty',
              style: TextInputStyle.Short
            })),
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(new TextInputBuilder({
              type: ComponentType.TextInput,
              customId: 'successCriteria',
              label: 'Success Criteria',
              style: TextInputStyle.Short
            })),
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(new TextInputBuilder({
              type: ComponentType.TextInput,
              customId: 'duration',
              label: 'Duration (minutes)',
              style: TextInputStyle.Short
            }))
        ]
      });
      
      const result = await interaction.awaitModalSubmit({
        time: 10 * 60 * 1000,
        // filter: s => s.user.id === interaction.user.id
      });
      // Needed to close the modal when invoked via chat command.
      result.deferUpdate();
      
      console.log('Adventure config modal completed.');
      
      const invokeContext = new InvokeContext(interaction);
      invokeContext.channelId = interaction.channelId;
      invokeContext.description = result.fields.getTextInputValue('desc');
      invokeContext.difficulty = result.fields.getTextInputValue('difficulty');
      invokeContext.successCriteria = result.fields.getTextInputValue('successCriteria');
      invokeContext.duration = result.fields.getTextInputValue('duration');
      
      this.emit('adventureInvoke',  invokeContext);
    }
  }
}