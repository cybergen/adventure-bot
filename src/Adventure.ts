import { MsgContext } from './MsgContext';
import { Emitter } from './Emitter';
import { JOIN_DURATION, POST_STAGE_DURATION, STAGE_RESPONSE_DURATION } from './Constants';
import { Services } from './services/Services';
import { Delay } from './Delay';
import { ButtonContext } from './ButtonContext';
import { InteractionIntent } from './discord-utils/InteractionId';

//Some commands for the chat bot
const describeResultsMessage = "Time's up! The players should have supplied their actions. Please describe what happens to them in 2 sentences each.";

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
  private _players: Record<string, string> = {}; // Mapping of Id->DisplayName

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
  private _stagePlayerInput: Record<string, string> = {}; // Mappings of Id->PlayerInput
  
  public async initialize(msg: MsgContext) {
    const params = msg.content.slice('!adventure'.length).trim();
    if (!params) {
      msg.reply({
        plainTxt: 'Please provide a prompt for the adventure including a theme and a duration.'
      });
      this.emit('concluded');
      return;
    }
    
    this._state = AdventureState.Collecting;

    this._startMsg = await msg.continue({
      segments: [{
        header: 'Adventure Awaits!',
        body: `*We've got a new adventure starting! React to this message to join the adventure.*`
      }]
    });
    const guild = this._startMsg.guild;
    let userIds = await this._startMsg.getReactions(JOIN_DURATION);
    if (userIds.length === 0) {
      msg.reply({ plainTxt: `Nobody signed up! Cancelling this adventure, cowards.` });
      this.emit('concluded');
      return;
    }
    
    const playerHistory: Array<{ player_id: string, history: [] }> = [];
    for (const id of userIds) {
      const displayName = (await guild.members.fetch(id)).displayName;
      playerHistory[id] = {
        player_id: displayName,
        history: []
      };
      this._players[id] = displayName;
    }
    
    this._history = `Course History:\n[]\n\nPlayer History:\n${JSON.stringify(playerHistory)}`;

    const playerArray = Object.values(this._players);
    this._courseDescription = eval('(' + await Services.OpenAI.getLLMCourseDescription(params, playerArray) + ')');
    this._courseDescription.players = playerArray;
    
    setTimeout(this.runAdventure.bind(this), 1000);
  }
  
  public async handlePlayerInput(ctx: ButtonContext) {
    switch (ctx.intent) {
      case InteractionIntent.Input:
        // Prompt the user for input
        const modalResult = await ctx.spawnModal();

        // Store input
        this._currentStageContext.push(
          JSON.stringify({
            player: this._players[ctx.userId],
            reply: modalResult.input
          })
        );
        // Eventually: Handle users adding multiple prior to replying to privacy.
        this._stagePlayerInput[ctx.userId] = modalResult.input;

        // Whisper back, ask about privacy
        ctx.reply({
          ephemeral: true,
          plainTxt: 'Received! Should I let your fellow adventurers know of your intent, or keep them in the dark?',
          buttons: [
            {intent: InteractionIntent.Agree, txt: ':thumbsup:'},
            {intent: InteractionIntent.Agree, txt: ':thumbsdown:'}
          ]
        });
        break;
      case InteractionIntent.Agree:
        ctx.continue({
          segments: [{
            header: this._players[ctx.userId],
            body: this._stagePlayerInput[ctx.userId]
          }]
        });
        break;
      case InteractionIntent.Disagree:
        ctx.continue({
          plainTxt: `${this._players[ctx.userId]} has acted in secret.`
        });
        break;
    }
  }
  
  private async runAdventure() {
    await this._startMsg.continue({
      segments: [{ header: 'Adventure Start', body: `*The adventure "${this._courseDescription.name}" begins with the following brave souls: ${this._courseDescription.players.join(', ')}*` }]
    });
    
    while (this._currentStage < this._courseDescription.stages) {
      await this.startStage();
      this._state = AdventureState.InputStage;
      await Delay.ms(STAGE_RESPONSE_DURATION);
      
      await this._startMsg.continue({ plainTxt: `__**Time's up! Getting stage results!**__` });
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
    this._stagePlayerInput = {};
    //Then trigger the start of new stage chat completion
    
    const result = await Services.OpenAI.getLLMStageDescription(this._currentStageContext, this._courseDescription, this._history);
    await this._startMsg.continue({
      segments: [{
        header: `Stage ${this._currentStage+1}`,
        body: result
      }],
      buttons: [{ txt: 'Add Response', intent: InteractionIntent.Input }]
    });
  }

  private async endStage() {
    const result = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":describeResultsMessage});
    this._startMsg.continue({
      segments: [{
        header: `Stage ${this._currentStage+1} Outcome`,
        body: result
      }]
    });
    
    this._history = await Services.OpenAI.getStageHistory(this._currentStageContext, this._history);
    console.log(`Received following history response: ${this._history}`);
  }

  private async endAdventure() {
    this._startMsg.continue({
      segments: [{
        header: `Adventure Outcome`,
        body: await Services.OpenAI.getAdventureResults(this._courseDescription, this._history)
      }]
    });
    
    this.emit('concluded');
  }
}