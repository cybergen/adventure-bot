
import { MsgContext } from './MsgContext';
import { Emitter } from './Emitter';
import { JOIN_DURATION, POST_STAGE_DURATION, STAGE_RESPONSE_DURATION } from './Constants';
import { Services } from './services/Services';
import { Delay } from './Delay';

//Some commands for the chat bot
const describeResultsMessage = "Time's up!";

enum AdventureState {
  Idle = 'idle',
  Collecting = 'collecting',
  Active = 'active',
  PostStage = 'post-stage',
  InputStage = 'input-stage'
}

export interface AdventureEvents {
  concluded: null
}

export class Adventure extends Emitter<AdventureEvents> {
  
  private _state: AdventureState;
  private _startMsg: MsgContext;
  private _players: string[];

  //Initial plan for course
  private _courseDescription: {
    players: string[],
    stages: number,
    name: string
  };
  //Overall history of stages in the course
  private _courseHistory = [];
  //History of what has befallen each player over time
  private _playerHistory = [];
  //Chat-like full text of current stage for coherency (resets for each stage)
  private _currentStageContext = [];
  
  private _currentStage = 0;
  
  public async initialize(msg: MsgContext) {
    const params = msg.content.slice('!adventure'.length).trim();
    if (!params) {
      msg.reply('Please provide a prompt for the adventure including a theme and a duration.');
      this.emit('concluded');
      return;
    }
    
    this._state = AdventureState.Collecting;

    this._startMsg = await this._startMsg.continue(`*We've got a new adventure starting! React to this message to join the adventure.*`);
    const users = await this._startMsg.getReactions(JOIN_DURATION);
    this._players = users.map(u => u.name);
    
    if (users.length === 0) {
      msg.reply(`Nobody signed up! Cancelling this adventure, cowards.`);
      this.emit('concluded');
      return;
    }
    
    this._playerHistory.push(...users.map(u => ({
      // TODO: Fix this Id<>Name overlap
      'player_id': u.name,
      history: []
    })));

    this._courseDescription = eval('(' + await Services.OpenAI.getLLMCourseDescription(prompt, this._players) + ')');
    this._courseDescription.players = this._players;
    
    setTimeout(this.runAdventure.bind(this), 1000);
  }
  
  public async addPlayerInput(msg: MsgContext) {
    // TODO: Map playerId -> name
    const input = JSON.stringify({
      player: msg.author.name,
      reply: msg.content
    });
    const response = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":input});
    msg.reply(response);
  }
  
  private async runAdventure() {
    await this._startMsg.continue(`*The adventure "${this._courseDescription.name}" begins with the following brave souls: ${this._courseDescription.players.join(', ')}*`);
    
    while (this._currentStage < this._courseDescription.stages) {
      await this._startMsg.continue(`__**Starting new stage!**__`);
      await this.startStage();
      this._state = AdventureState.InputStage;
      await Delay.ms(STAGE_RESPONSE_DURATION);
      
      await this._startMsg.continue(`__**Time's up! Getting stage results!**__`);
      this._state = AdventureState.PostStage;
      await this.endStage();
      await Delay.ms(POST_STAGE_DURATION);
      this._currentStage++;
    }
    await this.endAdventure();
  }

  private async startStage() {
    console.log(`\n\n==========Starting stage ${this._currentStage}`);
    //First clear the overall stage chat sequence
    this._currentStageContext = [];
    //Then trigger the start of new stage chat completion
    
    const result = await Services.OpenAI.getLLMStageDescription(this._currentStageContext, this._courseDescription, this._courseHistory, this._playerHistory);
    await this._startMsg.continue(result);
  }

  private async endStage() {
    const result = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":describeResultsMessage});
    this._startMsg.continue(result);
    
    const history = await Services.OpenAI.getStageHistory(this._courseHistory, this._playerHistory);
    console.log(`Received following history response: ${history}`);

    //Parse history updates from history string
    const sections = history.split(/\n(?=Course History:|Player History:)/);
    this._courseHistory = this.parseSection(sections[0].split('Course History:')[1].trim());
    const playerHistoryRaw = sections[1].split('Player History:')[1].trim();

    // Since Player History contains multiple objects, split them and parse each one.
    const playerHistoryObjects = playerHistoryRaw.split(/(?=^{)/);
    this._playerHistory = playerHistoryObjects.map(obj => this.parseSection(obj.trim()));
    console.log("Course Description:", this._courseDescription);
    console.log("Course History:", this._courseHistory);
    console.log("Player History:", this._playerHistory);
  }

  private async endAdventure() {
    this._startMsg.continue(await Services.OpenAI.getAdventureResults(this._courseDescription, this._courseHistory, this._playerHistory));
    
    this.emit('concluded');
  }

  // Helper function to parse safely using new Function
  private parseSection(data) {
    return new Function(`return ${data};`)();
  }
}