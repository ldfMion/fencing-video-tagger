import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_CODES,
  getActionDefinition,
  getActionDescription,
  getTacticalIntent,
} from "../lib/action-classifications";
import { buildJobBrief } from "../lib/auto-tag/prompt";
import { ActionCodeSchema } from "../lib/types";

test("every action code has a description and a classification", () => {
  assert.ok(ACTION_CODES.length > 40);
  for (const code of ACTION_CODES) {
    const definition = getActionDefinition(code);
    assert.ok(definition.description.length > 20, `${code} has a description`);
    assert.ok(
      definition.tacticalIntent === "offense" || definition.tacticalIntent === "defense" ||
        definition.tacticalIntent === null,
      `${code} has a tactical intent`,
    );
    if (definition.tacticalIntent === "offense") {
      assert.equal(definition.scoringDefAlt, undefined, `${code}: offense has no scoring defense`);
    }
    if (definition.tacticalIntent === "defense") {
      assert.equal(definition.receivingDefAlt, undefined, `${code}: defense has no receiving defense`);
    }
  }
});

test("the schema and the list come from the same table", () => {
  assert.deepEqual(ActionCodeSchema.options, ACTION_CODES);
  assert.equal(getTacticalIntent("yc"), null);
  assert.equal(getTacticalIntent("A-P"), "offense");
});

test("the job brief explains each action code", () => {
  const brief = buildJobBrief({
    leftFencer: "A",
    rightFencer: "B",
    videoDuration: 100,
    matchClockEnabled: false,
    stripZoneEnabled: false,
    overviewSheetCount: 10,
    overviewFps: 2,
    secondsPerSheet: 10,
    framesPerCallLimit: 60,
    framesRemaining: 4000,
    tags: [],
  });
  for (const code of ACTION_CODES) {
    assert.ok(brief.includes(`- \`${code}\`: ${getActionDescription(code)}`), `brief describes ${code}`);
  }
  const offenseAt = brief.indexOf("## Offense");
  const defenseAt = brief.indexOf("## Defense");
  assert.ok(offenseAt > 0 && defenseAt > offenseAt);
  assert.ok(brief.indexOf("- `A-P`:") > offenseAt && brief.indexOf("- `A-P`:") < defenseAt);
  assert.ok(brief.indexOf("- `R-P`:") > defenseAt);
});
