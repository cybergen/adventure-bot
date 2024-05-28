import { ClientSocketManager } from '../ClientSocketManager';

export abstract class Store {
  
  protected readonly _socket: ClientSocketManager;
  
  public constructor(socket: ClientSocketManager) {
    this._socket = socket;
  }
}