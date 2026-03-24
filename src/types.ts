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
  panel: {
    show: () => void;
    expand: () => void;
  };
  execute: (task: string) => Promise<unknown>;
  status?: "idle" | "running" | "completed" | "error" | string;
};

export type RuntimePageAgentCtor = new (config: Record<string, unknown>) => RuntimePageAgent;

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
};

export type VoiceStateListener = (state: VoicePageAgentState) => void;

