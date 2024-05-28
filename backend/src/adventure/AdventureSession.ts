import { Server } from 'socket.io';
import { Notification, NotificationTypes } from '@common/NotificationTypes';
import { AdventureDisplay, AdventureHistory, AdventureState } from '@common/AdventureState';
import { KnownError } from '@common/errors/KnownError';
import { Services } from '../services/Services';
import { AdventureRuntime } from './AdventureRuntime';
import { Delay } from '@common/utils/Delay';

const SPEAKER_DM = 'Project Endswell';

export class AdventureSession {
  
  private readonly _guildId: string;
  private readonly _channelId: string;
  private readonly _server: Server;
  private readonly _runtime: AdventureRuntime;
  
  private _state: AdventureState = {
    phase: 'Readying',
    dmState: 'Idle',
    participants: [],
    activeParticipant: null
  };
  private _display: AdventureDisplay = {
    type: 'status',
    speaker: '',
    message: ''
  }
  private _history: AdventureHistory = [];
  
  public get socketRoomId(): string {
    return `${this._guildId}-${this._channelId}`;
  }
  
  public get participantCount(): number {
    return this._state.participants.length;
  }
  
  public constructor(guildId: string, channelId: string, server: Server) {
    this._guildId = guildId;
    this._channelId = channelId;
    this._server = server;
    this._runtime = new AdventureRuntime();
    
    console.log(`Creating AdventureSession (Guild=${guildId} Channel=${channelId})`);
  }
  
  public async addUser(id: string) {
    if (this._state.phase !== 'Readying') {
      throw new KnownError('Unable to join adventure in its current state. Please try again later.');
    }
    
    const user = Services.User.getBySocket(id);
    console.log(`Adding user to adventure: (Guild=${this._guildId} Channel=${this._channelId} User=${user.discordId})`);
    
    this._state.participants.push(user);
    this.dispatchNotification('ADVENTURE_STATE_UPDATE', this._state);
  }
  
  public removeUser(id: string) {
    const index = this._state.participants.findIndex(p => p.systemId === id);
    if (index === -1) return;
    this._state.participants.splice(index, 1);
    
    if (this._state.participants.length === 0) return;
    this.dispatchNotification('ADVENTURE_STATE_UPDATE', this._state);
  }
  
  public async startAdventure() {
    if (this._state.phase !== 'Readying') {
      throw new KnownError('Unable to start adventure outside of Readying state.');
    }
    
    this._runtime.initialize(this._state.participants.map(p => p.name));
    this.updateState({ phase: 'DM_Active' });
    
    await Services.Discord.joinVoice(this._guildId, this._channelId);
    
    this.updateDisplay({
      type: 'status',
      speaker: SPEAKER_DM,
      message: `Describe the adventure you'd like to embark on.`
    });
    this.updateState({ phase: 'Prompt_Needed' });
  }
  
  public async startDictation(userId: string) {
    const user = Services.User.getBySocket(userId);
    if (this._state.phase !== 'Player_Turn' && this._state.phase !== 'Prompt_Needed') throw new KnownError(`Wrong phase to speak in.`);
    if (this._state.activeParticipant && this._state.activeParticipant !== user.discordId) throw new KnownError(`Unable to speak outside of your turn.`);
    this.updateState({ 
      activeParticipant: user.name,
      dmState: 'Listening'
    });
    this.updateDisplay({
      type: 'dictation',
      speaker: user.name,
      message: ''
    });

    await Services.Discord.startListening({
      guildId: this._guildId, 
      channelId: this._channelId,
      userId: user.discordId
    }, text => {
      // Race condition for GCP returning data after we moved on.
      if (this._state.dmState !== 'Listening') return;
      
      this.updateDisplay({
        type: 'dictation',
        speaker: user.name,
        message: text
      });
    });
  }
  
  public async stopDictation(userId: string) {
    const user = Services.User.getBySocket(userId);
    Services.Discord.stopListening(user.discordId);
    
    const input = this._display.message;
    this.pushHistory();
    
    const priorPhase = this._state.phase;
    this.updateState({ phase: 'DM_Active', dmState: 'Thinking', activeParticipant: '' });
    
    switch (priorPhase) {
      case "Prompt_Needed":
        this.receivePrompt();
        break;
      case "Player_Turn":
        this._runtime.provideInput(user.name, input);
        
        // Theatrics
        await Delay.ms(2000);
        if (this._runtime.inputNeeded) {
          this.promptRandomPlayer();
        } else {
          this.endStage();
        }
        break;
      default:
        console.error(`Unexpectedly received input in phase: ${priorPhase}`);
        break;
    }
  }
  
  private async receivePrompt() {
    this.updateState({
      phase: 'DM_Active',
      dmState: 'Thinking',
      activeParticipant: ''
    });
    
    const adventureDesc = await this._runtime.setPrompt(this._display.message);
    
    this.pushHistory({
      type: 'status',
      speaker: SPEAKER_DM,
      message: adventureDesc
    });
    this.startStage();
  }
  
  private async startStage() {
    console.log(`Starting stage`);
    const stageDesc = await this._runtime.startStage();

    // Push to users
    await Services.Discord.readDictation(this._guildId, this._channelId, stageDesc);
    this.updateState({
      dmState: 'Idle'
    });
    this.pushHistory({
      type: 'dictation',
      speaker: SPEAKER_DM,
      message: stageDesc
    });
    
    // Wait cause why not, theatrics.
    await Delay.ms(5000);

    this.promptRandomPlayer();
  }
  
  private promptRandomPlayer() {
    console.log(`Prompting random player`);
    
    const remainingPlayers = this._runtime.getPlayersNeedingInput();
    console.log(`Remaining players: ${remainingPlayers.join(', ')}`);
    const randomPlayer = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
    
    console.log(`Randomly picked: ${randomPlayer}`);
    
    this.updateState({
      phase: 'Player_Turn',
      dmState: 'Idle',
      activeParticipant: this._state.participants.find(p => p.name === randomPlayer).discordId
    });
  }
  
  private async endStage() {
    console.log(`Ending stage`);
    
    this.updateState({
      phase: 'DM_Active',
      dmState: 'Thinking',
      activeParticipant: ''
    });
    
    const outcome = await this._runtime.endStage();
    
    await Services.Discord.readDictation(this._guildId, this._channelId, outcome);
    this.pushHistory({
      type: 'dictation',
      speaker: SPEAKER_DM,
      message: outcome
    });
    this.updateState({
      dmState: 'Idle'
    });
    
    // TODO: Loop or end
  }
  
  private updateState(next: Partial<AdventureState>) {
    this._state = {
      ...this._state,
      ...next
    };
    this.dispatchNotification('ADVENTURE_STATE_UPDATE', this._state);

    console.log(`State`, this._state);
  }

  private updateDisplay(next: AdventureDisplay) {
    this._display = next;
    this.dispatchNotification('ADVENTURE_DISPLAY_UPDATE', this._display);
    
    console.log(`Display`, this._display);
  }
  
  private pushHistory(addon: AdventureDisplay = null) {
    if (this._display.speaker) this._history.push(this._display);
    if (addon) this._history.push(addon);
    
    this._display = { type: 'status', speaker: '', message: '' };
    
    this.dispatchNotification('ADVENTURE_DISPLAY_UPDATE', this._display);
    this.dispatchNotification('ADVENTURE_HISTORY_UPDATE', this._history);
    
    console.log(`Display (via History)`, this._display);
    console.log(`History`, this._history);
  }
  
  private dispatchNotification<T extends Notification>(evt: T, payload: NotificationTypes[T]) {
    this._server.to(this.socketRoomId).emit('notify', {
      type: evt,
      payload
    });
  }
}