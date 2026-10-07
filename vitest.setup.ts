import { IDBFactory } from "fake-indexeddb";
import { beforeEach } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { resetDbForTests } from "./src/lib/store/db";

beforeEach(() => {
  fakeBrowser.reset();
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});
