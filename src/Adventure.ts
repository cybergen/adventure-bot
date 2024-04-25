import { Emitter } from './Emitter';
import { JOIN_DURATION, POST_STAGE_DURATION, STAGE_RESPONSE_DURATION } from './Constants';
import { describeResultsMessage as DESCRIBE_RESULTS } from './services/OpenAIService';
import { Services } from './services/Services';
import { Delay } from './Delay';
import { ButtonContext } from './ButtonContext';
import { InteractionIntent } from './discord-utils/InteractionId';
import * as JSON5 from 'json5';
import { InvokeContext } from './InvokeContext';
import { MsgContext } from './MsgContext';
import { OutboundMessage } from './InputContext';
import { userMention } from 'discord.js';

enum AdventureState {
  Idle = 'idle',
  Collecting = 'collecting', // Awaiting reactions to begin the adventure
  StageInput = 'stage-input', // Awaiting players to provide their input
  AwaitingOutcome = 'awaiting-outcome',
  
  PostStage = 'post-stage',
}

export interface AdventureEvents {
  concluded: null
}

export class Adventure extends Emitter<AdventureEvents> {
  
  private _state: AdventureState;
  private _startMsg: MsgContext;
  private _lastInteraction: ButtonContext;
  private _players: Record<string, string> = {}; // Mapping of Id->DisplayName

  //Initial plan for course
  private _courseDescription: {
    players: string[],
    difficulty: string,
    successCriteria: string,
    stages: number,
    name: string
  };
  private _history = '';
  //Chat-like full text of current stage for coherency (resets for each stage)
  private _currentStageContext = [];
  
  private _currentStage = 0;
  private _stagePlayerInput: Record<string, { input: string, public: boolean }> = {}; // Mappings of Id->PlayerInput
  private _stageTimer = null;
  
  public async initialize(config: InvokeContext) {
    this._state = AdventureState.Collecting;
    
    this._startMsg = await config.continue({
      segments: [{
        user: {
          name: config.userName,
          icon: config.userIcon
        },
        header: 'Adventure Awaits!',
        meta: [
          { name: 'Prompt', value: config.description, short: false },
          { name: 'Difficulty', value: config.difficulty, short: true },
          { name: 'Success Criteria', value: config.successCriteria, short: true },
          { name: 'Duration', value: config.duration, short: true },
        ],
        body: `*We've got a new adventure starting! React to this message to join the adventure.*`
      }]
    });
    const guild = this._startMsg.guild;
    let userIds = await this._startMsg.getReactions(JOIN_DURATION);
    if (userIds.length === 0) {
      config.reply({ plainTxt: `Nobody signed up! Cancelling this adventure, cowards.` });
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
    const prompt = `${config.description} with ${config.difficulty} difficulty, ${config.successCriteria} for success criteria, and duration of ${config.duration} minutes`;
    const courseDescRaw = await Services.OpenAI.getCourseDescription(prompt, playerArray);
    this._courseDescription = JSON5.parse(courseDescRaw);
    console.log(this._courseDescription);
    this._courseDescription.players = playerArray;

    // Kick things off!
    await this._startMsg.continue({
      segments: [{ header: this._courseDescription.name, body: `*The adventure begins with the following brave souls: ${this._courseDescription.players.join(', ')}*\n\n` }]
    });
    await this.startStage();
  }
  
  public async handlePlayerInput(ctx: ButtonContext) {
    console.log(`User: ${this._players[ctx.userId]} intent: ${ctx.intent}`);
    switch (ctx.intent) {
      case InteractionIntent.Input:
        await this.promptPlayerForInput(ctx);
        break;
      case InteractionIntent.Agree:
      case InteractionIntent.Disagree:
        await this.acknowledgePlayerInputPrivacy(ctx);
        
        // Check if this was the final input resolving
        if (this.awaitingPlayerInput()) return;
        
        await Delay.ms(3000);
        
        // Prompt the players to continue when they're ready.
        this._state = AdventureState.AwaitingOutcome;
        ctx.continue({
          segments: [{
            body: 'Everyone has responded. Take your time reading! Continue the adventure when you\'re ready.'
          }],
          buttons: [{
            intent: InteractionIntent.EndStage,
            txt: 'Onwards!'
          }]
        })
        break;
      case InteractionIntent.EndStage:
        // Ignore multiple people clicking continue, or clicking continue at a random time.
        if (this._state !== AdventureState.AwaitingOutcome) return; 
        this._state = AdventureState.PostStage;

        this._lastInteraction = ctx;
        await ctx.markThinking();
        // ctx.markResolved(`${userMention(ctx.userId)} has continued the adventure!`);
        
        await this.endStage();
        await Delay.ms(POST_STAGE_DURATION);
        
        if (++this._currentStage < this._courseDescription.stages) 
        {
          this.startStage();
        } 
        else 
        {
          this.endAdventure();
        }
        break;
    }
  }
  
  private async promptPlayerForInput(ctx: ButtonContext) {
    if (!(ctx.userId in this._players)) {
      ctx.reply({
        ephemeral: true,
        plainTxt: `You didn't sign up for this adventure. Fear not, just join the next one!`
      });
      return;
    }

    // Prompt the user for input
    const modalResult = await ctx.spawnModal();
    if (!modalResult) return;
    console.log(`User: ${this._players[ctx.userId]} replied with: ${modalResult.input}`);

    // Store input
    const input = JSON.stringify({
      player: this._players[ctx.userId],
      reply: modalResult.input
    });
    this._currentStageContext.push({"role":"user","content":input});

    // Eventually: Handle users adding multiple prior to replying to privacy.
    this._stagePlayerInput[ctx.userId] = {
      input: modalResult.input,
      public: null
    };

    // Whisper back, ask about privacy
    modalResult.reply({
      ephemeral: true,
      plainTxt: 'Received! Should I let your fellow adventurers know of your intent, or keep them in the dark?',
      buttons: [
        {intent: InteractionIntent.Agree, txt: '👍'},
        {intent: InteractionIntent.Disagree, txt: '👎'}
      ]
    });
  }
  
  private async acknowledgePlayerInputPrivacy(ctx: ButtonContext) {
    ctx.markResolved({ plainTxt: `You're all set! When everyone has answered, the game will continue.` });

    // Record intent, and generate echo content.
    let displayMsg: string;
    if (ctx.intent === InteractionIntent.Agree) {
      this._stagePlayerInput[ctx.userId].public = true;
      displayMsg = this._stagePlayerInput[ctx.userId].input;
    } else {
      this._stagePlayerInput[ctx.userId].public = false;
      displayMsg = `_Did something, but it's a secret_`
    }

    const msgSegments: OutboundMessage['segments'] = [{
      user: {
        name: this._players[ctx.userId],
        icon: ctx.userIcon
      },
      body: displayMsg
    }];

    // Augment response if input is still required
    const missingPlayers = this.awaitingPlayerInput();
    console.log(`Missing player input still? ${missingPlayers}`);
    if (missingPlayers) {
      const missingNames = [];
      for (const id in this._players) {
        if (id in this._stagePlayerInput) continue;
        missingNames.push(this._players[id]);
      }
      msgSegments.push({ body: `Still awaiting actions for: ${missingNames.join(', ')}`});
    }

    // Echo player's input to channel, THEN handle ack.
    // Use a race incase Discord's API is slow, so we also get the ack outbound before the 3s window closes.
    await Promise.race([
      ctx.continue({ segments: msgSegments }),
      Delay.ms(1000)
    ]);
  }

  private async startStage() {
    console.log(`\n\n==========Starting stage ${this._currentStage}`);
    this._state = AdventureState.StageInput;
    
    //First clear the overall stage chat sequence
    this._currentStageContext = [];
    this._stagePlayerInput = {};
    //Then trigger the start of new stage chat completion
    
    const result = await Services.OpenAI.getStageDescription(this._currentStageContext, this._courseDescription, this._history);
    await this._startMsg.continue({
      segments: [{
        header: `${this._courseDescription.name} // Stage ${this._currentStage+1}`,
        body: result
      }],
      buttons: [{ txt: 'Do Something!', intent: InteractionIntent.Input }]
    });
  }

  private async endStage() {
    const result = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content": DESCRIBE_RESULTS});
    
    const resultParts = result.split('\n');
    // This is disgusting, but let's fucking go.
    // Maybe change the LLM to respond with users in a [<name>] type of keyed format to handle edge cases with someone's displayName trolling (ex: the)
    for (const id in this._players) {
      const playerName = this._players[id];
     
      // For each player, find the result part that includes their name earliest.
      let lowestIndexInString = Infinity;
      let lowestPositionInArr = -1;
      for (let i = 0; i < resultParts.length; i++) {
        const nameIndex = resultParts[i].indexOf(playerName);
        if (nameIndex < 0) continue;
        if (nameIndex >= lowestIndexInString) continue;
        lowestIndexInString = nameIndex;
        lowestPositionInArr = i;
      }
      
      if (lowestPositionInArr === -1) continue;
      // Intentionally replace only the first occurence of their name?
      resultParts[lowestPositionInArr] = resultParts[lowestPositionInArr].replace(playerName, userMention(id));
    }
    
    const msg: OutboundMessage = {
      segments: [{
        header: `${this._courseDescription.name} // Stage ${this._currentStage+1} Outcome`,
        body: resultParts.join('\n')
      }]
    };
    this._lastInteraction.markResolved(msg);
    
    this._history = await Services.OpenAI.getStageHistory(this._currentStageContext, this._history);
    console.log(`Received following history response: ${this._history}`);
  }

  private async endAdventure() {
    this._startMsg.continue({
      segments: [{
        header: `${this._courseDescription.name} // Adventure Outcome`,
        body: await Services.OpenAI.getAdventureResults(this._courseDescription, this._history)
      }]
    });
    
    this.emit('concluded');
  }

  private awaitingPlayerInput(): boolean {
    // Check for someone who hasn't answered at all.
    const missingInput = Object.keys(this._players).length !== Object.keys(this._stagePlayerInput).length;
    if (missingInput) return true;
    
    // Check for someone pending the visibility prompt.
    for (const id in this._stagePlayerInput) {
      if (typeof this._stagePlayerInput[id].public !== 'boolean') return true;
    }
    
    return false;
  }
}