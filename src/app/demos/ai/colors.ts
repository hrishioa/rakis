import { LLMModelName } from "../../../core/synthient-chain/llm/types";

export const modelColors: Record<LLMModelName, string> = {
  "Llama-3-8B-Instruct-q4f32_1": "border-blue-500",
  "Llama-2-7b-chat-hf-q4f16_1": "border-sky-500",
  "Llama-2-13b-chat-hf-q4f16_1": "border-green-500",
  "Mistral-7B-Instruct-v0.2-q4f16_1": "border-purple-500",
  "Hermes-2-Pro-Mistral-7B-q4f16_1": "border-cyan-500",
  "gemma-2b-it-q4f16_1": "border-yellow-500",
  "TinyLlama-1.1B-Chat-v0.4-q0f16": "border-red-500",
};

export const borderColorToHex: Record<string, string> = {
  "border-blue-500": "#3B82F6",
  "border-sky-500": "#0EA5E9",
  "border-green-500": "#10B981",
  "border-purple-500": "#8B5CF6",
  "border-cyan-500": "#06B6D4",
  "border-yellow-500": "#F59E0B",
  "border-red-500": "#EF4444",
};
