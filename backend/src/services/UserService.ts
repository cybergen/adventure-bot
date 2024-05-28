import { AdventureState } from '@common/AdventureState';

export type User = AdventureState['participants'][0];

export class UserService {
  
  private readonly _socketLookup: Record<string, User> = {};
  private readonly _discordLookup: Record<string, User> = {};
  
  public trackUser(socketId: string, discordId: string, discordName: string) {
    this._socketLookup[socketId] = this._discordLookup[discordId] = {
      systemId: socketId,
      discordId,
      name: discordName
    };
  }
  
  public getBySocket(socketId: string) {
    return this._socketLookup[socketId];
  }
  
  public getByDiscord(discordId: string) {
    return this._discordLookup[discordId];
  }
}