import { ClientSocketManager } from '../ClientSocketManager';
import { Store } from './Store';
import { AdventureDisplay, AdventureHistory, AdventureState } from '@common/AdventureState';
import { Writable, writable } from 'svelte/store';

export let adventure: Writable<AdventureStore>;

export class AdventureStore extends Store {

  public state: AdventureState = null;
  // {
  //   phase: 'Prompt_Needed',
  //   dmState: 'Idle',
  //   participants: [
  //     {
  //       name: 'Pojo',
  //       discordId: 'abc',
  //       systemId: '123'
  //     }
  //   ],
  //   activeParticipant: ''
  // };
  public display: AdventureDisplay = {
    type: 'status',
    speaker: '',
    message: ''
  };
  public history: AdventureHistory = [];
  
  public constructor(socketManager: ClientSocketManager) {
    super(socketManager);
    
    this._socket.subscribe(this, 'ADVENTURE_STATE_UPDATE', this.onStateUpdate);
    this._socket.subscribe(this, 'ADVENTURE_DISPLAY_UPDATE', this.onDisplayUpdate);
    this._socket.subscribe(this, 'ADVENTURE_HISTORY_UPDATE', this.onHistoryUpdate);

    adventure = writable(this);
  }
  
  public joinAdventure() {
    this._socket.request('ADVENTURE_JOIN', {});
  }
  
  public startAdventure() {
    this._socket.request('ADVENTURE_BEGIN', {});
  }
  
  public startSpeaking() {
    this._socket.request('ADVENTURE_START_DICTATION', {});
  }
  
  public stopSpeaking() {
    this._socket.request('ADVENTURE_END_DICTATION', {});
  }
  
  private onStateUpdate(state: AdventureState) {
    adventure.update(s => {
      s.state = state;
      return s;
    });
  }
  
  private onDisplayUpdate(display: AdventureDisplay) {
    adventure.update(s => {
      s.display = display;
      return s;
    });
  }

  private onHistoryUpdate(history: AdventureHistory) {
    adventure.update(s => {
      s.history = history;
      return s;
    });
  }
}