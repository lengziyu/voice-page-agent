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
  buttonText: {
    startText: "开始语音",
    wakeOnText: "语音唤醒中",
    openText: "打开助手",
  },
  buttonStyle: {
    wakeButtonBackground: "linear-gradient(135deg, #22c1ff, #3366ff)",
    openButtonBackground: "linear-gradient(135deg, #ffa84a, #ff5f6d)",
  },
});

app.mount("#app");
