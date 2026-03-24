import { createApp } from "vue";
import App from "./App.vue";
import VoicePageAgentPlugin from "voice-page-agent";

const app = createApp(App);

app.use(VoicePageAgentPlugin, {
  pageAgent: {
    baseURL: "https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run",
    model: "qwen3.5-plus",
    apiKey: "NA",
    language: "zh-CN",
  },
  wakeWord: "布丁布丁",
  enableHomophoneMatch: true,
  commandInitialTimeoutMs: 12000,
  commandSilenceTimeoutMs: 2600,
  commandMaxWindowMs: 22000,
});

app.mount("#app");

