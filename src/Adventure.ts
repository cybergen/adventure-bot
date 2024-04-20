﻿
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
  private _history = '';
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

    this._startMsg = await msg.continue(`*We've got a new adventure starting! React to this message to join the adventure.*`);
    const guild = this._startMsg.guild;
    let users = await this._startMsg.getReactions(JOIN_DURATION);
    if (users.length === 0) {
      msg.reply(`Nobody signed up! Cancelling this adventure, cowards.`);
      this.emit('concluded');
      return;
    }
    
    this._players = [];
    const playerHistory: Array<{ player_id: string, history: [] }> = [];
    for (const user of users) {
      // Handle dupes
      if (playerHistory.findIndex(h => h.player_id === user.id) > 0) continue;
      
      const displayName = (await guild.members.fetch(user.id)).displayName;
      playerHistory[user.id] = {
        player_id: displayName,
        history: []
      };
      this._players.push(displayName)
    }
    
    this._history = `Course History:\n[]\n\nPlayer History:\n${JSON.stringify(playerHistory)}`;

    this._courseDescription = eval('(' + await Services.OpenAI.getLLMCourseDescription(params, this._players) + ')');
    this._courseDescription.players = this._players;
    
    setTimeout(this.runAdventure.bind(this), 1000);
  }
  
  public async addPlayerInput(msg: MsgContext) {
    // TODO: Map playerId -> name
    const input = JSON.stringify({
      player: msg.author.name,
      reply: msg.content
    });
    this._currentStageContext.push({"role":"user","content":input});
    msg.reply(`*Action received! You'll get your results at the end of the stage.*`);
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
    
    const result = await Services.OpenAI.getLLMStageDescription(this._currentStageContext, this._courseDescription, this._history);
    await this._startMsg.continue(result);
  }

  private async endStage() {
    const result = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":describeResultsMessage});
    this._startMsg.continue(result);
    
    this._history = await Services.OpenAI.getStageHistory(this._currentStageContext, this._history);
    console.log(`Received following history response: ${this._history}`);
  }

  private async endAdventure() {
    this._startMsg.continue(await Services.OpenAI.getAdventureResults(this._courseDescription, this._history));
    
    this.emit('concluded');
  }
}