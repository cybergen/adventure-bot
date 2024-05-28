import { AdventureStore } from './AdventureStore';
import { ClientSocketManager } from '../ClientSocketManager';
import { DiscordStore } from './DiscordStore';

export class Stores {
  public static Adventure: AdventureStore;
  public static Discord: DiscordStore;
  
  public constructor(socket: ClientSocketManager) {
    Stores.Adventure = new AdventureStore(socket);
    Stores.Discord = new DiscordStore(socket);
  }
}