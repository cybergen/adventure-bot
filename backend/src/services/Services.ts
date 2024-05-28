import { DiscordService } from './DiscordService';
import { AdventureService } from './AdventureService';
import { Server } from 'socket.io';
import { UserService } from './UserService';
import { OpenAIService } from './OpenAIService';

export module Services {
  
  export const Discord: DiscordService = new DiscordService();
  export const User: UserService = new UserService();
  export const OpenAI: OpenAIService = new OpenAIService();
  
  export let Adventure: AdventureService;
  
  export async function initialize(socketServer: Server) { 
    Adventure = new AdventureService(socketServer);
    
    await Discord.initialize();
  }
}