export enum InteractionIntent {
  Input = 'Input',
  Agree = 'Agree',
  Disagree = 'Disagree'
}

export module InteractionId {
  
  export function create(channelId: string, intent: InteractionIntent): string {
    return `${channelId}/${intent}`;
  }
  
  export function getIntent(id: string): InteractionIntent {
    const cmd = id.substring(id.indexOf('/')+1);
    return InteractionIntent[cmd];
  }
}