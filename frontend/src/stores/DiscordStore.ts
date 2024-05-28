import { Store } from './Store';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { ClientSocketManager } from '../ClientSocketManager';
import { writable, Writable } from 'svelte/store';

// @ts-ignore
const env = import.meta.env;

export let discord: Writable<DiscordStore>;

export class DiscordStore extends Store {
  
  private _discord: DiscordSDK;
  public user: {
    username: string;
    discriminator: string;
    id: string;
    public_flags: number;
    avatar?: string | null | undefined;
    global_name?: string | null | undefined;
  } = <any> {
    id: 'sdfsdfsdf'
  };

  public constructor(socketManager: ClientSocketManager) {
    super(socketManager);
    
    discord = writable(this);
  }
  
  public async login() {
    this._discord = new DiscordSDK(env.VITE_DISCORD_CLIENT_ID);
    await this._discord.ready();

    const {code} = await this._discord.commands.authorize({
      client_id: env.VITE_DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds']
    });

    const data = await this._socket.request('AUTHENTICATE', { code });
    
    const auth = await this._discord.commands.authenticate({
      access_token: data.access_token
    });
    
    this.user = auth.user;
  }
  
  public async startActivity() {
    await this._socket.request('START_ACTIVITY', {
      guildId: this._discord.guildId!,
      channelId: this._discord.channelId!,
      userId: this.user.id,
      userName: this.user.username
    });
  }
}