import { describe, expect, test } from "bun:test";
import { getMessageSources, isChatSourceWire } from "./sources.ts";

describe("sources", () => {
  test("isChatSourceWire requires id and sourceRef object", () => {
    expect(isChatSourceWire({ id: "a", sourceRef: { bucket: "b", key: "k" } })).toBe(true);
    expect(isChatSourceWire({ id: "a" })).toBe(false);
    expect(isChatSourceWire(null)).toBe(false);
  });

  test("getMessageSources reads metadata.sources", () => {
    expect(
      getMessageSources({
        sources: [
          { id: "s1", title: "A", sourceRef: { memory_id: "m1", source_key: "k" } },
          { id: 2, sourceRef: {} },
        ],
      }),
    ).toEqual([{ id: "s1", title: "A", sourceRef: { memory_id: "m1", source_key: "k" } }]);
    expect(getMessageSources(undefined)).toEqual([]);
  });
});
