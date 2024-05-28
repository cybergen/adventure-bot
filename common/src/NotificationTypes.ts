import { AdventureDisplay, AdventureHistory, AdventureState } from './AdventureState';

export interface NotificationTypes {
  ADVENTURE_STATE_UPDATE: AdventureState;
  ADVENTURE_DISPLAY_UPDATE: AdventureDisplay;
  ADVENTURE_HISTORY_UPDATE: AdventureHistory;
}

export type Notification = keyof NotificationTypes;