import { Socket } from 'socket.io-client';
import { MessageType, ReturnData, SourceData } from '@common/MessageTypes';
import { Notification, NotificationTypes } from '@common/NotificationTypes';

interface SocketMsg {
  type: number;
  payload: string;
}

export type NotifyCallback<T extends Notification> = (arg: NotificationTypes[T]) => void;

export class ClientSocketManager {
  
  private readonly _socket: Socket;
  private readonly _subscriptionMap: Partial<{ [key in Notification]: Function[] }> = {};
  
  public readonly ready: Promise<void>;

  public constructor() {
    console.log('Creating socket.');

    let readyResolve: () => void;
    this.ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
    });

    // @ts-ignore
    const socketHost = `${location.origin}`;
    // @ts-ignore
    this._socket = io(socketHost);
    this._socket.on('connect_error', err => {
      console.warn(`Socket connection error: ${err}`);
    });
    this._socket.on('connect', () => {
      console.log('Socket connected.');
      readyResolve();
    });
    this._socket.on('disconnect', () => console.log('Socket disconnected.'));
    this._socket.on('notify', this.onNotify.bind(this));
    this._socket.on('reconnection_attempt', (attempt) => {
      console.log(`Socket reconnection attempt #${attempt}`)
    });
  }

  public async request<T extends MessageType>(type: T, payload: SourceData<T>): Promise<ReturnData<T>> {
    return new Promise((resolve, reject) => {
      this._socket.emit('msg', {
        type,
        payload,
        // token: this._auth
      }, (response: ReturnData<T>) => {
        if (response.success === true) {
          resolve(response.data);
        } else {
          reject(response.error ?? 'Unspecified Error.');
        }
      })
    });
  }

  public subscribe<T extends Notification>(caller: object, type: T, cb: NotifyCallback<T>): void {
    let lookup = this._subscriptionMap[type];
    if (!lookup) {
      lookup = this._subscriptionMap[type] = [];
    }
    lookup.push(cb.bind(caller));
  }

  public unsubscribe<T extends Notification>(type: MessageType, cb: NotifyCallback<T>): void {
    let lookup = this._subscriptionMap[type];
    if (!lookup) return;

    for (let i = 0; i < lookup.length; i++) {
      if (lookup[i] === cb) {
        lookup.splice(i, 1);
        break;
      }
    }

    if (lookup.length === 0) {
      delete this._subscriptionMap[type];
    }
  }
  
  private async onNotify(data: SocketMsg) {
    const lookup = this._subscriptionMap[data.type];
    if (!lookup) return;

    for (const callback of lookup) {
      try {
        callback(data.payload);
      } catch (err) {
        console.error(`Error invoking message callback => ${data.type} : ${err}`)
      }
    }
  }
}