import { submitGithub } from "./github.js";
import { submitGitlab } from "./gitlab.js";
import { submitJira } from "./jira.js";
import { submitLinear } from "./linear.js";
import { TrackerError, type SubmitInput, type SubmitResult, type TrackerConfig } from "./types.js";

export * from "./types.js";
export { composeMarkdown } from "./format.js";
export { composeAdf } from "./adf.js";
export { SCREENSHOT_EMBED, VIDEO_UPLOAD } from "./media.js";

/** Submit a ticket to whichever tracker the config selects. */
export function submitTicket(config: TrackerConfig, input: SubmitInput): Promise<SubmitResult> {
  switch (config.kind) {
    case "github":
      return submitGithub(config, input);
    case "jira":
      return submitJira(config, input);
    case "linear":
      return submitLinear(config, input);
    case "gitlab":
      return submitGitlab(config, input);
    default: {
      const _exhaustive: never = config;
      throw new TrackerError(`Unknown tracker: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
