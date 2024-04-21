import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle, ChatInputCommandInteraction,
  ComponentType, EmbedBuilder, InteractionReplyOptions,
  Message,
  MessageCreateOptions, MessagePayload, MessageReplyOptions, ModalSubmitInteraction
} from 'discord.js';
import { InteractionId, InteractionIntent } from './discord-utils/InteractionId';
import { MsgContext } from './MsgContext';

export type ButtonConfig = Array<{txt: string, intent: InteractionIntent}>;
export type TextSegment = { 
  user?: { icon: string, name: string, footer?: boolean }, 
  header?: string, 
  body: string,
  meta?: Array<{name: string, value: string, short: boolean}>
};

export type OutboundMessage = Partial<{
  ephemeral: boolean
  plainTxt: string,
  segments: TextSegment[],
  buttons: ButtonConfig
}>;

export abstract class InputContext {
  
  protected _base: Message | ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;
  
  public abstract get channelId(): string;
  public abstract get userId(): string;
  public abstract get userIcon(): string;
  
  protected constructor(base: Message | ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction) {
    this._base = base;
  }
  
  public async reply(msg: OutboundMessage) {
    // @ts-ignore
    await this._base.reply(this.buildDiscordMessage(msg));
  }
  
  public async continue(msg: OutboundMessage): Promise<MsgContext> {
    const sentMsg = await this._base.channel.send(this.buildDiscordMessage(msg));
    return new MsgContext(sentMsg);
  }
  
  protected buildDiscordMessage(msg: OutboundMessage): MessageReplyOptions & InteractionReplyOptions {
    const request: MessageReplyOptions & InteractionReplyOptions = <any> {};
    if (msg.ephemeral) request.ephemeral = true;
    if (msg.plainTxt) request.content = msg.plainTxt;
    if (msg.buttons) request.components = this.buildButtonRow(msg.buttons);
    if (msg.segments) request.embeds = this.buildEmbeds(msg.segments);
    return request;
  }
  
  private buildButtonRow(config: ButtonConfig): MessageCreateOptions['components'] {
    const buttons: ButtonBuilder[] = config.map(b => {
      const button = new ButtonBuilder()
        .setCustomId(InteractionId.create(this.channelId, b.intent))
        .setStyle(ButtonStyle.Secondary);
      if (b.txt.startsWith(':') && b.txt.endsWith(':')) {
        // button.setEmoji(b.txt);
        // TODO: Fix this silliness.
        button.setLabel(b.txt);
      } else {
        button.setLabel(b.txt);
      }
      return button;
    });
    
    return [
      new ActionRowBuilder<ButtonBuilder>({
        type: ComponentType.ActionRow,
        components: buttons
      })
    ];
  }
  
  private buildEmbeds(embeds: TextSegment[]): EmbedBuilder[] {
    return embeds.map(e => {
      const embed = new EmbedBuilder()
        .setColor(0x3eb2e5)
        .setDescription(e.body);
      if (e.header) embed.setTitle(e.header);
      if (e.user) {
        if (e.user.footer) {
          embed.setFooter({
            iconURL: e.user.icon,
            text: e.user.name
          });
        } else {
          embed.setAuthor({
            name: e.user.name,
            iconURL: e.user.icon
          });
        }
      }
      if (e.meta) {
        for (const entry of e.meta) {
          embed.addFields({
            name: entry.name,
            value: entry.value,
            inline: entry.short
          });
        }
      }
      return embed;
    });
  }
}