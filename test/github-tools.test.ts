import assert from "node:assert/strict";
import { test } from "node:test";

import {
  describeFailure,
  getDiff,
  getPullRequest,
  postReview,
} from "../opencomputer/agents/pr-review/tools/github-tools.js";

function response(status: number, body: string): Response {
  return new Response(body, { status });
}

test("RFC 7807 problem bodies are attributed to managed egress", async () => {
  const message = await describeFailure(
    response(
      409,
      JSON.stringify({
        type: "secret_unavailable",
        title: "Secret GITHUB_TOKEN is missing",
      }),
    ),
    "/repos/acme/widgets/pulls/1",
  );
  assert.equal(
    message,
    "managed egress rejected /repos/acme/widgets/pulls/1: 409 Secret GITHUB_TOKEN is missing",
  );
});

test("GitHub error bodies with a title are still attributed to GitHub", async () => {
  const message = await describeFailure(
    response(404, JSON.stringify({ title: "Not Found", status: "404" })),
    "/repos/acme/widgets/pulls/1",
  );
  assert.match(message, /^GitHub returned 404/);
});

test("GitHub message bodies surface the message", async () => {
  const message = await describeFailure(
    response(
      403,
      JSON.stringify({ message: "API rate limit exceeded for token." }),
    ),
    "/repos/acme/widgets/pulls/1",
  );
  assert.equal(
    message,
    "GitHub returned 403 for /repos/acme/widgets/pulls/1: API rate limit exceeded for token.",
  );
});

test("non-JSON bodies are truncated into the detail", async () => {
  const message = await describeFailure(
    response(403, `\r\nRequest forbidden by administrative rules. ${"x".repeat(300)}`),
    "/repos/acme/widgets/pulls/1",
  );
  assert.match(message, /^GitHub returned 403/);
  assert.ok(message.length < 260);
});

test("empty bodies produce a bare status message", async () => {
  const message = await describeFailure(
    response(500, ""),
    "/repos/acme/widgets/pulls/1",
  );
  assert.equal(message, "GitHub returned 500 for /repos/acme/widgets/pulls/1");
});

test("tool input schemas require the PR reference", () => {
  for (const tool of [getPullRequest, getDiff, postReview]) {
    const input = tool.input as {
      required: string[];
      additionalProperties: boolean;
    };
    for (const field of ["owner", "repo", "number"]) {
      assert.ok(
        input.required.includes(field),
        `${tool.name} must require ${field}`,
      );
    }
    assert.equal(input.additionalProperties, false);
  }
});

test("post_review additionally requires a body", () => {
  const input = postReview.input as { required: string[] };
  assert.ok(input.required.includes("body"));
});
