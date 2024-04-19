import { OpenAIService } from './OpenAIService';
import { DiscordService } from './DiscordService';

export module Services {
  
  export const Discord: DiscordService = new DiscordService();
  // export const OpenAI: OpenAIService = new OpenAIService();
  
}