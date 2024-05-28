import { API } from '@common/MessageTypes';
import { APIRequest, APIResponse, BindFunc, MessageHandler } from './MessageHandler';
import * as fetch from 'node-fetch';
import { Config } from '../Config';

export class DiscordMessageHandler extends MessageHandler {
  public addBindings(bind: BindFunc<keyof API>): void {
      bind('AUTHENTICATE', this.authenticate)
  }
  
  private async authenticate(request: APIRequest<'AUTHENTICATE'>): APIResponse<'AUTHENTICATE'> {
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: Config.Discord.id,
        client_secret: Config.Discord.secret,
        grant_type: 'authorization_code',
        code: request.payload.code
      })
    });
    
    return await response.json();
  }
}