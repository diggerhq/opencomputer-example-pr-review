import { useInput, useModel } from "@opencomputer/agent";

export default function Agent() {
  const input = useInput();
  useModel("anthropic/claude-sonnet-4.6");

  return input.text
    ? "You are a helpful OpenComputer agent. Respond directly to: " + input.text
    : "You are a helpful OpenComputer agent.";
}
