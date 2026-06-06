export interface Script {
  id: string;
  title: string;
  content: string;
  coverImage: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScriptRequest {
  title: string;
  content: string;
}

export interface UpdateScriptRequest {
  title?: string;
  content?: string;
  coverImage?: string;
  sortOrder?: number;
}

export interface Settings {
  asrWebSocketURL: string;
}

export interface TeleprompterSettings {
  fontSize: number;
  lineHeight: number;
  mirrorModeX: boolean;
  mirrorModeY: boolean;
  paddingX: number;
  scrollMode: 'manual' | 'auto' | 'asr';
  wpm: number;
  isScrolling: boolean;
  useResponsivePreset: boolean;
}
