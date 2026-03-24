import "./vue-augment";

export {
  VoicePageAgentController,
  createVoicePageAgent,
} from "./controller";
export {
  VoicePageAgentButton,
  createVoicePageAgentPlugin,
  useVoicePageAgent,
} from "./plugin";
export { default } from "./plugin";
export { default as VoicePageAgentPlugin } from "./plugin";
export type {
  ResolvedVoicePageAgentOptions,
  RuntimePageAgent,
  VoicePageAgentOptions,
  VoicePageAgentState,
  VoiceStateListener,
  VoiceStateStatus,
} from "./types";
