# voice-page-agent

`voice-page-agent` is a Vue2/Vue3 compatible plugin that adds wake-word voice control for [page-agent](https://www.npmjs.com/package/page-agent).

Wake flow:
- wait for wake word (default: `布丁布丁`)
- transcribe command by browser SpeechRecognition
- call `pageAgent.execute(command)`

## Install

`voice-page-agent` now installs `page-agent` and `vue-demi` automatically.

Install by Vue runtime target:

```bash
npm i voice-page-agent@vue2
npm i voice-page-agent@vue2.7
npm i voice-page-agent@vue3
```

For Vue 2.7.x and Vue 3.x, no extra composition plugin is needed.

For Vue 2.6.x (`voice-page-agent@vue2`), also install composition plugin:

```bash
npm i @vue/composition-api
```

If you do not specify a tag, `npm i voice-page-agent` installs the `latest` tag.

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

## Vue2 Usage (2.7.x)

```ts
import Vue from "vue";
import VoicePageAgentPlugin from "voice-page-agent";

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

## Vue2 Usage (2.6.x)

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

## Maintainer Release Tags

This package supports release channels by npm dist-tag:

- `vue2` -> Vue `>=2.6.14 <2.7.0`
- `vue2.7` -> Vue `>=2.7.0 <3.0.0`
- `vue3` -> Vue `>=3.2.0 <4.0.0`

Use release branches if you want long-term independent maintenance:

- `release/vue2`
- `release/vue2.7`
- `release/vue3`

Helper scripts:

```bash
npm run target:vue2
npm run target:vue2.7
npm run target:vue3
```

Publish with tag:

```bash
npm run publish:vue2
npm run publish:vue2.7
npm run publish:vue3
```

The publish scripts temporarily adjust `peerDependencies.vue` and restore `package.json` automatically after publish.

One-command multi-channel release (recommended):

```bash
npm run release:multi -- --vue2 2.0.1 --vue2.7 2.7.1 --vue3 3.0.0 --latest vue3
```

Rules in the script:

- `--vue2` must be `2.0.x`
- `--vue2.7` must be `2.7.x`
- `--vue3` must be `3.x`

Dry run:

```bash
npm run publish:vue2 -- --dry-run
npm run release:multi -- --vue2 2.0.1 --vue2.7 2.7.1 --vue3 3.0.0 --latest vue3 --dry-run
```

If you see `E403 ... You cannot publish over the previously published versions`, bump version first:

```bash
npm version patch --no-git-tag-version
```

Run Vue2 demo:

```bash
cd examples/vue2
npm i
npm run dev
```
