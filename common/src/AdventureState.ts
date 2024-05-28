export interface AdventureState {
  phase: 'Readying' | 'Prompt_Needed' | 'DM_Active' | 'Player_Turn';
  dmState: 'Idle' | 'Listening' | 'Thinking'
  participants: Array<{
    systemId: string,
    discordId: string,
    name: string
  }>;
  activeParticipant: string | null;
}

export type AdventureDisplay = {
  type: 'status' | 'dictation';
  speaker: string;
  message: string;
};
export type AdventureHistory = AdventureDisplay[];