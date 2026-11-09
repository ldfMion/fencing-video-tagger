import assert from "node:assert/strict";
import test from "node:test";
import {
  checkPhraseAgainstCode,
  formatPhraseFacts,
  PhraseFactsSchema,
  suggestActionCodes,
  type PhraseFacts,
} from "../lib/auto-tag/phrase";
import { buildJobBrief } from "../lib/auto-tag/prompt";

const base: PhraseFacts = {
  attacker: "scorer",
  defence: "none",
  dodged: false,
  riposteAttempted: false,
  scoringHitWasRenewal: false,
  exchangesBeforeHit: 0,
};

test("phrase facts map to the common code families", () => {
  assert.deepEqual(suggestActionCodes({ ...base, attacker: "both" }), ["A-A"]);
  assert.deepEqual(suggestActionCodes({ ...base, defence: "parry-missed" }), ["A-P"]);
  assert.deepEqual(
    suggestActionCodes({ ...base, defence: "parry-found-blade", riposteAttempted: true, scoringHitWasRenewal: true }),
    ["A,R", "A,R-P", "A,R,R"],
  );
  assert.deepEqual(suggestActionCodes({ ...base, defence: "closing-counterattack" }), ["A-Cc"]);
  assert.deepEqual(suggestActionCodes({ ...base, defence: "parry-missed", dodged: true }), ["A-Cc"], "dodging overrides a parry reading");
  assert.deepEqual(suggestActionCodes({ ...base, defence: "stop-hit" }), ["A-Csh"]);
  assert.deepEqual(
    suggestActionCodes({ ...base, defence: "parry-found-blade", riposteAttempted: true, exchangesBeforeHit: 1 }),
    ["CR-P", "CR-R"],
  );
  assert.deepEqual(
    suggestActionCodes({ ...base, attacker: "opponent", defence: "parry-found-blade", riposteAttempted: true, exchangesBeforeHit: 1 }),
    ["R-P", "R-R", "R-AP,P", "R-AP,R"],
  );
  assert.deepEqual(
    suggestActionCodes({ ...base, attacker: "opponent", defence: "parry-found-blade", riposteAttempted: true, exchangesBeforeHit: 2 }),
    ["CCR-P", "CCR-R"],
  );
  assert.deepEqual(suggestActionCodes({ ...base, attacker: "opponent", defence: "closing-counterattack" }), ["Cc-A", "Cc-AP", "Cc-CT"]);
  assert.deepEqual(suggestActionCodes({ ...base, attacker: "opponent", defence: "retreat" }), ["AN-P", "AN-R"]);
  assert.deepEqual(suggestActionCodes({ ...base, attacker: "opponent", defence: "attack-on-preparation" }), ["AP-A", "AP-P"]);
  assert.deepEqual(suggestActionCodes({ ...base, attacker: "opponent", defence: "none" }), []);
});

test("the check speaks up when the code disagrees with the facts", () => {
  assert.equal(checkPhraseAgainstCode({ ...base, defence: "parry-missed" }, "A-P"), null);
  const renewal = checkPhraseAgainstCode(
    { ...base, defence: "parry-found-blade", riposteAttempted: true, scoringHitWasRenewal: true },
    "A-P",
  );
  assert.match(renewal ?? "", /point to `A,R`/);
  assert.match(renewal ?? "", /usually `A,R`/);
  const dodge = checkPhraseAgainstCode({ ...base, defence: "parry-missed", dodged: true }, "A-P");
  assert.match(dodge ?? "", /counterattack cue/);
  assert.equal(checkPhraseAgainstCode({ ...base, attacker: "opponent", defence: "none" }, "AP-A"), null, "no rules, no note");
});

test("facts format to one log line and validate", () => {
  assert.equal(
    formatPhraseFacts({ ...base, defence: "parry-found-blade", riposteAttempted: true, lights: "scorer-only" }),
    "attacker=scorer; defence=parry-found-blade; dodged=no; riposte=attempted; renewal=no; exchanges=0; lights=scorer-only",
  );
  assert.ok(PhraseFactsSchema.safeParse(base).success);
  assert.ok(!PhraseFactsSchema.safeParse({ ...base, defence: "parry" }).success);
});

test("the brief carries the coach's cues", () => {
  const brief = buildJobBrief({
    videoDuration: 100,
    matchClockEnabled: false,
    stripZoneEnabled: true,
    overviewSheetCount: 10,
    overviewFps: 2,
    secondsPerSheet: 10,
    framesPerCallLimit: 60,
    framesRemaining: 4000,
    tags: [],
  });
  assert.ok(/contort/i.test(brief));
  assert.ok(brief.includes("missed riposte"));
});
