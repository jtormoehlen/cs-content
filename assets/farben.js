/* RGB-Mischer für Klasse 9 (Farben, Druckerfarben, Hexadezimal)
   Farben.mixer(element, { rgb: [255, 128, 0], bits: true, hex: true, hexInput: false, game: false, cmy: false })
   bits      – 8-Bit-Folgen je Anteil und 24-Bit-Folge anzeigen
   hex       – Farbcode #RRGGBB anzeigen
   hexInput  – Farbcode eintippen und Regler danach stellen
   game      – Spiel „Triff die Zielfarbe“
   cmy       – Hinweis, welcher Anteil zu Weiß fehlt (Druckerfarben) */
(function () {
  "use strict";
  let uid = 0;
  const toBin = (n) => n.toString(2).padStart(8, "0");
  const hx = (n) => n.toString(16).toUpperCase().padStart(2, "0");
  const NAMES = ["Rot", "Grün", "Blau"], COLS = ["#e0262a", "#1f9d3a", "#2457d6"];

  function mixer(el, opts) {
    const o = Object.assign({ rgb: [255, 128, 0], bits: true, hex: true, hexInput: false, game: false, cmy: false }, opts || {});
    const id = "mx" + (++uid);
    el.classList.add("mixer");
    el.innerHTML =
      (o.game
        ? `<div class="mx-sw"><div><div class="swatch" id="${id}sw"></div><p class="small">deine Farbe</p></div><div id="${id}goalBox" hidden><div class="swatch" id="${id}goal"></div><p class="small">Zielfarbe</p></div></div>`
        : `<div class="mx-sw"><div class="swatch" id="${id}sw"></div></div>`) +
      NAMES.map((n, i) =>
        `<div class="slider"><label for="${id}s${i}" style="font-weight:700">${n}</label>` +
        `<input type="range" id="${id}s${i}" min="0" max="255" value="${o.rgb[i]}" style="accent-color:${COLS[i]}">` +
        `<span class="mono" id="${id}v${i}"></span>${o.bits ? `<span class="bits" id="${id}b${i}"></span>` : "<span></span>"}</div>`
      ).join("") +
      (o.bits ? `<p class="small" style="margin:6px 0 2px">Gespeichert als Bitfolge (24 Bit = 3 Byte):</p><div class="out" id="${id}all"></div>` : "") +
      (o.hex ? `<p style="margin:8px 0 0">Farbcode: <span class="big mono" id="${id}hex"></span></p>` : "") +
      (o.hexInput ? `<div class="row"><label for="${id}in">Farbcode eingeben:</label><input id="${id}in" size="9" placeholder="#00FFFF" class="mono"><span class="fb" id="${id}infb"></span></div>` : "") +
      (o.cmy ? `<p class="small" id="${id}cmy" style="margin:6px 0 0"></p>` : "") +
      (o.game ? `<div class="row"><button type="button" id="${id}gb">Spiel: Triff die Zielfarbe</button><span class="fb" id="${id}gfb"></span></div>` : "");

    const $ = (s) => document.getElementById(id + s);
    const s = [0, 1, 2].map((i) => $("s" + i));
    let goal = null;

    function render() {
      const v = s.map((x) => +x.value);
      v.forEach((x, i) => {
        $("v" + i).textContent = x;
        if (o.bits) $("b" + i).textContent = toBin(x);
      });
      $("sw").style.background = `rgb(${v})`;
      if (o.bits) $("all").textContent = v.map(toBin).join(" ");
      if (o.hex) $("hex").textContent = "#" + v.map(hx).join("");
      if (o.cmy) {
        const fehlt = v.map((x, i) => (x === 0 ? NAMES[i] : null)).filter(Boolean);
        const voll = v.filter((x) => x === 255).length;
        $("cmy").textContent = fehlt.length === 1 && voll === 2
          ? `Weiß (255 | 255 | 255) ohne ${fehlt[0]}`
          : v.every((x) => x === 255) ? "Weiß: alle Anteile voll" : v.every((x) => x === 0) ? "Schwarz: kein Licht" : "";
      }
      if (goal) {
        const fb = $("gfb"), hit = goal.every((x, i) => x === v[i]);
        fb.className = "fb " + (hit ? "ok" : "");
        fb.textContent = hit ? `Getroffen! (${goal.join(" | ")})` : "Werte 0, 128 oder 255, probiere!";
      }
    }
    function set(rgb) { rgb.forEach((x, i) => (s[i].value = x)); render(); }
    s.forEach((x) => x.addEventListener("input", render));

    if (o.hexInput) {
      const inp = $("in"), fb = $("infb");
      const apply = () => {
        const t = inp.value.trim().replace(/^#/, "");
        if (/^[0-9a-f]{6}$/i.test(t)) {
          set([0, 2, 4].map((k) => parseInt(t.slice(k, k + 2), 16)));
          inp.classList.remove("bad"); fb.textContent = "";
        } else if (t) { inp.classList.add("bad"); fb.className = "fb bad"; fb.textContent = "6 Hex-Ziffern, z. B. #00FFFF"; }
      };
      inp.addEventListener("input", () => { if (inp.value.replace(/^#/, "").length >= 6) apply(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
    }
    if (o.game) {
      $("gb").addEventListener("click", () => {
        const vals = [0, 128, 255];
        do { goal = [0, 0, 0].map(() => vals[Math.floor(Math.random() * 3)]); } while (goal.every((x) => x === goal[0]) && Math.random() < 0.7);
        $("goalBox").hidden = false; $("goal").style.background = `rgb(${goal})`;
        render();
      });
    }
    render();
    return { set, get: () => s.map((x) => +x.value) };
  }

  window.Farben = { mixer, toBin, hx };
})();
