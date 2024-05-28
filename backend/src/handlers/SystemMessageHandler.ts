import { API, ReturnData } from '@common/MessageTypes';
import { APIRequest, APIResponse, BindFunc, MessageHandler } from './MessageHandler';

export class SystemMessageHandler extends MessageHandler {

  public addBindings(bind: BindFunc<keyof API>): void {
    bind('VERSION', this.version);
  }
  
  private async version(request: APIRequest<'VERSION'>): APIResponse<'VERSION'> {
    return {
      major: 0,
      minor: 0,
      revision: 1
    };
  }
}