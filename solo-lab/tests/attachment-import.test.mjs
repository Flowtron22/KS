import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileAttachment } from "../tools/attachment-compiler.mjs";
import { attachmentCandidates } from "../src/army-attachments.js";
import { newArmy, addUnit } from "../src/army-core.js";

test("Bodyguard importer accepts inline lists, singular units and square bullets without losing existing bullet targets", () => {
  const compile = (description) =>
    compileAttachment(
      [
        {
          name: "Leader",
          characteristics: [{ name: "Description", $text: description }],
        },
      ],
      [],
    );
  for (const description of [
    "This model can be attached to the following units: INTERCESSOR SQUAD, HELLBLASTER SQUAD",
    "This model can be attached to the following units:\n- **Intercessor Squad**\n• Hellblaster Squad",
    "This model can be attached to the following units:\n\n■ Intercessor Squad\n▪ Hellblaster Squad",
  ]) {
    assert.deepEqual(
      compile(description).targets.map((name) => name.toLowerCase()),
      ["intercessor squad", "hellblaster squad"],
    );
    assert.deepEqual(compile(description).review, []);
  }
  assert.deepEqual(
    compile(
      "This model can be attached to the following unit: Intercessor Squad.",
    ).targets,
    ["Intercessor Squad"],
  );
});

test("Regenerated Captain, Blade Champion and Apothecary Biologis offer valid Bodyguards and reject incompatible ones", async () => {
  for (const [faction, character, eligible, invalid] of [
    [
      "space-marines",
      "Captain",
      "Intercessor Squad",
      "Heavy Intercessor Squad",
    ],
    [
      "space-marines",
      "Apothecary Biologis",
      "Heavy Intercessor Squad",
      "Intercessor Squad",
    ],
    ["adeptus-custodes", "Blade Champion", "Custodian Guard", "Prosecutors"],
    [
      "genestealer-cults",
      "Jackal Alphus",
      "Atalan Jackals",
      "Neophyte Hybrids",
    ],
  ]) {
    const data = JSON.parse(
      await readFile(
        new URL(`../public/armies/${faction}.json`, import.meta.url),
        "utf8",
      ),
    );
    const army = newArmy(data);
    const add = (name) =>
      addUnit(
        army,
        data.units.find((unit) => unit.name === name),
      );
    const source = add(character),
      target = add(eligible);
    add(invalid);
    assert.deepEqual(
      attachmentCandidates(army, data, source).map((row) => row.id),
      [target.id],
      character,
    );
    const second = add(character);
    source.attachment = target.id;
    assert.deepEqual(
      attachmentCandidates(army, data, second),
      [],
      "An occupied slot stays unavailable",
    );
  }
});
