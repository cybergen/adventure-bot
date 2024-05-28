import { API, MessageType, ReturnData, SourceData } from '@common/MessageTypes';
import { Socket } from 'socket.io';
import ApiManager from './ApiManager';

export type BindFunc<T extends MessageType> = (/* auth: AuthRole, */ type: T, func: APIBinding<T>) => void;

export type APIBinding<T extends MessageType | number> = (request: APIRequest<T>) => APIResponse<T>;

export type APIRequest<T extends MessageType | number> = {
    // userId: string,
    // userRole: AuthRole,
    payload: SourceData<T>,
    socket?: Socket
}
export type APIResponse<T extends MessageType | number> = Promise<ReturnData<T>>;

export abstract class MessageHandler {
    
    protected readonly _apiManager: ApiManager;
    
    public constructor(apiManager: ApiManager) {
        this._apiManager = apiManager;
    }
    
    public abstract addBindings(bind: BindFunc<MessageType>): void
}