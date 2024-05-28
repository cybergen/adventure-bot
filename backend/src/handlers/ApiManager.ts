import { APIBinding, APIRequest, MessageHandler } from './MessageHandler';
import { API, MessageResponse, MessageType } from '@common/MessageTypes';
import { Socket } from 'socket.io';
import { KnownError } from '@common/errors/KnownError';

type Request = { type: number; payload: {}, token?: string };

export default class ApiManager {

  private readonly _serverName: string;
  private _initialized: boolean = false;
  
  private readonly _msgBindings: { [type: MessageType]: { /* auth: AuthRole ,*/ func: APIBinding<any> } } = {};
  private readonly _ephemeralBindings: Record<string, Record<MessageType, { /* auth: AuthRole ,*/ func: APIBinding<any> }>> = {};
  
  public constructor(serverName: string) {
    this._serverName = serverName;
  }
  
  public initialize(handlers: MessageHandler[]) {
    console.log('Adding API bindings...');
    for (const handler of handlers) {
      handler.addBindings(<T extends MessageType> (/* auth: AuthRole,*/ type: T, func: APIBinding<T>) => {
          if (this._initialized) {
            console.error(`Attempting to add API binding after initialization! `)
          }
          // @ts-ignore
          if (this._msgBindings[type]) {
            console.warn(`Duplicate API binding attempt for ${type}`);
            return;
          }
          // @ts-ignore
          this._msgBindings[type] = {
            // auth,
            func: func.bind(handler)
          }
        }
      );
    }
    this._initialized = true;
    console.log('API bindings registered.');
  }
  
  public addEphemeralBindings<T extends MessageType>(socket: Socket, bindings: Array<{ type: T, binding: APIBinding<T> }>) {
    let socketOverrides = this._ephemeralBindings[socket.id];
    if (!socketOverrides) {
      socketOverrides = this._ephemeralBindings[socket.id] = {};
    }
    
    for (const { type, binding } of bindings) {
      if (socketOverrides[type]) throw new KnownError(`Ephemeral binding already exists for ${type} (${socket.id})`);
      socketOverrides[type] = { func: binding };
    }
  }

  public addSocket(socket: Socket) {
    socket.on('msg', async (data: Request, respond) => {
      console.log(`[${socket.id}] ${data.type}`);
      const rtn = await this.consumeMessage(socket.id, data, socket);
      respond(rtn);
    });
  }

  private async consumeMessage(senderId: string, data: Request, socket: Socket): Promise<MessageResponse<any>> {
    if (!data.type) {
      console.warn(`Received message with no type:`, data);
      return {
        server: this._serverName,
        success: false,
        error: 'Message must contain type.'
      };
    }
    // console.log(`[${senderId}] ${MessageType[data.type]}`);
    
    let binding: { func: APIBinding<any> };
    
    // Check for ephemerals
    const ephemerals = this._ephemeralBindings[socket.id];
    if (ephemerals) binding = ephemerals[data.type];
    
    // Find default binding
    if (!binding) binding = this._msgBindings[data.type];
    
    if (!binding) {
      console.warn(`Unsupported message type: ${data.type}`, data);
      return {
        server: this._serverName,
        success: false,
        error: `Unsupported message type: ${data.type}`
      };
    }

    const request: APIRequest<any> = <any> { payload: data.payload, socket };

    // if (binding.auth !== AuthRole.Public && !data.token) {
    //   return { server: this._serverName, success: false, error: 'Unauthorized.' };
    // }
    // if (data.token) {
    //   try {
    //     const jwt = Services.Auth.verify(data.token, binding.auth);
    //     request.userId = jwt.user;
    //     request.userRole = jwt.role;
    //   } catch (err) {
    //     return { server: this._serverName, success: false, error: err.message };
    //   }
    // }

    try {
      return {
        server: this._serverName,
        success: true,
        data: await binding.func(request)
      };
    } catch (err) {
      if (err instanceof KnownError) {
        console.log(`${err.name}:`, err);
        return { server: this._serverName, success: false, error: err.message };
      } else {
        // Obfuscate unknown errors to avoid data leaks
        console.error(`Unknown error:`, err);
        return { server: this._serverName, success: false, error: 'Unknown error.' };
      }
    }
  }
}