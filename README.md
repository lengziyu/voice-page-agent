# voice-page-agent

`voice-page-agent` is a Vue2/Vue3 compatible plugin that adds wake-word voice control for [page-agent](https://www.npmjs.com/package/page-agent).

Wake flow:
- wait for wake word (default: `布丁布丁`)
- transcribe command by browser SpeechRecognition
- call `pageAgent.execute(command)`

## Install

```bash
npm i voice-page-agent page-agent vue-demi
```

For Vue2, also install composition plugin:

```bash
npm i @vue/composition-api
```

## Option Format

Use this shape:

```ts
{
  pageAgent: {
    // all page-agent options
    baseURL: "https://your-api.example.com",
    model: "qwen3.5-plus",
    apiKey: "NA",
    language: "zh-CN",
    // ...any other page-agent options
  },
  wakeWord: "布丁布丁",                 // string or string[]
  enableHomophoneMatch: true,          // whether homophone fuzzy match is enabled
  wakeCooldownMs: 1400,                // wake debounce
  commandInitialTimeoutMs: 12000,      // how long to wait for first command after wake
  commandSilenceTimeoutMs: 2600,       // silence timeout between phrases
  commandMaxWindowMs: 22000,           // max command listening window
  recognitionLang: "zh-CN",            // SpeechRecognition language
  showAgentWhenWake: true,             // auto-open panel when wake hit
  autoStart: false                     // start wake on init
}
```

## Vue3 Usage

```ts
import { createApp } from "vue";
import App from "./App.vue";
import VoicePageAgentPlugin from "voice-page-agent";

const app = createApp(App);
app.use(VoicePageAgentPlugin, {
  pageAgent: {
    baseURL: "https://your-api.example.com",
    model: "qwen3.5-plus",
    apiKey: "NA",
    language: "zh-CN",
  },
  wakeWord: "布丁布丁",
  enableHomophoneMatch: true,
});
app.mount("#app");
```

Use in component:

```ts
import { useVoicePageAgent } from "voice-page-agent";

const controller = useVoicePageAgent();
await controller.startWake();
await controller.openAgent();
await controller.runCommand("打开工具页面");
```

## Vue2 Usage

```ts
import Vue from "vue";
import CompositionApi from "@vue/composition-api";
import VoicePageAgentPlugin from "voice-page-agent";

Vue.use(CompositionApi);
Vue.use(VoicePageAgentPlugin, {
  pageAgent: {
    baseURL: "https://your-api.example.com",
    model: "qwen3.5-plus",
    apiKey: "NA",
    language: "zh-CN",
  },
  wakeWord: "布丁布丁",
});
```

Then:

```ts
this.$voicePageAgent.startWake();
```

## Built-in Component

You can use `VoicePageAgentButton` globally after plugin install:

```html
<VoicePageAgentButton />
```

It renders:
- wake button (only when mic permission is not granted)
- open page-agent button
- status text

## API

`VoicePageAgentController`:
- `startWake(): Promise<void>`
- `stopWake(): void`
- `openAgent(): Promise<RuntimePageAgent | null>`
- `runCommand(text: string): Promise<void>`
- `dispose(): void`
- `onStateChange(listener): () => void`
- `snapshot` (current state)

## Local Examples

This repo includes runnable examples:

- `examples/vue3`
- `examples/vue2`

Run Vue3 demo:

```bash
cd examples/vue3
npm i
npm run dev
```

Run Vue2 demo:

```bash
cd examples/vue2
npm i
npm run dev
```

