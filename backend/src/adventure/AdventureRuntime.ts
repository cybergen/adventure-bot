import { Services } from '../services/Services';
import { describeResultsMessage } from '../services/OpenAIService';

export class AdventureRuntime {

  private readonly _players: string[] = [];
  private readonly _playerResponses: Record<string, string> = {}
  
  //Initial plan for course
  private _courseDescription: {
    players: string[],
    stages: number,
    name: string
  };
  private _history = '';
  private _currentStageContext = []; //Chat-like full text of current stage for coherency (resets for each stage)
  
  public get inputNeeded(): boolean {
    return this._players.length - Object.keys(this._playerResponses).length > 0;
  }
  
  public initialize(players: string[]) {
    const playerHistory: Array<{ player_id: string, history: [] }> = [];
    for (const player of players) {
      this._players.push(player);
      playerHistory[player] = {
        player_id: player,
        history: []
      };
    }
    this._history = `Course History:\n[]\n\nPlayer History:\n${JSON.stringify(playerHistory)}`;
  }
  
  public async setPrompt(prompt: string) {
    const courseDescRaw = await Services.OpenAI.getCourseDescription(prompt, this._players);
    this._courseDescription = JSON.parse(courseDescRaw);
    console.log(this._courseDescription);
    this._courseDescription.players = this._players;
    
    return this._courseDescription.name;
  }
  
  public async startStage(): Promise<string> {
    return await Services.OpenAI.getStageDescription(this._currentStageContext, this._courseDescription, this._history);
  }
  
  public getPlayersNeedingInput(): string[] {
    return this._players.filter(p => !this._playerResponses[p]);
  }
  
  public provideInput(player: string, action: string) {
    // Note: This does not handle modifying input. Everything is final.
    this._playerResponses[player] = action;
    const input = JSON.stringify({
      player,
      reply: action
    });
    this._currentStageContext.push({"role":"user","content":input});
  }
  
  public async endStage(): Promise<string> {
    const outcome = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":describeResultsMessage});

    this._history = await Services.OpenAI.getStageHistory(this._currentStageContext, this._history);
    
    return outcome;
  }
}