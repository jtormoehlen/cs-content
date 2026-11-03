/* SpaceBug im Browser: Welt nach der Semantik von Python-SpaceBug (inf-schule) und ein Editor
   mit schrittweiser Ausführung über MiniPy.
   Welt-Notation (Zeile 0 oben): '#' Asteroid, 'P' PowerUp, '.' leer,
   Argo: '>' rechts, '^' oben, '<' links, 'v' unten; Argo auf PowerUp: 'R','U','L','D'. */
(function () {
  "use strict";
  const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]]; // rechts, oben, links, unten (dx, dy)
  const DIRNAME = ["rechts", "oben", "links", "unten"];
  const { PyError } = window.MiniPy;

  class World {
    constructor(rows) {
      this.rows = rows.length;
      this.cols = Math.max(...rows.map((r) => r.length));
      this.rock = new Set(); this.pow = new Set();
      this.pos = [0, 0]; this.d = 0; this.ticks = 0;
      rows.forEach((line, r) => [...line].forEach((ch, c) => {
        const k = r + "," + c;
        if (ch === "#") this.rock.add(k);
        else if (ch === "P") this.pow.add(k);
        const a = ">^<v".indexOf(ch), b = "RULD".indexOf(ch);
        if (a >= 0) { this.pos = [r, c]; this.d = a; }
        if (b >= 0) { this.pos = [r, c]; this.d = b; this.pow.add(k); }
      }));
      this.startPow = this.pow.size;
      this.put = 0; this.removed = 0; this.trail = [this.pos.slice()];
    }
    nb(d) { const [dx, dy] = DIRS[d]; return [((this.pos[0] + dy) % this.rows + this.rows) % this.rows, ((this.pos[1] + dx) % this.cols + this.cols) % this.cols]; }
    isRock(p) { return this.rock.has(p[0] + "," + p[1]); }
    tick() { if (++this.ticks > 5000) throw new PyError("Endlosschleife", "Die Argo hat über 5000 Befehle ausgeführt, vermutlich eine Endlosschleife.", 0); }
    move() { this.tick(); const n = this.nb(this.d); if (this.isRock(n)) throw new PyError("Kollision", `Die Argo ist mit einem Asteroiden zusammengestoßen (Zeile ${n[0]}, Spalte ${n[1]}).`, 0); this.pos = n; this.trail.push(n.slice()); }
    turnLeft() { this.tick(); this.d = (this.d + 1) % 4; }
    turnRight() { this.tick(); this.d = (this.d + 3) % 4; }
    rockFront() { this.tick(); return this.isRock(this.nb(this.d)); }
    rockLeft() { this.tick(); return this.isRock(this.nb((this.d + 1) % 4)); }
    rockRight() { this.tick(); return this.isRock(this.nb((this.d + 3) % 4)); }
    onPow() { this.tick(); return this.pow.has(this.pos.join(",")); }
    putPow() { this.tick(); const k = this.pos.join(","); if (this.pow.has(k)) throw new PyError("FeldBelegt", "Das Feld ist bereits belegt! (putPow auf einem PowerUp)", 0); this.pow.add(k); this.put++; }
    removePow() { this.tick(); const k = this.pos.join(","); if (!this.pow.has(k)) throw new PyError("NichtsDa", "Hier liegt kein PowerUp, das man einsammeln könnte! (removePow)", 0); this.pow.delete(k); this.removed++; }
    get dirName() { return DIRNAME[this.d]; }
  }
  const COMMANDS = ["move", "turnLeft", "turnRight", "rockFront", "rockLeft", "rockRight", "onPow", "putPow", "removePow"];
  const ACTIONS = new Set(["move", "turnLeft", "turnRight", "putPow", "removePow"]);

  function builtinsFor(world) {
    const b = {};
    COMMANDS.forEach((c) => {
      b[c] = function* (args, kw, line) {
        if (args.length) throw new PyError("TypeError", `${c}() erwartet keine Argumente.`, line);
        let r;
        try { r = world[c](); } catch (e) { if (e instanceof PyError && !e.line) e.line = line; throw e; }
        if (ACTIONS.has(c)) yield { type: "act", cmd: c, line };
        return r === undefined ? null : r;
      };
    });
    return b;
  }

  // Programm ohne Animation ausführen (für Tests und „alle Welten prüfen“)
  function runSilent(code, rows, inputs) {
    const w = rows ? new World(rows) : null;
    let out = "", err = null, inIdx = 0;
    const trace = [];
    try {
      const gen = window.MiniPy.run(code, {
        builtins: w ? builtinsFor(w) : {},
        print: (t) => (out += t),
        input: () => (inputs && inIdx < inputs.length ? inputs[inIdx++] : ""),
        maxSteps: 50000,
      });
      for (const ev of gen) if (ev.type === "assign") trace.push([ev.name, ev.value]);
    } catch (e) { err = e; }
    return { world: w, out, err, trace };
  }

  /* Prüfen einer Welt nach dem Lauf. goal:
     {pos:[r,c], dir:"rechts", pows:[[r,c],…] (genaue Menge) oder powCount, put, removed, output:"…", fn(world,out)->Text|null} */
  function checkGoal(goal, res) {
    if (res.err) return res.err.kind + ": " + res.err.message;
    if (!goal) return null;
    const w = res.world;
    if (goal.pos && (w.pos[0] !== goal.pos[0] || w.pos[1] !== goal.pos[1])) return `Die Argo steht in Zeile ${w.pos[0]}, Spalte ${w.pos[1]}, erwartet: Zeile ${goal.pos[0]}, Spalte ${goal.pos[1]}.`;
    if (goal.dir && w.dirName !== goal.dir) return `Die Argo blickt nach ${w.dirName}, erwartet: ${goal.dir}.`;
    if (goal.pows) {
      const want = new Set(goal.pows.map((p) => p.join(",")));
      const same = want.size === w.pow.size && [...want].every((k) => w.pow.has(k));
      if (!same) return "Die PowerUps liegen noch nicht richtig.";
    }
    if (goal.powCount !== undefined && w.pow.size !== goal.powCount) return `Es liegen ${w.pow.size} PowerUps in der Welt, erwartet: ${goal.powCount}.`;
    if (goal.put !== undefined && w.put !== goal.put) return `Die Argo hat ${w.put} PowerUps abgelegt, erwartet: ${goal.put}.`;
    if (goal.removed !== undefined && w.removed !== goal.removed) return `Die Argo hat ${w.removed} PowerUps eingesammelt, erwartet: ${goal.removed}.`;
    if (goal.output !== undefined && res.out.trim() !== String(goal.output).trim()) return `Ausgabe „${res.out.trim().replace(/\n/g, ", ")}“, erwartet: „${String(goal.output).trim().replace(/\n/g, ", ")}“.`;
    if (goal.fn) { const m = goal.fn(w, res.out); if (m) return m; }
    return null;
  }

  // ---------------- Darstellung ----------------
  const CELL = 34, M = 16;
  function drawWorld(svg, w, opts) {
    opts = opts || {};
    const W = w.cols * CELL, H = w.rows * CELL;
    svg.setAttribute("viewBox", `0 0 ${W + M} ${H + M}`);
    svg.style.maxWidth = Math.round((W + M) * 1.25) + "px";
    let s = `<rect x="${M}" y="${M}" width="${W}" height="${H}" class="sb-bg"/>`;
    for (let c = 0; c < w.cols; c++) s += `<text x="${M + c * CELL + CELL / 2}" y="11" class="sb-num">${c}</text>`;
    for (let r = 0; r < w.rows; r++) s += `<text x="7" y="${M + r * CELL + CELL / 2 + 4}" class="sb-num">${r}</text>`;
    for (let c = 0; c <= w.cols; c++) s += `<line x1="${M + c * CELL}" y1="${M}" x2="${M + c * CELL}" y2="${M + H}" class="sb-grid"/>`;
    for (let r = 0; r <= w.rows; r++) s += `<line x1="${M}" y1="${M + r * CELL}" x2="${M + W}" y2="${M + r * CELL}" class="sb-grid"/>`;
    if (opts.trail && w.trail.length > 1) s += `<polyline class="sb-trail" points="${w.trail.map(([r, c]) => `${M + c * CELL + CELL / 2},${M + r * CELL + CELL / 2}`).join(" ")}"/>`;
    w.rock.forEach((k) => {
      const [r, c] = k.split(",").map(Number), x = M + c * CELL + CELL / 2, y = M + r * CELL + CELL / 2;
      s += `<circle cx="${x}" cy="${y}" r="13" class="sb-rock"/><circle cx="${x - 4}" cy="${y - 3}" r="3" class="sb-crater"/><circle cx="${x + 5}" cy="${y + 4}" r="2.2" class="sb-crater"/>`;
    });
    w.pow.forEach((k) => {
      const [r, c] = k.split(",").map(Number), x = M + c * CELL + CELL / 2, y = M + r * CELL + CELL / 2;
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 5 : 12; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
      s += `<polygon points="${pts.join(" ")}" class="sb-pow"/>`;
    });
    const [r, c] = w.pos, x = M + c * CELL + CELL / 2, y = M + r * CELL + CELL / 2;
    const rot = [0, -90, 180, 90][w.d];
    s += `<g transform="translate(${x} ${y}) rotate(${rot})" class="sb-argo${opts.crash ? " crash" : ""}"><path d="M13,0 L-9,-10 L-4,0 L-9,10 Z"/></g>`;
    svg.innerHTML = s;
  }

  // ---------------- Editor-Widget ----------------
  const instances = [];
  function create(el, cfg) {
    const idx = instances.length;
    const key = "sb:" + location.pathname + ":" + (cfg.id || idx);
    const hasWorld = cfg.worlds && cfg.worlds.length;
    let saved = null;
    try { saved = localStorage.getItem(key); } catch (e) {}
    el.classList.add("sb");
    el.innerHTML = `
      ${hasWorld && cfg.worlds.length > 1 ? `<div class="sb-tabs" role="tablist">${cfg.worlds.map((w, i) => `<button data-w="${i}" role="tab">${w.name || "Welt " + (i + 1)}</button>`).join("")}</div>` : ""}
      <div class="sb-main${hasWorld ? "" : " noworld"}">
        <div class="sb-editor"><div class="sb-gutter" aria-hidden="true"></div><div class="sb-hl" aria-hidden="true"></div>
          <textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Python-Programm"></textarea></div>
        ${hasWorld ? `<div class="sb-world"><svg class="sb-svg" role="img" aria-label="SpaceBug-Welt"></svg><div class="sb-info"></div></div>` : ""}
      </div>
      <div class="sb-controls">
        <button class="primary sb-run">▶ Ausführen</button>
        <button class="sb-step">Schritt</button>
        <button class="sb-stop">■ Zurücksetzen</button>
        <label class="sb-speed">Tempo <input type="range" min="0" max="4" value="2"></label>
        ${hasWorld && cfg.worlds.length > 1 ? `<button class="sb-all">Alle Welten prüfen</button>` : ""}
        ${cfg.nsd !== false ? `<button class="sb-nsdbtn">Struktogramm</button>` : ""}
        <button class="sb-restore" title="Ursprünglichen Code wiederherstellen">↺ Code</button>
      </div>
      <div class="sb-status" aria-live="polite"></div>
      <div class="sb-panels">
        <div class="sb-panel"><div class="sb-ph">Ausgabe</div><pre class="sb-out"></pre></div>
        <div class="sb-panel"><div class="sb-ph">Variablen</div><div class="sb-vars"></div></div>
      </div>
      ${cfg.trace ? `<div class="sb-panel sb-tracep"><div class="sb-ph">Tracetabelle (jede Zuweisung = neue Zeile)</div><div class="sb-trace tbl-scroll"></div></div>` : ""}
      <div class="sb-nsd" hidden></div>`;

    const ta = el.querySelector("textarea"), gutter = el.querySelector(".sb-gutter"), hl = el.querySelector(".sb-hl");
    const svg = el.querySelector(".sb-svg"), info = el.querySelector(".sb-info"), status = el.querySelector(".sb-status");
    const outEl = el.querySelector(".sb-out"), varsEl = el.querySelector(".sb-vars"), traceEl = el.querySelector(".sb-trace"), nsdEl = el.querySelector(".sb-nsd");
    const speedEl = el.querySelector(".sb-speed input");
    ta.value = saved !== null ? saved : (cfg.code || "");
    let worldIdx = 0, world = null, gen = null, api = null, timer = null, curLine = 0, errLine = 0, trace = [], traceCols = [], finished = false, output = "", stepCount = 0;
    const LH = 21;

    function lines() { return ta.value.split("\n").length; }
    function renderGutter() {
      const n = Math.max(lines(), cfg.minLines || 8);
      ta.style.height = (n * LH + 16) + "px";
      let g = "";
      for (let i = 1; i <= n; i++) g += `<div class="${i === curLine ? "cur" : ""}${i === errLine ? " err" : ""}">${i}</div>`;
      gutter.innerHTML = g;
      hl.style.display = curLine || errLine ? "block" : "none";
      hl.classList.toggle("err", !!errLine);
      hl.style.top = (8 + ((errLine || curLine) - 1) * LH) + "px";
    }
    function resetWorld() {
      if (!hasWorld) return;
      world = new World(cfg.worlds[worldIdx].rows);
      drawWorld(svg, world);
      const w = cfg.worlds[worldIdx];
      info.innerHTML = w.text ? w.text : "";
      el.querySelectorAll(".sb-tabs button").forEach((b, i) => b.classList.toggle("on", i === worldIdx));
    }
    function renderVars() {
      if (!api) { varsEl.innerHTML = '<span class="small">–</span>'; return; }
      const rows = [];
      const fr = api.frames[api.frames.length - 1];
      const show = (map, label) => map.forEach((v, k) => { if (!(v && v.pyfunc)) rows.push(`<tr><td>${k}</td><td>${esc(api.repr(v, true))}</td><td class="small">${label}</td></tr>`); });
      if (api.frames.length > 1) show(fr.vars, fr.name);
      show(api.globals, api.frames.length > 1 ? "Hauptprogramm" : "");
      varsEl.innerHTML = rows.length ? `<table class="sb-vt"><tr><th>Name</th><th>Wert</th><th></th></tr>${rows.join("")}</table>` : '<span class="small">noch keine Variablen</span>';
    }
    function renderTrace() {
      if (!traceEl) return;
      if (!trace.length) { traceEl.innerHTML = '<span class="small">Noch keine Zuweisung.</span>'; return; }
      traceEl.innerHTML = `<table class="sb-tt"><tr><th>Schritt</th><th>Zeile</th>${traceCols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
        trace.map((r, i) => `<tr><td>${i + 1}</td><td>${r.line}</td>${traceCols.map((c) => `<td class="${c === r.changed ? "chg" : ""}">${r.vals[c] === undefined ? "–" : esc(r.vals[c])}</td>`).join("")}</tr>`).join("") + "</table>";
      traceEl.scrollTop = traceEl.scrollHeight;
    }
    function highlightNsd() {
      if (nsdEl.hidden) return;
      nsdEl.querySelectorAll(".active").forEach((x) => x.classList.remove("active"));
      if (curLine) nsdEl.querySelectorAll(`[data-line="${curLine}"]`).forEach((x) => x.classList.add("active"));
    }
    function setStatus(msg, kind) { status.className = "sb-status " + (kind || ""); status.textContent = msg; }
    function stop() { clearTimeout(timer); timer = null; el.querySelector(".sb-run").textContent = "▶ Ausführen"; }
    function reset() {
      stop(); gen = null; api = null; curLine = 0; errLine = 0; trace = []; traceCols = []; finished = false; output = ""; stepCount = 0;
      outEl.textContent = ""; resetWorld(); renderGutter(); renderVars(); renderTrace(); highlightNsd(); setStatus("");
    }
    function begin() {
      reset();
      const vals = {};
      try {
        gen = window.MiniPy.run(ta.value, {
          builtins: hasWorld ? builtinsFor(world) : {},
          print: (t) => { output += t; outEl.textContent = output; },
          input: (p) => window.prompt(p || "Eingabe:") ?? "",
        });
        // Vorlauf bis zum Start-Ereignis (prüft dabei die Syntax)
        const first = gen.next();
        api = first.value && first.value.api;
        gen._vals = vals;
        return true;
      } catch (e) { fail(e); return false; }
    }
    function fail(e) {
      stop(); gen = null;
      if (e instanceof PyError) {
        errLine = e.line || curLine; curLine = 0;
        setStatus(`Fehler${errLine ? " in Zeile " + errLine : ""}: ${e.kind}, ${e.message}`, "bad");
        if (hasWorld && (e.kind === "Kollision")) drawWorld(svg, world, { crash: true, trail: true });
      } else { setStatus("Interner Fehler: " + e.message, "bad"); console.error(e); }
      renderGutter(); renderVars();
    }
    // führt bis zum nächsten sichtbaren Ereignis aus; mode "line" = bis zur nächsten Zeile, "act" = bis zur nächsten Aktion
    function advance(mode) {
      if (!gen) return false;
      let guard = 0;
      try {
        while (true) {
          const r = gen.next();
          if (r.done) { done(); return false; }
          const ev = r.value;
          if (ev.type === "line") { curLine = ev.line; if (mode === "line") break; }
          else if (ev.type === "assign") {
            const k = ev.scope === "global" ? ev.name : `${ev.name} (${ev.scope})`;
            if (!traceCols.includes(k)) traceCols.push(k);
            gen._vals[k] = api.repr(ev.value, true);
            trace.push({ line: ev.line, vals: { ...gen._vals }, changed: k });
          }
          else if (ev.type === "act" || ev.type === "print") { if (mode === "act") break; }
          else if (ev.type === "end") { done(); return false; }
          if (++guard > 3000 && mode === "act") break; // Programme ohne Bewegung nicht einfrieren lassen
        }
      } catch (e) { fail(e); return false; }
      stepCount++;
      if (hasWorld) drawWorld(svg, world, { trail: true });
      renderGutter(); renderVars(); renderTrace(); highlightNsd();
      return true;
    }
    function done() {
      stop(); gen = null; curLine = 0; renderGutter(); renderVars(); renderTrace(); highlightNsd();
      if (hasWorld) drawWorld(svg, world, { trail: true });
      const goal = hasWorld ? cfg.worlds[worldIdx].goal : cfg.goal;
      if (goal) {
        const msg = checkGoal(goal, { world, out: output, err: null });
        setStatus(msg ? "Programm beendet. " + msg : "Programm beendet: Aufgabe in dieser Welt gelöst! ✓", msg ? "bad" : "ok");
      } else setStatus("Programm beendet.", "ok");
      finished = true;
    }
    const DELAYS = [700, 350, 160, 60, 0];
    function loop() {
      // Nach vielen Schritten (z. B. Endlosschleife) automatisch beschleunigen
      const burst = stepCount > 300 ? 60 : 1;
      let more = true;
      for (let i = 0; i < burst && more; i++) more = advance(hasWorld ? "act" : "line");
      if (stepCount > 300 && more) setStatus(`Programm läuft … (${stepCount} Schritte, schneller Vorlauf. Endlosschleife?)`);
      if (more) timer = setTimeout(loop, stepCount > 300 ? 0 : DELAYS[+speedEl.value]);
    }
    el.querySelector(".sb-run").addEventListener("click", (e) => {
      if (timer) { stop(); setStatus("Angehalten. Weiter mit „Ausführen“ oder „Schritt“."); return; }
      if (!gen || finished) { if (!begin()) return; }
      e.target.textContent = "❚❚ Anhalten";
      setStatus("Programm läuft …");
      loop();
    });
    el.querySelector(".sb-step").addEventListener("click", () => {
      stop();
      if (!gen || finished) { if (!begin()) return; setStatus("Schrittmodus: Die markierte Zeile wird als Nächstes ausgeführt."); }
      advance("line");
    });
    el.querySelector(".sb-stop").addEventListener("click", reset);
    el.querySelector(".sb-restore").addEventListener("click", () => {
      if (!confirm("Deinen Code durch den ursprünglichen Code ersetzen?")) return;
      ta.value = cfg.code || ""; save(); reset(); refreshNsd();
    });
    el.querySelectorAll(".sb-tabs button").forEach((b) => b.addEventListener("click", () => { worldIdx = +b.dataset.w; reset(); }));
    const allBtn = el.querySelector(".sb-all");
    if (allBtn) allBtn.addEventListener("click", () => {
      reset();
      const res = cfg.worlds.map((w, i) => [w, i]).filter(([w]) => !w.skipAll).map(([w, i]) => { const r = runSilent(ta.value, w.rows); return `${w.name || "Welt " + (i + 1)}: ${checkGoal(w.goal, r) || "✓ gelöst"}${r.out.trim() ? ` (Ausgabe: ${r.out.trim().replace(/\n/g, ", ")})` : ""}`; });
      const ok = res.every((t) => t.includes("✓"));
      status.className = "sb-status " + (ok ? "ok" : "bad");
      status.innerHTML = res.map(esc).join("<br>");
    });
    function refreshNsd() {
      if (nsdEl.hidden) return;
      try { nsdEl.innerHTML = `<div class="sb-ph">Struktogramm zum Programm</div>${window.MiniPy.structogram(ta.value) || '<span class="small">Kein Programm.</span>'}`; }
      catch (e) { nsdEl.innerHTML = `<div class="sb-ph">Struktogramm</div><span class="small">Das Programm enthält einen Fehler (Zeile ${e.line}): ${esc(e.message)}</span>`; }
      highlightNsd();
    }
    const nsdBtn = el.querySelector(".sb-nsdbtn");
    if (nsdBtn) nsdBtn.addEventListener("click", () => { nsdEl.hidden = !nsdEl.hidden; nsdBtn.classList.toggle("on", !nsdEl.hidden); refreshNsd(); });

    // Editor-Komfort
    function save() { try { localStorage.setItem(key, ta.value); } catch (e) {} }
    let nsdTimer = null;
    ta.addEventListener("input", () => {
      if (gen || errLine) { stop(); gen = null; curLine = 0; errLine = 0; setStatus(""); }
      renderGutter(); save();
      clearTimeout(nsdTimer); nsdTimer = setTimeout(refreshNsd, 400);
    });
    ta.addEventListener("keydown", (e) => {
      const s = ta.selectionStart, v = ta.value;
      if (e.key === "Tab") {
        e.preventDefault();
        const ls = v.lastIndexOf("\n", s - 1) + 1;
        if (e.shiftKey) { if (v.substr(ls, 4) === "    ") { ta.value = v.slice(0, ls) + v.slice(ls + 4); ta.selectionStart = ta.selectionEnd = Math.max(ls, s - 4); } }
        else { ta.setRangeText("    ", s, ta.selectionEnd, "end"); }
        ta.dispatchEvent(new Event("input"));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s);
        let ind = line.match(/^ */)[0];
        if (/:\s*(#.*)?$/.test(line)) ind += "    ";
        ta.setRangeText("\n" + ind, s, ta.selectionEnd, "end");
        ta.dispatchEvent(new Event("input"));
      }
    });
    reset();
    instances.push({ el, cfg });
    return { getCode: () => ta.value, setCode: (c) => { ta.value = c; save(); reset(); } };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Nur Welt anzeigen (ohne Editor), z. B. für Aufgaben auf Papier
  function show(svg, rows) { drawWorld(svg, new World(rows)); }

  window.SpaceBug = { World, create, runSilent, checkGoal, show, drawWorld };
})();
