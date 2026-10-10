// Panel identity belongs to the template, independent of CSS classes or order.
export function capturePanels(root) {
  return new Set(
    Array.from(
      root.querySelectorAll("details[data-panel][open]"),
      (el) => el.dataset.panel,
    ),
  );
}

export function restorePanels(root, open) {
  for (const el of root.querySelectorAll("details[data-panel]"))
    el.open = open.has(el.dataset.panel);
}
