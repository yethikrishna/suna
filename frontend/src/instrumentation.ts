// Sentry instrumentation disabled
export async function register() {
  // Sentry is currently disabled in next.config.ts
  console.log('Instrumentation registered (Sentry disabled)');
}

export const onRequestError = () => {
  // Sentry disabled
};
