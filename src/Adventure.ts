import { MsgContext } from './MsgContext';
import { Emitter } from './Emitter';
import { JOIN_DURATION, POST_STAGE_DURATION, STAGE_RESPONSE_DURATION } from './Constants';
import { Services } from './services/Services';
import { Delay } from './Delay';
import { ButtonContext } from './ButtonContext';
import { InteractionIntent } from './discord-utils/InteractionId';
import * as JSON5 from 'json5'

//Some commands for the chat bot
const describeResultsMessage = "Time's up! The players either supplied their actions or failed to respond. Please describe what happens to them in 2 sentences each and BE APPROPRIATELY HARSH to the course difficulty.";

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
    difficulty: string,
    stages: number,
    name: string
  };
  private _history = '';
  //Chat-like full text of current stage for coherency (resets for each stage)
  private _currentStageContext = [];
  
  private _currentStage = 0;
  private _stagePlayerInput: Record<string, string> = {}; // Mappings of Id->PlayerInput
  private _stageRepliedPlayers = [];
  private _stageTimeElapsed = false;
  private _stageTimer = null;
  
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
    const courseDescRaw = await Services.OpenAI.getLLMCourseDescription(params, playerArray);
    console.log(courseDescRaw);
    this._courseDescription = JSON5.parse(courseDescRaw);
    console.log(this._courseDescription);
    this._courseDescription.players = playerArray;
    
    setTimeout(this.runAdventure.bind(this), 1000);
  }
  
  public async handlePlayerInput(ctx: ButtonContext) {
    console.log(`User: ${this._players[ctx.userId]} intent: ${ctx.intent}`);
    switch (ctx.intent) {
      case InteractionIntent.Input:
        // Prompt the user for input
        const modalResult = await ctx.spawnModal();
        console.log(`User: ${this._players[ctx.userId]} replied with: ${modalResult.input}`);

        // Store input
        const input = JSON.stringify({
          player: this._players[ctx.userId],
          reply: modalResult.input
        });
        this._currentStageContext.push({"role":"user","content":input});
        
        // Eventually: Handle users adding multiple prior to replying to privacy.
        this._stagePlayerInput[ctx.userId] = modalResult.input;

        // Whisper back, ask about privacy
        modalResult.reply({
          ephemeral: true,
          plainTxt: 'Received! Should I let your fellow adventurers know of your intent, or keep them in the dark?',
          buttons: [
            {intent: InteractionIntent.Agree, txt: '👍'},
            {intent: InteractionIntent.Disagree, txt: '👎'}
          ]
        });
        break;
      case InteractionIntent.Agree:
        this._stageRepliedPlayers.push(this._players[ctx.userId]);
        if (!this._courseDescription.players.every(element => this._stageRepliedPlayers.includes(element))) {
          const missingPlayers = this._courseDescription.players.filter(element => !this._stageRepliedPlayers.includes(element)).join(", ");
          ctx.continue({
            segments: [{
              user: {
                name: this._players[ctx.userId],
                icon: ctx.userIcon
              },
              body: this._stagePlayerInput[ctx.userId] + `\n\nStill awaiting actions for: ${missingPlayers}`
            }]
          });
        } else {
          ctx.continue({
            segments: [{
              user: {
                name: this._players[ctx.userId],
                icon: ctx.userIcon
              },
              body: this._stagePlayerInput[ctx.userId]
            }]
          });
        }
        break;
      case InteractionIntent.Disagree:
        this._stageRepliedPlayers.push(this._players[ctx.userId]);
        if (!this._courseDescription.players.every(element => this._stageRepliedPlayers.includes(element))) {
          const missingPlayers = this._courseDescription.players.filter(element => !this._stageRepliedPlayers.includes(element)).join(", ");
          ctx.continue({
            segments: [{
              user: {
                name: this._players[ctx.userId],
                icon: ctx.userIcon
              },
              body: `_Did something, but it's a secret_\n\nStill awaiting actions for: ${missingPlayers}`
            }]
          });
        } else {
          ctx.continue({
            segments: [{
              user: {
                name: this._players[ctx.userId],
                icon: ctx.userIcon
              },
              body: `_Did something, but it's a secret_`
            }]
          });
        }
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
      
      this.startStageTimer();
      while (!this._stageTimeElapsed && !this._courseDescription.players.every(element => this._stageRepliedPlayers.includes(element))) {
        await Delay.ms(100);
      }
      this.cancelStageTimer();
      
      if (this._stageTimeElapsed) {
        this._startMsg.continue({ plainTxt: `__**Time's up! Getting stage results!**__` });
      } else {
        this._startMsg.continue({ plainTxt: `__**All actions in! Getting stage results!**__` });
      }

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
    this._stageTimeElapsed = false;
    this._stageRepliedPlayers = [];
    //Then trigger the start of new stage chat completion
    
    const result = await Services.OpenAI.getLLMStageDescription(this._currentStageContext, this._courseDescription, this._history);
    await this._startMsg.continue({
      segments: [{
        header: `Stage ${this._currentStage+1}`,
        body: result
      }],
      buttons: [{ txt: 'Do Something!', intent: InteractionIntent.Input }]
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

  private startStageTimer(): void {
    this._stageTimer = setTimeout(() => {
      this._stageTimeElapsed = true;
    }, STAGE_RESPONSE_DURATION);
  }

  private cancelStageTimer(): void {
    if (this._stageTimer) {
      clearTimeout(this._stageTimer);
      this._stageTimer = null;
    }
  }
}