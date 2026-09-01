export async function register(): Promise<void> {
  // Keep the Next.js instrumentation hook free of Node-only application imports.
  // Night Shift recovery is triggered through the server route so Next can bundle
  // the Node runtime code in its normal route boundary.
}
