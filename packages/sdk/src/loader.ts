/**
 * Script-tag entry. Bundled to dist/loader.js (IIFE) and served from
 * Workers Static Assets (IMPLEMENTATION_PLAN §7).
 *
 * The SDK is now safe to install on production — its UI only activates when
 * the URL carries BOTH `?speqify_session=` and `?speqify_reviewer=`. Without
 * the pair, nothing is rendered and no requests are made.
 *
 *   <script defer src=".../sdk/v1/loader.js" data-speqify-api=".../"></script>
 */
import { init } from "./index.js";

const script = document.currentScript as HTMLScriptElement | null;
const url = new URL(location.href);
const sessionToken = url.searchParams.get("speqify_session") ?? "";
const reviewerToken = url.searchParams.get("speqify_reviewer") ?? "";
const apiBaseUrl = script?.dataset.speqifyApi ?? "https://api.speqify.app";

if (sessionToken && reviewerToken) {
  void init({ sessionToken, reviewerToken, apiBaseUrl, enabled: true });
}
