const containers = [".unit-catalogue", ".unit-config-panel", ".army-roster", ".builder-steps"];

export function captureArmyScroll(root) {
  return {
    page: [window.scrollX, window.scrollY],
    containers: containers.flatMap(selector => {
      const el = root.querySelector(selector);
      return el ? [{ selector, top: el.scrollTop, left: el.scrollLeft }] : [];
    }),
  };
}

export function restoreArmyScroll(root, state) {
  for (const { selector, top, left } of state.containers) {
    const el = root.querySelector(selector);
    if (el) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }
  window.scrollTo({ left: state.page[0], top: state.page[1], behavior: "instant" });
}
