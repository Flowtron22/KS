// The final dashboard is rendered once; no legacy layout is built or rearranged.
export function combatShell() {
  return `<header><a class="brand" href="#"><span>CODEX<span class="brand-sub">Imperium</span></span></a><nav aria-label="Workspace"><button id="combat-tab" class="nav active">Combat calculator</button><button id="army-tab" class="nav">Army Lists</button></nav><span class="version"><i></i> EXPERIMENT</span></header>
<main>
 <div class="page-heading"><div><h1 id="title">WHAT DOES YOUR UNIT DO?</h1><p id="description">Pick two units. Watch the dice. Test the odds.</p></div><div class="heading-actions"><button id="save-scenario" class="button">Save scenario</button><button id="load-scenario" class="button">Load saved</button><button id="example" class="button dark">Custodes vs Lancer</button></div></div>
 <div id="notice" role="status" aria-live="polite"></div>
 <section id="combat-view">
  <div class="combat-dashboard">
   <section class="simulation-stage panel">
    <div class="table-heading"><span class="eyebrow">DICE TABLE</span><span id="table-status">Ready to roll</span></div>
    <div class="scenario-bar panel"><div class="phase-switch"><button id="fight" class="active">Fight phase</button><button id="shoot">Shooting phase</button></div><label>Attacks first<select id="first"><option value="0">Unit A</option><option value="1">Unit B</option></select></label><label class="check"><input id="fight-back" type="checkbox" checked> Survivors fight back</label><button id="swap" class="button">Swap units ⇄</button></div>
    <div id="arena" class="arena" aria-label="Matchup preview"></div>
    <div id="table-actions" class="table-actions"><button id="roll" class="button orange">⚄ Roll attacks</button><button id="simulate" class="button dark">Run simulations →</button>
     <details class="run-settings"><summary>Roll settings</summary><div class="experiment-controls panel"><label>Random seed<input id="seed" type="number" min="0" max="4294967295" value="40000"></label><button id="new-seed" class="mini">New seed ↻</button><label>Dice animation<select id="pace"><option value="normal">Normal</option><option value="fast">Fast</option><option value="instant">Instant</option></select></label><label>Number of simulations<select id="trials"><option value="1000">1,000</option><option value="10000" selected>10,000</option><option value="50000">50,000</option></select></label><label class="check"><input id="replay-seed" type="checkbox"> Replay this seed</label></div></details>
    </div>
    <section class="panel live-dice"><div id="dice-output" aria-live="polite"></div></section>
   </section>
   <aside class="outcome-panel panel" aria-label="Simulation results"><div class="table-heading"><span id="outcome-title" class="eyebrow">EXPECTED RESULT</span><span>Repeat & compare</span></div><div id="results" aria-live="polite"></div></aside>
  </div>
  <div class="setup-heading"><div><span class="eyebrow">THE MATCHUP</span><h2>Choose your units</h2></div><span>Pick a weapon. Add abilities if you need them.</span></div>
  <div class="matchup"><section id="unit-0" class="panel combat-unit"></section><section id="unit-1" class="panel combat-unit"></section></div>
  <details class="calculation-notes"><summary>Rules, assumptions & data</summary><section class="rules-note"><strong>What this calculates</strong><p>One weapon profile per unit, shared by the chosen weapon bearers. All models in a unit use the same Toughness, Save and Wounds. Normal damage does not spill between models. Fight back uses surviving models, with selected weapon bearers surviving first. Each run starts fresh.</p><p><b>Only selected Ka’tahs, confirmed ability effects and configured effects are applied. Other abilities, weapon keywords, Detachments, Enhancements and Stratagems are not applied automatically.</b> Set supported effects manually. Range, charges, engagement and fight order are assumed.</p></section></details>
  <details class="file-tools"><summary>Save files & export results</summary><div class="report-exports"><button id="export-roll" class="mini" disabled>Export rolls JSON</button><button id="export-results" class="mini" disabled>Export results JSON</button></div><div class="scenario-files"><button id="export-scenario" class="mini">Export scenario JSON</button><label class="import-label">Import scenario JSON<input id="import-scenario" type="file" accept="application/json" hidden></label></div></details>
 </section>
 <section id="army-view" hidden><div id="army-builder-root"></div></section>
 <footer><span>40K COMBAT LAB · PROTOTYPE</span><span>Community stat snapshot · 9 Oct 2026 · points not officially verified</span><a href="https://github.com/BSData/wh40k-11e/tree/cc58ee3b2c23f90af9d00e7bf234cd703b762299" target="_blank" rel="noreferrer">Data source ↗</a></footer>
</main>`;
}
