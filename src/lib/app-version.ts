/** True when the deployed build differs from the one running in this tab. */
export function isNewerBuild(current: string, remote: unknown): boolean {
  return typeof remote === "string" && remote.length > 0 && remote !== current;
}
