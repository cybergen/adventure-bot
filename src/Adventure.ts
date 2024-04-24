import { Emitter } from './Emitter';
import { JOIN_DURATION, POST_STAGE_DURATION, STAGE_RESPONSE_DURATION } from './Constants';
import { Services } from './services/Services';
import { Delay } from './Delay';
import { ButtonContext } from './ButtonContext';
import { InteractionIntent } from './discord-utils/InteractionId';
import * as JSON5 from 'json5';
import { InvokeContext } from './InvokeContext';
import { MsgContext } from './MsgContext';
import { OutboundMessage } from './InputContext';
import { userMention } from 'discord.js';

//Some commands for the chat bot
const describeResultsMessage = "Time's up! The players either supplied their actions or failed to respond. Please describe what happens to them in 2 sentences each and BE APPROPRIATELY HARSH to the course difficulty.";

enum AdventureState {
  Idle = 'idle',
  Collecting = 'collecting', // Awaiting reactions to begin the adventure
  InputStage = 'input-stage', // Awaiting players to provide their input
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
    stages: number,
    name: string
  };
  private _history = '';
  //Chat-like full text of current stage for coherency (resets for each stage)
  private _currentStageContext = [];
  
  private _currentStage = 0;
  private _stagePlayerInput: Record<string, { input: string, echoMessage: MsgContext }> = {}; // Mappings of Id->PlayerInput
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
          { name: 'Difficulty', value: config.difficulty, short: true }
        ],
        body: `*We've got a new adventure starting! React to this message to join the adventure.*`
      }]
    });
    const guild = this._startMsg.guild;
    this._startMsg.startReactionCollection();
    await Delay.ms(JOIN_DURATION);
    
    let userIds = this._startMsg.stopReactionCollection();
    
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
    const prompt = `${config.description} with a ${config.difficulty} difficulty`;
    const courseDescRaw = await Services.OpenAI.getLLMCourseDescription(prompt, playerArray);
    this._courseDescription = JSON5.parse(courseDescRaw.response);
    console.log(this._courseDescription);
    this._courseDescription.players = playerArray;

    // Kick things off!
    await this._startMsg.continue({
      segments: [
        { header: this._courseDescription.name, body: `*The adventure begins with the following brave souls: ${this._courseDescription.players.join(', ')}*\n\n` }
      ]
    });
    await this.startStage();
  }
  
  public async handlePlayerInput(ctx: ButtonContext) {
    console.log(`User: ${this._players[ctx.userId]} intent: ${ctx.intent}`);
    switch (ctx.intent) {
      case InteractionIntent.Input:
        await this.promptPlayerForInput(ctx);
        break;
      // case InteractionIntent.Agree:
      // case InteractionIntent.Disagree:
      //   // await this.acknowledgePlayerInputPrivacy(ctx);
      //  
      //   // Check if this was the final input resolving
      //   if (this.awaitingPlayerInput()) return;
      //  
      //   await Delay.ms(3000);
      //  
      //   // Prompt the players to continue when they're ready.
      //   this._state = AdventureState.AwaitingOutcome;
      //   ctx.continue({
      //     segments: [{
      //       body: 'Everyone has responded. Take your time reading! Continue the adventure when you\'re ready.'
      //     }],
      //     buttons: [{
      //       intent: InteractionIntent.EndStage,
      //       txt: 'Onwards!'
      //     }]
      //   })
      //   break;
      // case InteractionIntent.EndStage:
      //   // Ignore multiple people clicking continue, or clicking continue at a random time.
      //   if (this._state !== AdventureState.AwaitingOutcome) return; 
      //   this._state = AdventureState.PostStage;
      //
      //   this._lastInteraction = ctx;
      //   await ctx.markThinking();
      //   // ctx.markResolved(`${userMention(ctx.userId)} has continued the adventure!`);
      //  
      //   await this.endStage();
      //   await Delay.ms(POST_STAGE_DURATION);
      //  
      //   if (++this._currentStage < this._courseDescription.stages) 
      //   {
      //     this.startStage();
      //   } 
      //   else 
      //   {
      //     this.endAdventure();
      //   }
      //   break;
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

    // Respond immediately to the channel with the submission.
    const reply = await modalResult.continue({
      segments: [{
        user: {
          name: this._players[ctx.userId],
          icon: ctx.userIcon
        },
        body: modalResult.input
      }]
    });
    reply.startReactionCollection();
    
    // Eventually: Handle users adding multiple prior to replying to privacy.
    this._stagePlayerInput[ctx.userId] = {
      input: modalResult.input,
      echoMessage: reply
      // public: null
    };
    
    // Whisper back, ask about privacy
    // modalResult.reply({
    //   ephemeral: true,
    //   plainTxt: 'Received! Should I let your fellow adventurers know of your intent, or keep them in the dark?',
    //   buttons: [
    //     {intent: InteractionIntent.Agree, txt: '👍'},
    //     {intent: InteractionIntent.Disagree, txt: '👎'}
    //   ]
    // });
    
    if (this.awaitingPlayerInput()) return;
    
    const voteTime = 2;
    // All done? Wooo, let everyone know it's time to vote
    await Delay.ms(1000);
    ctx.continue({
      segments: [{
        header: 'Voting Time',
        body: `All players have submitted a response!\n\nTalk it over and vote for the best strategy by adding a reaction to it.\n\nThe game continues in ${voteTime} minutes.`
      }]
    });
    // TODO: Scale this based on user count? Use a button?
    setTimeout(this.scoreInputVoting.bind(this), voteTime * 60 * 1000);
  }
  
  private async scoreInputVoting() {
    let highestCount = 0;
    let highestMsgs: MsgContext[] = [];
    
    // Intentionally do not count
    for (const id in this._stagePlayerInput) {
      const playerInput = this._stagePlayerInput[id];
      const reactingUsers = playerInput.echoMessage.stopReactionCollection().length;
      console.log(`${this._players[id]} has ${reactingUsers} reactions`);
      if (reactingUsers < highestCount) continue;
      
      // If a new high is found, clear any priors
      if (reactingUsers > highestCount) {
        highestCount = reactingUsers;
        highestMsgs.length = 0;
      }  
      
      // Store the msg(s) with the highest reaction count.
      highestMsgs.push(playerInput.echoMessage);
    }
    
    const rngHighest = highestMsgs[Math.floor(Math.random() * highestMsgs.length)];
    
    
    await this.endStage(rngHighest);
    await Delay.ms(POST_STAGE_DURATION);

    if (++this._currentStage < this._courseDescription.stages)
    {
      this.startStage();
    }
    else
    {
      this.endAdventure();
    }
  }
  
  // Unused in voting flow
  // private async acknowledgePlayerInputPrivacy(ctx: ButtonContext) {
  //   ctx.markResolved({ plainTxt: `You're all set! When everyone has answered, the game will continue.` });
  //
  //   // Record intent, and generate echo content.
  //   let displayMsg: string;
  //   if (ctx.intent === InteractionIntent.Agree) {
  //     this._stagePlayerInput[ctx.userId].public = true;
  //     displayMsg = this._stagePlayerInput[ctx.userId].input;
  //   } else {
  //     this._stagePlayerInput[ctx.userId].public = false;
  //     displayMsg = `_Did something, but it's a secret_`
  //   }
  //
  //   const msgSegments: OutboundMessage['segments'] = [{
  //     user: {
  //       name: this._players[ctx.userId],
  //       icon: ctx.userIcon
  //     },
  //     body: displayMsg
  //   }];
  //
  //   // Augment response if input is still required
  //   const missingPlayers = this.awaitingPlayerInput();
  //   console.log(`Missing player input still? ${missingPlayers}`);
  //   if (missingPlayers) {
  //     const missingNames = [];
  //     for (const id in this._players) {
  //       if (id in this._stagePlayerInput) continue;
  //       missingNames.push(this._players[id]);
  //     }
  //     msgSegments.push({ body: `Still awaiting actions for: ${missingNames.join(', ')}`});
  //   }
  //
  //   // Echo player's input to channel, THEN handle ack.
  //   // Use a race incase Discord's API is slow, so we also get the ack outbound before the 3s window closes.
  //   await Promise.race([
  //     ctx.followUp({ segments: msgSegments }),
  //     Delay.ms(1000)
  //   ]);
  // }

  private async startStage() {
    console.log(`\n\n==========Starting stage ${this._currentStage}`);
    this._state = AdventureState.InputStage;
    
    //First clear the overall stage chat sequence
    this._currentStageContext = [];
    this._stagePlayerInput = {};
    //Then trigger the start of new stage chat completion
    
    const result = await Services.OpenAI.getLLMStageDescription(this._currentStageContext, this._courseDescription, this._history);
    await this._startMsg.continue({
      segments: [{
        header: `${this._courseDescription.name} // Stage ${this._currentStage+1}`,
        body: result.response
      }],
      buttons: [{ txt: 'Do Something!', intent: InteractionIntent.Input }]
    });
  }

  private async endStage(votedScenario: MsgContext) {
    // TODO Brian: Do something with votedScenario.content
    const result = await Services.OpenAI.appendToStageChatAndReturnLLMResponse(this._currentStageContext, {"role":"user","content":describeResultsMessage});
    
    const resultParts = result.response.split('\n');
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

    const historyResult = await Services.OpenAI.getStageHistory(this._currentStageContext, this._history);
    this._history = historyResult.response;
    console.log(`Received following history response: ${this._history}`);
    
    const msg: OutboundMessage = {
      segments: [{
        header: `${this._courseDescription.name} // Stage ${this._currentStage+1} Outcome`,
        body: resultParts.join('\n')
      }]
    };
    this._lastInteraction.markResolved(msg);
  }

  private async endAdventure() {
    const result = await Services.OpenAI.getAdventureResults(this._courseDescription, this._history);
    this._startMsg.continue({
      segments: [{
        header: `${this._courseDescription.name} // Adventure Outcome`,
        body: result.response,
      }]
    });
    
    this.emit('concluded');
  }

  private awaitingPlayerInput(): boolean {
    // Check for someone who hasn't answered at all.
    const missingInput = Object.keys(this._players).length !== Object.keys(this._stagePlayerInput).length;
    if (missingInput) return true;
    
    // Check for someone pending the visibility prompt.
    // for (const id in this._stagePlayerInput) {
    //   if (typeof this._stagePlayerInput[id].public !== 'boolean') return true;
    // }
    
    return false;
  }
}