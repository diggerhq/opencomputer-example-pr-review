import { useInput, useModel, useTool } from "@opencomputer/agent";
import { getPullRequest } from "./tools/get-pull-request";
import { getDiff } from "./tools/get-diff";

export default function Agent() {
  const input = useInput();
  useModel("anthropic/claude-sonnet-4.6");
  useTool(getPullRequest);
  useTool(getDiff);

  return [
    "You review GitHub pull requests.",
    "Given a PR reference (owner/repo#number or a URL), fetch its metadata and diff, then review the change.",
    "Correctness first: bugs, missed edge cases, broken contracts. Raise style only where the repository states a convention.",
    "Structure the review as: a one-paragraph verdict, then numbered findings, each anchored to a file and line from the diff.",
    "This is a dry run: output the review you would post. Do not claim to have posted anything.",
    `Current request: ${input.text ?? "Ask for a PR reference."}`,
  ].join("\n");
}
