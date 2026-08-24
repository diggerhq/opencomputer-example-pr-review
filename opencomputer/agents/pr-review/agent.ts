import { useInput, useModel, useTool } from "@opencomputer/agent";
import { getPullRequest } from "./tools/get-pull-request";
import { getDiff } from "./tools/get-diff";
import { postReview } from "./tools/post-review";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function Agent() {
  const input = useInput();
  const payload = isRecord(input.payload) ? input.payload : {};
  // Dry-run unless the caller explicitly asks for a live post.
  const live =
    payload.live === true || /\bpost\b.*\breview\b/i.test(input.text ?? "");

  useModel("anthropic/claude-sonnet-4.6");
  useTool(getPullRequest);
  useTool(getDiff);
  if (live) {
    useTool(postReview);
  }

  return [
    "You review GitHub pull requests.",
    "Given a PR reference (owner/repo#number or a URL), fetch its metadata and diff, then review the change.",
    "Correctness first: bugs, missed edge cases, broken contracts. Raise style only where the repository states a convention.",
    "Structure the review as: a one-paragraph verdict first, then numbered findings, each anchored to a file and line from the diff.",
    live
      ? "Post the finished review with post_review as a COMMENT review: verdict and findings in the body, plus inline comments for findings you can anchor to a new-side diff line. Report the review URL."
      : "This is a dry run: output the review you would post. Do not claim to have posted anything.",
    `Current request: ${input.text ?? "Ask for a PR reference."}`,
  ].join("\n");
}
