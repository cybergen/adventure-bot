import { API } from '@common/MessageTypes';
import { APIRequest, APIResponse, BindFunc, MessageHandler } from './MessageHandler';
import { Services } from '../services/Services';

export class AdventureMessageHandler extends MessageHandler {
  
  public addBindings(bind: BindFunc<keyof API>): void {
    bind('START_ACTIVITY', this.startActivity);
  }
  
  private async startActivity(request: APIRequest<'START_ACTIVITY'>): APIResponse<'START_ACTIVITY'> {
    const socketId = request.socket.id;
    Services.User.trackUser(socketId, request.payload.userId, request.payload.userName);
    
    const session = Services.Adventure.registerUser(request.socket, request.payload.guildId, request.payload.channelId);
    
    this._apiManager.addEphemeralBindings(request.socket, [
      { type: 'ADVENTURE_JOIN', binding: () => session.addUser(socketId) },
      { type: 'ADVENTURE_BEGIN', binding: () => session.startAdventure() },
      { type: 'ADVENTURE_START_DICTATION', binding: () => session.startDictation(socketId) },
      { type: 'ADVENTURE_END_DICTATION', binding: () => session.stopDictation(socketId) }
    ]);
  }
}