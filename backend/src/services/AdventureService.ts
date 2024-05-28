import { Server, Socket } from 'socket.io';
import { AdventureSession } from '../adventure/AdventureSession';
import { compoundKey } from '@common/utils/CompoundKey';

export class AdventureService {
  
  private readonly _socketServer: Server;
  private readonly _activeSessions: Record<string, AdventureSession> = {};
  private readonly _userToSession: Record<string, AdventureSession> = {};

  public constructor(socketServer: Server) {
    this._socketServer = socketServer;
  }
  
  public registerUser(socket: Socket, guildId: string, channelId: string): AdventureSession {
    const sessionId = compoundKey(guildId, channelId);
    socket.join(sessionId);
    socket.on('disconnect', () => this.unregisterUser(socket.id));

    let session = this._activeSessions[sessionId];
    if (!session) {
      session = this._activeSessions[sessionId] = new AdventureSession(guildId, channelId, this._socketServer);
    }
    this._userToSession[socket.id] = session;
    
    return session;
  }
  
  public unregisterUser(id: string) {
    const session = this._userToSession[id];
    delete this._userToSession[id];
    
    session.removeUser(id);
    if (session.participantCount === 0) delete this._activeSessions[session.socketRoomId];
  }
}