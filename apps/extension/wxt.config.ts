import { resolve } from "node:path";
import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  // Absolute so it's unambiguous: <ext>/public (where copy-ort.mjs writes the ORT runtime).
  publicDir: resolve(import.meta.dirname, "public"),
  modules: ["@wxt-dev/module-react"],
  // Force MV3 on every target. WXT defaults Firefox/Safari to MV2, but our CSP,
  // host permissions, and background design assume MV3.
  manifestVersion: 3,
  // Firefox/AMO needs a reproducible source bundle. Root the sources zip at the monorepo
  // so the workspace deps (@speqify/core, @speqify/ui) and pnpm-lock.yaml are included
  // (WXT's `downloadPackages` can't pack pnpm `link:` deps). Reviewer repro:
  //   pnpm install && pnpm --filter @speqify/extension zip:firefox
  zip: {
    sourcesRoot: resolve(import.meta.dirname, "../.."),
    excludeSources: [
      "**/node_modules/**",
      "**/.output/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.wxt/**",
      "**/.git/**",
    ],
  },
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
  // Per-browser manifest. The sidepanel entrypoint makes WXT emit Chrome's `side_panel`
  // (+ `sidePanel` permission) on Chromium and `sidebar_action` on Firefox automatically;
  // we only adjust the bits WXT can't infer (the invalid sidePanel perm on Firefox, the
  // keyboard command, and the required gecko id).
  manifest: ({ browser }) => {
    const firefox = browser === "firefox";
    const icons = { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" };
    return {
      name: "Speqify",
      description:
        "Talk to your tracker — capture any element, record your voice, and ship a structured issue to Jira, GitHub, Linear, or GitLab.",
      // Firefox has no `sidePanel` API (it uses `sidebar_action`), so listing the
      // permission there triggers an "unknown permission" install warning.
      permissions: firefox
        ? ["activeTab", "scripting", "storage", "tabs"]
        : ["sidePanel", "activeTab", "scripting", "storage", "tabs"],
      host_permissions: ["<all_urls>"],
      icons,
      action: { default_title: "Open Speqify", default_icon: icons },
      // Alt+S (⌥S on macOS): Chromium opens the side panel via the action; Firefox toggles
      // its sidebar with the built-in `_execute_sidebar_action` command (no background JS).
      commands: firefox
        ? { _execute_sidebar_action: { suggested_key: { default: "Alt+S" } } }
        : { _execute_action: { suggested_key: { default: "Alt+S" }, description: "Open Speqify" } },
      // 'wasm-unsafe-eval' lets on-device models (Transformers.js / ONNX Runtime Web) run.
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      },
      // Firefox MV3 needs a stable add-on id; 128 is the floor for MV3 + content-script world:"MAIN".
      ...(firefox
        ? {
            browser_specific_settings: {
              gecko: { id: "speqify@8cells.dev", strict_min_version: "128.0" },
            },
          }
        : {}),
    };
  },
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      // Open the full Settings surface in its own tab (it's a wide, desktop layout).
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true;

      // Opera is Chromium but has no `chrome.sidePanel` — it uses `sidebar_action`
      // (like Firefox). Rewrite the Chrome side-panel manifest into Opera's form.
      if (wxt.config.browser === "opera") {
        const m = manifest as Record<string, unknown>;
        delete m.side_panel;
        if (Array.isArray(manifest.permissions)) {
          manifest.permissions = manifest.permissions.filter((p) => p !== "sidePanel");
        }
        m.sidebar_action = { default_panel: "sidepanel.html", default_title: "Speqify" };
      }
    },
  },
});
