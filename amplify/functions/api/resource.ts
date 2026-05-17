import { defineFunction } from "@aws-amplify/backend";

export const apiFunction = defineFunction({
  name: "good-neighbor-api",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
