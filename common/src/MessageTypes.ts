interface APIBase {
  [key: string]: {
    srcData?: any;
    rtnData?: any;
  };
}

export interface API extends APIBase {
  VERSION: {
    srcData: {},
    rtnData: {
      major: number,
      minor: number,
      revision: number
    }
  },
  
  AUTHENTICATE: {
    srcData: { code: string },
    rtnData: { access_token: string }
  }
  
  START_ACTIVITY: {
    srcData: {
      guildId: string,
      channelId: string,
      userId: string,
      userName: string
    },
    rtnData: void
  },
  ADVENTURE_JOIN: {},
  ADVENTURE_BEGIN: {},
  ADVENTURE_START_DICTATION: {},
  ADVENTURE_END_DICTATION: {}
  
}
export type MessageType = keyof API;
export type SourceData<T extends MessageType> = API[T]['srcData'];
export type ReturnData<T extends MessageType> = API[T]['rtnData'];

export type MessageResponse<T> = { server: string } & ({ success: false, error: string } | { success: true, data: T });