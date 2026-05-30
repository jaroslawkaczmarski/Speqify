import { resolve } from "node:path";
import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  // Absolute so it's unambiguous: <ext>/public (where copy-ort.mjs writes the ORT runtime).
  publicDir: resolve(import.meta.dirname, "public"),
  modules: ["@wxt-dev/module-react"],
  // ORT's wasm is served same-origin from public/ort (copy-ort.mjs) and ORT is pointed
  // there via env.wasm.wasmPaths. Vite ALSO auto-emits a copy from the `new URL(...)`
  // reference inside onnxruntime-web — drop that duplicate so we don't ship ~23 MB twice.
  vite: () => ({
    plugins: [
      {
        name: "speqify-drop-bundled-ort-wasm",
        generateBundle(_options, bundle) {
          for (const file of Object.keys(bundle)) {
            if (/ort-wasm.*\.wasm$/.test(file)) delete (bundle as Record<string, unknown>)[file];
          }
        },
      },
    ],
  }),
  manifest: {
    name: "Speqify",
    description:
      "Talk to your tracker — capture any element, record your voice, and ship a structured issue to Jira, GitHub, Linear, or GitLab.",
    permissions: ["sidePanel", "activeTab", "scripting", "storage", "tabs"],
    host_permissions: ["<all_urls>"],
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    action: {
      default_title: "Open Speqify",
      default_icon: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    },
    // Global shortcut: Alt+S (⌥S on macOS) invokes the action → opens the side panel.
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+S" },
        description: "Open Speqify",
      },
    },
    // 'wasm-unsafe-eval' lets on-device models (Transformers.js / ONNX Runtime Web) run.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  hooks: {
    // Open the full Settings surface in its own tab (it's a wide, desktop layout).
    "build:manifestGenerated": (_wxt, manifest) => {
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true;
    },
  },
});
