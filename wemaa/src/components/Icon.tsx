export type IconName =
  | "ear"
  | "team"
  | "check"
  | "heart"
  | "lock"
  | "clock"
  | "chat"
  | "arrow"
  | "briefcase";

const paths: Record<IconName, string> = {
  ear: "M9 4a5 5 0 0 1 5 5c0 1.7-.7 2.5-1.5 3.4-.7.8-1.5 1.6-1.5 3.1a2.5 2.5 0 0 1-5 0M9 4a5 5 0 0 0-5 5v3a3 3 0 0 0 3 3",
  team: "M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c0-2.8 2.7-5 6-5s6 2.2 6 5M12 19c0-2.2 1.8-4 4-4s4 1.8 4 4",
  check: "m5 13 4 4L19 7",
  heart: "M12 20.5s-7.5-4.6-9.5-9C1 7.8 2.7 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.3.5 5 3.8 3.5 7.5-2 4.4-9.5 9-9.5 9Z",
  lock: "M6 11V8a6 6 0 1 1 12 0v3M5 11h14v9H5v-9Z",
  clock: "M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  chat: "M4 4h16v11H8l-4 4V4Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  briefcase: "M4 8h16v11H4V8ZM9 8V5h6v3M4 13h16",
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
