import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSpeakerLabel, getSpeakerSide } from "./labels.ts";

describe("utterance speaker labels", () => {
  it("maps both audio sides to group names, not personal names", () => {
    assert.equal(getSpeakerSide("local_pm"), "ours");
    assert.equal(getSpeakerSide("remote_client"), "theirs");
    assert.equal(getSpeakerLabel("local_pm"), "こちら");
    assert.equal(getSpeakerLabel("remote_client"), "むこう");
  });
});
