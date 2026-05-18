/**
 * Script-tag entry. Bundled to dist/loader.js (IIFE) and served from
 * Workers Static Assets (IMPLEMENTATION_PLAN §7). Host apps include it ONLY
 * on review/test environments — its mere presence is the env gate.
 *
 *   <script defer src=".../sdk/v1/loader.js" data-speqify-token="..."></script>
 */
import { init } from "./index.js";

const script = document.currentScript as HTMLScriptElement | null;
const fromUrl = new URL(location.href).searchParams.get("speqify");
const token = fromUrl ?? script?.dataset.speqifyToken ?? "";
const apiBaseUrl = script?.dataset.speqifyApi ?? "https://api.speqify.app";

if (token) {
  void init({ token, apiBaseUrl, enabled: true });
}
