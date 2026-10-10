import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addUnit, newArmy, unitPoints, armySummary } from '../src/army-core.js';
import { armyShareData } from '../src/army-share.js';
import { duplicatePriceRule } from '../tools/duplicate-price.mjs';
const data = JSON.parse(await readFile(new URL('../public/armies/imperial-knights.json', import.meta.url), 'utf8'));
test('Knight duplicate costs agree across rows, totals and shared images, without false warnings', () => {
  for (const [name, expected] of [
    ['Cerastus Knight Lancer', [415, 435, 455]],
    ['Knight Crusader', [395, 415, 435]],
    ['Knight Destrier', [265, 265, 280]],
  ]) {
    const unit = data.units.find(u => u.name === name), army = newArmy(data);
    for (const price of expected) {
      const row = addUnit(army, unit);
      assert.equal(unitPoints(unit, row, army), price);
      assert.ok(!armySummary(army, data).issues.some(i => i.includes('conditional points')));
    }
    assert.equal(armySummary(army, data).total, expected.reduce((a, b) => a + b));
    assert.deepEqual(armyShareData(army, data).units.map(u => u.points), expected);
    army.units.splice(0, 1);
    assert.equal(unitPoints(unit, army.units[0], army), expected[0]);
    army.units[1].pointsOverride = 300;
    assert.equal(unitPoints(unit, army.units[1], army), 300);
  }
});
test('Unsupported price conditions remain flagged instead of being silently discarded', () => {
  assert.equal(duplicatePriceRule({type:'increment', value:20, conditions:[{type:'atLeast'}]}, 'unit'), null);
  const unit = {...data.units.find(u => u.name === 'Knight Crusader'), conditionalPrice:true};
  const army = newArmy(data); addUnit(army, unit);
  assert.ok(armySummary(army, {...data, units:[unit]}).issues.some(i => i.includes('conditional points')));
});
