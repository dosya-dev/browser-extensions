import { describe, it, expect } from "vitest";
import { getDestination, setDestination, getRecentFolders, rememberFolder } from "./prefs";
const d = (folderId: string) => ({ workspaceId: "ws", workspaceName: "Personal", folderId, folderName: folderId });
describe("prefs", () => {
  it("destination round-trips and starts null", async () => {
    expect(await getDestination()).toBeNull();
    await setDestination(d("f1")); expect(await getDestination()).toEqual(d("f1"));
  });
  it("recent folders: most recent first, deduped, capped at five", async () => {
    for (const f of ["a", "b", "c", "a", "d", "e", "f"]) await rememberFolder(d(f));
    expect((await getRecentFolders()).map((x) => x.folderId)).toEqual(["f", "e", "d", "a", "c"]);
  });
});
