export default {
  agent: {
    name: "compiled-boot-demo",
    model: "demo/local",
    instructions: "Answer clearly and keep replies short.",
  },
  routes: {
    health: "/health",
    config: "/config",
  },
} as const;
