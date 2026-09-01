export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeNightShiftOnBoot } = await import("./server/night-shift");
  resumeNightShiftOnBoot();
}
