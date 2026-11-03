/* Netzwerkgraphen: Zeichnen als SVG, kürzeste Wege, Weiterleitungstabellen */
(function () {
  "use strict";

  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  function neighbors(edges, id, cut) {
    const out = [];
    edges.forEach(([a, b]) => {
      if (cut && cut.has(key(a, b))) return;
      if (a === id) out.push(b);
      else if (b === id) out.push(a);
    });
    return out.sort();
  }

  // Breitensuche: kürzester Weg (wenigste Hops), bei Gleichstand alphabetisch erster Nachbar
  function path(edges, from, to, cut, passable) {
    if (from === to) return [from];
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const v = queue.shift();
      for (const n of neighbors(edges, v, cut)) {
        if (n in prev) continue;
        if (n !== to && passable && !passable(n)) continue;
        prev[n] = v;
        if (n === to) {
          const p = [to];
          let x = v;
          while (x !== null) { p.unshift(x); x = prev[x]; }
          return p;
        }
        queue.push(n);
      }
    }
    return null;
  }

  // Weiterleitungstabelle eines Routers: Ziel -> nächster Router
  function table(edges, routers, from, cut) {
    const t = {};
    routers.forEach((to) => {
      if (to === from) return;
      const p = path(edges, from, to, cut);
      t[to] = p ? p[1] : "–";
    });
    return t;
  }

  /* Zeichnen: Knoten sind immer Kreise. Die Art (kind) bestimmt nur die Füllfarbe.
     Kurze Beschriftungen (short oder label bis 4 Zeichen) stehen im Kreis, längere darunter.
     nodes: {id: {x, y, label?, short?, kind: "router"|"home"|"client"|"server"|"tap"}}
     opts: {path: [ids], cut: Set, onEdge(a,b), onNode(id), mark: {id: "start"|"goal"|"current"}} */
  function draw(svg, nodes, edges, opts) {
    opts = opts || {};
    const cut = opts.cut || new Set();
    const onPath = new Set();
    if (opts.path) for (let i = 0; i < opts.path.length - 1; i++) onPath.add(key(opts.path[i], opts.path[i + 1]));
    let s = "";
    edges.forEach(([a, b]) => {
      const A = nodes[a], B = nodes[b], k = key(a, b);
      const cls = cut.has(k) ? "cut" : onPath.has(k) ? "on" : "";
      s += `<g class="edge ${cls}" data-a="${a}" data-b="${b}">` +
        `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="hit"/>` +
        `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="vis"/>` +
        (cut.has(k) ? `<text x="${(A.x + B.x) / 2}" y="${(A.y + B.y) / 2 + 5}" class="x">✕</text>` : "") +
        `</g>`;
    });
    Object.entries(nodes).forEach(([id, n]) => {
      const mark = (opts.mark && opts.mark[id]) || "";
      const lbl = n.label || id;
      const kind = n.kind || "router";
      const inPath = opts.path && opts.path.includes(id) ? " inpath" : "";
      if (kind === "tap") { s += `<g class="node tap"><circle cx="${n.x}" cy="${n.y}" r="5"/></g>`; return; }
      const inner = n.short !== undefined ? n.short : lbl.length <= 4 ? lbl : "";
      const below = inner === lbl ? "" : lbl;
      const r = inner.length > 2 ? 19 : 17;
      s += `<g class="node ${kind} ${mark}${inPath}" data-id="${id}" tabindex="${opts.onNode ? 0 : -1}" aria-label="${lbl}">`;
      s += `<circle cx="${n.x}" cy="${n.y}" r="${r}"/>`;
      if (inner) s += `<text x="${n.x}" y="${n.y + 4.5}">${inner}</text>`;
      if (below) s += `<text class="below" x="${n.x}" y="${n.y + r + 14}">${below}</text>`;
      s += `</g>`;
    });
    svg.innerHTML = s;
    if (opts.onEdge) svg.querySelectorAll(".edge").forEach((g) =>
      g.addEventListener("click", () => opts.onEdge(g.dataset.a, g.dataset.b)));
    if (opts.onNode) svg.querySelectorAll(".node").forEach((g) => {
      g.addEventListener("click", () => opts.onNode(g.dataset.id));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onNode(g.dataset.id); } });
    });
  }

  window.Net = { key, neighbors, path, table, draw };
})();
