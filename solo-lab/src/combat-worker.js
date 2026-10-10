import { simulate } from "./combat.js";
self.onmessage = ({ data }) => {
  try {
    const result = simulate(data.scenario, data.trials, undefined, (done) =>
      self.postMessage({ done }),
    );
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
