import type { VoicePageAgentController } from "./controller";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $voicePageAgent: VoicePageAgentController;
  }
}

export {};
