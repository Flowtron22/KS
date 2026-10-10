import { armySummary, unitPoints } from "./army-core.js";
import { escapeHtml as esc } from "./ui-html.js";
export function armyShareData(army, data) {
  const summary = armySummary(army, data);
  return {
    name: army.name,
    faction: data.name,
    total: summary.total,
    limit: army.limit,
    unknown: summary.unknown,
    dp: summary.dp,
    budget: summary.budget,
    size: army.battleSize === "incursion" ? "Incursion" : "Strike Force",
    disposition: army.disposition || "Not selected",
    detachments: army.detachments.map(
      (id) =>
        data.detachments.find((d) => d.id === id)?.name ?? "Unknown Detachment",
    ),
    issues: summary.issues,
    units: army.units
      .map((row) => {
        const unit = data.units.find((u) => u.id === row.unitId);
        const weapons = new Map(),
          composition = new Map();
        for (const model of row.loadout?.models ?? []) {
          const name = unit.equipment?.models.find(
            (t) => t.id === model.type,
          )?.name;
          if (name) composition.set(name, (composition.get(name) ?? 0) + 1);
        }
        for (const [id, count] of Object.entries(row.wargear))
          if (count) {
            const name =
              unit.options.find((o) => o.id === id)?.name ?? "Unknown weapon";
            weapons.set(name, (weapons.get(name) ?? 0) + count);
          }
        return {
          name: unit.name,
          models: row.models,
          points: unitPoints(unit, row, army),
          warlord: row.warlord,
          composition: [...composition].map(
            ([name, count]) => count + " × " + name,
          ),
          weapons: [...weapons].map(([name, count]) => count + " × " + name),
          enhancement: unit.options.find((o) => o.id === row.enhancement)?.name,
          attachment: army.units.find((r) => r.id === row.attachment)?.unitId,
          notes: row.notes,
        };
      })
      .map((u) => ({
        ...u,
        attachment: u.attachment
          ? data.units.find((x) => x.id === u.attachment)?.name
          : null,
      })),
  };
}
function lines(ctx, text, width) {
  const output = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (let word of paragraph.split(/\s+/)) {
      if (ctx.measureText(word).width > width) {
        if (line) {
          output.push(line);
          line = "";
        }
        while (ctx.measureText(word).width > width) {
          let cut = 1;
          while (
            cut < word.length &&
            ctx.measureText(word.slice(0, cut + 1)).width <= width
          )
            cut++;
          output.push(word.slice(0, cut));
          word = word.slice(cut);
        }
      }
      if (ctx.measureText(line + " " + word).width > width && line) {
        output.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    output.push(line);
  }
  return output;
}
export function renderArmyImages(info) {
  const width = 1080,
    margin = 64,
    available = width - margin * 2,
    measure = document.createElement("canvas").getContext("2d");
  const blocks = [];
  function block(text, size = 26, color = "#d5d9de", gap = 12, bold = false) {
    measure.font = (bold ? "700 " : "400 ") + size + "px Arial";
    const rows = lines(measure, text, available);
    blocks.push({
      rows,
      size,
      color,
      gap,
      bold,
      height: rows.length * (size + 10) + gap,
    });
  }
  block("CODEX", 62, "#f4e8c8", 0, true);
  block("IMPERIUM  /  ARMY LIST", 20, "#c3a86d", 36, true);
  block(info.name, 46, "#fff5de", 12, true);
  block(info.faction + " · " + info.size, 26, "#a8b4c1", 32);
  block(
    (info.unknown ? "≥ " : "") + info.total + " / " + info.limit + " POINTS",
    44,
    "#f4d080",
    12,
    true,
  );
  block(
    info.dp + " / " + info.budget + " Detachment Points",
    24,
    "#c3a86d",
    32,
  );
  block("DETACHMENTS", 20, "#c3a86d", 10, true);
  block(
    info.detachments.join(" + ") || "Not selected",
    28,
    "#fff5de",
    12,
    true,
  );
  block("Force Disposition · " + info.disposition, 24, "#a8b4c1", 30);
  for (const u of info.units) {
    block(
      u.models + " × " + u.name + "   ·   " + (u.points ?? "?") + " pts",
      30,
      "#fff5de",
      8,
      true,
    );
    if (u.composition?.length)
      block(u.composition.join(" · "), 22, "#a8b4c1", 8);
    if (u.warlord) block("WARLORD", 20, "#f4d080", 8, true);
    if (u.enhancement)
      block("Enhancement · " + u.enhancement, 24, "#c3a86d", 8);
    if (u.attachment) block("Attached to · " + u.attachment, 22, "#a8b4c1", 8);
    block(
      u.weapons.join(" · ") || "Equipment not configured",
      24,
      "#c4ccd6",
      8,
    );
    if (u.notes) block(u.notes, 22, "#a8b4c1", 8);
    block("────────────────────────────────────", 20, "#35414d", 24);
  }
  if (info.issues.length) {
    block("REVIEW NEEDED", 20, "#efb39f", 8, true);
    block(info.issues.join("\n"), 22, "#efb39f", 24);
  }
  block("Community data snapshot · 9 Oct 2026", 20, "#8e9da9", 6);
  block("codex-imperium.vercel.app", 22, "#c3a86d", 0);
  const pages = [];
  let page = [],
    height = margin * 2;
  // A large review section must paginate too; canvas dimensions stay bounded.
  const boundedBlocks = blocks.flatMap((b) =>
    b.height > 9500
      ? b.rows.map((line, index) => ({
          ...b,
          rows: [line],
          gap: index === b.rows.length - 1 ? b.gap : 0,
          height: b.size + 10 + (index === b.rows.length - 1 ? b.gap : 0),
        }))
      : [b],
  );
  for (const b of boundedBlocks) {
    if (height + b.height > 9956 && page.length) {
      pages.push(page);
      page = [];
      height = margin * 2;
    }
    page.push(b);
    height += b.height;
  }
  if (page.length) pages.push(page);
  return pages.map((page, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = page.reduce((n, b) => n + b.height, margin * 2 + 44);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#10171f";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.strokeStyle = "#c3a86d";
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, width - 44, canvas.height - 44);
    let y = margin;
    ctx.textBaseline = "top";
    for (const b of page) {
      ctx.font = (b.bold ? "700 " : "400 ") + b.size + "px Arial";
      ctx.fillStyle = b.color;
      for (const line of b.rows) {
        ctx.fillText(line, margin, y);
        y += b.size + 10;
      }
      y += b.gap;
    }
    ctx.font = "18px Arial";
    ctx.fillStyle = "#8e9da9";
    ctx.fillText(
      "ARMY LIST · " + (index + 1) + " / " + pages.length,
      margin,
      canvas.height - margin,
    );
    return canvas;
  });
}
function blobFor(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(Error("Image could not be created.")),
      "image/png",
    ),
  );
}
export async function openArmyShare(root, army, data) {
  if (!army.units.length) throw Error("Add units before sharing your army.");
  const images = await Promise.all(
    renderArmyImages(armyShareData(army, data)).map(blobFor),
  );
  const urls = images.map((blob) => URL.createObjectURL(blob));
  const base =
    army.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 80) || "army";
  const files = images.map(
    (blob, i) =>
      new File(
        [blob],
        base + (images.length > 1 ? "-" + (i + 1) : "") + ".png",
        { type: "image/png" },
      ),
  );
  root.innerHTML =
    '<div class="config-overlay"><section class="unit-config-panel army-share-panel" role="dialog" aria-modal="true" aria-label="Share army image"><div class="panel-top"><span class="eyebrow">SHARE YOUR ARMY</span><button id="close-share" class="mini" aria-label="Close army image">✕</button></div><h2>' +
    esc(army.name) +
    '</h2><p>Ready for your group chat. Save the image or share it from your device.</p><div class="share-actions">' +
    urls
      .map(
        (url, i) =>
          '<a class="button orange" href="' +
          url +
          '" download="' +
          esc(files[i].name) +
          '">Save PNG' +
          (urls.length > 1 ? " " + (i + 1) : "") +
          "</a>",
      )
      .join("") +
    '<button id="native-share" class="button">Share image</button></div><div class="army-share-images">' +
    urls
      .map(
        (url) =>
          '<img src="' +
          url +
          '" alt="Army list with Detachments, points and equipment">',
      )
      .join("") +
    '</div><p id="share-status" role="status"></p></section></div>';
  const close = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    root.innerHTML = "";
  };
  root.querySelector("#close-share").onclick = close;
  const panel = root.querySelector("[role=dialog]");
  panel.onkeydown = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const items = [...panel.querySelectorAll("button,a")];
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  root.querySelector("#native-share").onclick = async () => {
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: army.name });
      } else {
        for (const a of root.querySelectorAll("a[download]")) a.click();
        root.querySelector("#share-status").textContent =
          "Image saved. Attach it to your group chat.";
      }
    } catch (e) {
      if (e.name !== "AbortError")
        root.querySelector("#share-status").textContent =
          "Use Save PNG to share this image.";
    }
  };
  root.querySelector("#close-share").focus();
}
