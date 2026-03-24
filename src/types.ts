export type VoiceStateStatus =
  | "idle"
  | "waking"
  | "listening_command"
  | "processing"
  | "error"
  | "unsupported"
  | "off";

export type VoicePageAgentState = {
  status: VoiceStateStatus;
  message: string;
  supported: boolean;
  enabled: boolean;
  micPermissionGranted: boolean;
};

export type RuntimePageAgent = {
  panel?: {
    show: () => void;
    expand: () => void;
    hide?: () => void;
    collapse?: () => void;
  };
  execute: (task: string) => Promise<unknown>;
  dispose?: (...args: unknown[]) => void;
  disposed?: boolean;
  status?: "idle" | "running" | "completed" | "error" | string;
};

export type RuntimePageAgentCtor = new (config: Record<string, unknown>) => RuntimePageAgent;

export type VoicePageAgentButtonTextOptions = {
  startText?: string;
  wakeOnText?: string;
  openText?: string;
};

export type VoicePageAgentButtonStyleOptions = {
  wakeButtonBackground?: string;
  wakeButtonTextColor?: string;
  openButtonBackground?: string;
  openButtonTextColor?: string;
};

export type VoicePageAgentOptions = {
  pageAgent: Record<string, unknown>;
  wakeWord?: string | string[];
  enableHomophoneMatch?: boolean;
  wakeCooldownMs?: number;
  commandInitialTimeoutMs?: number;
  commandSilenceTimeoutMs?: number;
  commandMaxWindowMs?: number;
  recognitionLang?: string;
  showAgentWhenWake?: boolean;
  autoStart?: boolean;
  buttonText?: VoicePageAgentButtonTextOptions;
  buttonStyle?: VoicePageAgentButtonStyleOptions;
};

export type ResolvedVoicePageAgentOptions = {
  pageAgent: Record<string, unknown>;
  wakeWord: string[];
  enableHomophoneMatch: boolean;
  wakeCooldownMs: number;
  commandInitialTimeoutMs: number;
  commandSilenceTimeoutMs: number;
  commandMaxWindowMs: number;
  recognitionLang: string;
  showAgentWhenWake: boolean;
  autoStart: boolean;
  buttonText?: VoicePageAgentButtonTextOptions;
  buttonStyle?: VoicePageAgentButtonStyleOptions;
};

export type VoiceStateListener = (state: VoicePageAgentState) => void;
