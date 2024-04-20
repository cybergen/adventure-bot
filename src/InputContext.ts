import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType, EmbedBuilder,
  Message,
  MessageCreateOptions, ModalSubmitInteraction
} from 'discord.js';
import { MsgContext } from './MsgContext';
import { InteractionId, InteractionIntent } from './discord-utils/InteractionId';

export type ButtonConfig = Array<{txt: string, intent: InteractionIntent}>;
export type TextSegment = { header: string, body: string };

export type OutboundMessage = Partial<{
  ephemeral: boolean
  plainTxt: string,
  segments: TextSegment[],
  buttons: ButtonConfig
}>;

export abstract class InputContext {
  
  protected _base: Message | ButtonInteraction | ModalSubmitInteraction;
  
  public abstract get channelId(): string;
  public abstract get userId(): string;
  
  protected constructor(base: Message | ButtonInteraction | ModalSubmitInteraction) {
    this._base = base;
  }
  
  public async reply(msg: OutboundMessage) {
    // TODO: Add a type guard to ensure this can't proc on modal variants
    await this._base.reply(this.buildDiscordMessage(msg));
  }
  
  public async continue(msg: OutboundMessage): Promise<MsgContext> {
    const sentMsg = await this._base.channel.send(this.buildDiscordMessage(msg));
    return new MsgContext(sentMsg);
  }
  
  private buildDiscordMessage(msg: OutboundMessage): object {
    // TODO: Type this properly
    const request: any = {};
    if (msg.ephemeral) request.ephemeral = true;
    if (msg.plainTxt) request.content = msg.plainTxt;
    if (msg.buttons) request.components = this.buildButtonRow(msg.buttons);
    if (msg.segments) request.embeds = this.buildEmbeds(msg.segments);
    return request;
  }
  
  private buildButtonRow(config: ButtonConfig): MessageCreateOptions['components'] {
    const buttons: ButtonBuilder[] = config.map(b => new ButtonBuilder({
      type: ComponentType.Button,
      customId: InteractionId.create(this.channelId, b.intent),
      label: b.txt,
      style: ButtonStyle.Secondary,
    }));
    
    return [
      new ActionRowBuilder<ButtonBuilder>({
        type: ComponentType.ActionRow,
        components: buttons
      })
    ];
  }
  
  private buildEmbeds(embeds: TextSegment[]): EmbedBuilder[] {
    return embeds.map(e => new EmbedBuilder()
      .setColor(0x3eb2e5)
      .setTitle(e.header)
      .setDescription(e.body)
    );
  }
}