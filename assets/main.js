/* Gemeinsame Bausteine aller Lernseiten: Navigation, Formeln, Quiz, Eingabeprüfung */
(function () {
  "use strict";

  // Kapitel je Klasse (Ordner klasse9/, klasse10/, …)
  const SECTIONS = {
    k9: {
      name: "Klasse 9",
      chapters: [
        ["01-eva.html", "EVA-Prinzip"],
        ["02-daten-information.html", "Daten & Information"],
        ["03-dualzahlen.html", "Dualzahlen"],
        ["04-codes.html", "Codes"],
        ["05-ascii.html", "ASCII"],
        ["06-rgb.html", "Farben (RGB)"],
        ["07-druckerfarben.html", "Druckerfarben (CMYK)"],
        ["08-hexadezimal.html", "Hexadezimal"],
        ["09-bilder.html", "Bilder"],
        ["10-selbsttest.html", "Selbsttest"],
      ],
    },
    k10: {
      name: "Klasse 10",
      chapters: [
        ["01-aufbau-internet.html", "Aufbau des Internets"],
        ["02-ipv4.html", "IPv4"],
        ["03-webseite-abrufen.html", "Webseite abrufen"],
        ["04-routing.html", "Routing"],
        ["05-ipv6.html", "IPv6"],
        ["06-netzneutralitaet.html", "Netzneutralität"],
        ["07-cookies-datenschutz.html", "Cookies & Datenschutz"],
        ["08-phishing.html", "Phishing"],
        ["09-selbsttest.html", "Selbsttest"],
      ],
    },
    k11: {
      name: "Klasse 11",
      chapters: [
        ["01-algorithmus.html", "Algorithmus"],
        ["02-sequenz.html", "Sequenz"],
        ["03-wiederholung.html", "Wiederholung"],
        ["04-verzweigung.html", "Verzweigung"],
        ["05-verschachtelung.html", "Verschachtelung"],
        ["06-variablen.html", "Variablen"],
        ["07-tracetabellen.html", "Tracetabellen"],
        ["08-struktogramme.html", "Struktogramme"],
        ["09-operationen.html", "Operationen"],
        ["10-selbsttest.html", "Selbsttest"],
      ],
    },
  };

  const body = document.body;
  const root = body.dataset.root || ".";
  const here = location.pathname.split("/").pop() || "index.html";
  const section = SECTIONS[body.dataset.section];
  const CHAPTERS = section ? section.chapters : [];

  // ---------- Kopf- und Fußzeile ----------
  function buildHeader() {
    const h = document.createElement("header");
    h.className = "site";
    let nav = "";
    if (section) {
      nav = CHAPTERS.map(([href, label]) =>
        `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`
      ).join("");
      nav = `<a href="index.html"${here === "index.html" ? ' aria-current="page"' : ""}>Übersicht</a>` + nav;
    }
    h.innerHTML = `<div class="wrap"><a class="brand" href="${root}/index.html">Informatik${section ? " · " + section.name : ""}</a>` +
      (section ? `<nav aria-label="Kapitel ${section.name}">${nav}</nav>` : "") + `</div>`;
    body.prepend(h);

    const f = document.createElement("footer");
    f.className = "site";
    f.innerHTML = `<div class="wrap">Lernmaterial Informatik · Inhalte nach dem Unterricht von J. Tormöhlen</div>`;
    body.append(f);
  }

  function buildPager() {
    const i = CHAPTERS.findIndex(([href]) => href === here);
    if (i < 0) return;
    const main = document.querySelector("main .wrap") || document.querySelector("main");
    const p = document.createElement("div");
    p.className = "pager";
    const prev = i > 0 ? CHAPTERS[i - 1] : ["index.html", "Übersicht"];
    const next = CHAPTERS[i + 1];
    p.innerHTML = `<a href="${prev[0]}">← ${prev[1]}</a>` + (next ? `<a href="${next[0]}">${next[1]} →</a>` : "<span></span>");
    main.append(p);
  }

  // ---------- Einheitliche Gliederung: Wissen, Ausprobieren, Aufgaben ----------
  const TASK_HEAD = /^(Aufgabe|Übung|Teste dich|Zusatzaufgabe)/;
  const TRY_HEAD = /^(Interaktiv|Ausprobieren|Simulation)/;

  // Überschrift samt folgendem Inhalt (bis zur nächsten gleich- oder höherrangigen Überschrift) in einen Kasten legen
  function boxSection(h, cls, label) {
    const stop = h.tagName === "H2" ? ["H2"] : ["H2", "H3"];
    const box = document.createElement("div");
    box.className = "box " + cls;
    h.before(box);
    box.dataset.kind = label;
    box.append(h);
    h.classList.add("tlabel");
    let n = box.nextSibling;
    while (n && !(n.nodeType === 1 && (stop.includes(n.tagName) || n.classList.contains("pager")))) {
      const next = n.nextSibling;
      box.append(n);
      n = next;
    }
  }
  function structure() {
    const main = document.querySelector("main .wrap");
    if (!main || !section || here === "index.html") return;
    // Seiten mit <section class="teil theorie"> und <section class="teil aufgaben" id="aufgaben">
    // werden abschnittsweise gegliedert, sonst die Seite als Ganzes.
    const teile = [...main.querySelectorAll(":scope > section.teil")];
    const containers = teile.length ? teile : [main];
    containers.forEach((c) => {
      const isAufg = c.classList.contains("aufgaben");
      [...c.querySelectorAll(":scope > h2, :scope > h3")].forEach((h) => {
        if (isAufg && h.tagName === "H2") return; // Überschrift „Aufgaben“ selbst nicht einrahmen
        const t = h.textContent.trim();
        if (TASK_HEAD.test(t)) boxSection(h, "task", "Aufgabe");
        else if (TRY_HEAD.test(t)) boxSection(h, "try", "Ausprobieren");
      });
    });
    // Frei stehende Übungen ebenfalls in Aufgabenkästen
    main.querySelectorAll(".quiz, .cases, .check").forEach((el) => {
      if (el.closest(".task, .try, .sb")) return;
      const box = document.createElement("div");
      box.className = "box task";
      box.innerHTML = `<div class="kind">${el.classList.contains("quiz") ? "Teste dich" : "Übung"}</div>`;
      // einleitenden Absatz direkt davor mit in den Kasten nehmen
      const prev = el.previousElementSibling;
      el.before(box);
      const instr = /[:?]\s*$|^(Klicke|Ordne|Entscheide|Trage|Wähle|Fülle|Prüfe|Gib|Welche|Was |Wie |Kann|Bestimme|Verfolge)/;
      if (prev && prev.tagName === "P" && !prev.closest(".box") && instr.test(prev.textContent.trim())) box.append(prev);
      box.append(el);
    });
    // Vorhandene Aufgabenkästen ohne Kennzeichnung markieren
    main.querySelectorAll(".box.task").forEach((b) => {
      if (b.querySelector(":scope > .kind, :scope > .tlabel")) return;
      const lab = document.createElement("div");
      lab.className = "kind";
      lab.textContent = "Aufgabe";
      b.prepend(lab);
    });
    // Abschnitte nummerieren und Inhaltsverzeichnis erzeugen (Abschnitte mit ihren Aufgaben)
    const h1 = main.querySelector("h1");
    const chap = h1 && (h1.textContent.match(/^(\d+)\s*·/) || [])[1];
    let k = 0, n = 0;
    const items = [];
    containers.forEach((c) => {
      const isAufg = c.classList.contains("aufgaben");
      [...c.children].forEach((el) => {
        if (el.tagName === "H2") {
          if (isAufg) {
            el.id = el.id || "teil-" + el.textContent.trim().toLowerCase().replace(/[^a-zäöüß0-9]+/g, "-");
            const first = c.querySelector(":scope > h2") === el;
            items.push(`<li class="t-head"><a href="#${first && c.id ? c.id : el.id}">${el.textContent.trim()}</a></li>`);
            return;
          }
          el.id = el.id || "abschnitt-" + (k + 1);
          k++;
          if (chap) el.insertAdjacentHTML("afterbegin", `<span class="secno">${chap}.${k}</span> `);
          items.push(`<li><a href="#${el.id}">${el.textContent.trim()}</a></li>`);
        } else if (el.classList && el.classList.contains("box") && (el.classList.contains("task") || el.classList.contains("try"))) {
          const head = el.querySelector(":scope > .tlabel, :scope > .kind");
          let txt = head ? head.textContent.trim() : "Aufgabe";
          if (head && head.classList.contains("kind")) {
            const q = el.querySelector("p:not(.kind)");
            txt += q ? ": " + q.textContent.trim().replace(/\s+/g, " ").slice(0, 60) + (q.textContent.trim().length > 60 ? " …" : "") : "";
          }
          el.id = el.id || "aufgabe-" + (++n);
          items.push(`<li class="${el.classList.contains("try") ? "t-try" : "t-task"}"><a href="#${el.id}">${txt}</a></li>`);
        }
      });
    });
    if (items.length >= 3) {
      const toc = document.createElement("nav");
      toc.className = "toc";
      toc.setAttribute("aria-label", "Auf dieser Seite");
      toc.innerHTML = `<div class="kind">Auf dieser Seite</div><ul>${items.join("")}</ul>`;
      const anchor = main.querySelector(".box.ziel") || main.querySelector(".lead") || h1;
      anchor.after(toc);
    }
    // Sprungmarke zu Teil B direkt unter der Einleitung
    const aufg = main.querySelector(":scope > section.teil.aufgaben");
    const lead = main.querySelector(":scope > .lead");
    if (aufg && lead && teile[0] !== aufg) {
      aufg.id = aufg.id || "aufgaben";
      const cnt = aufg.querySelectorAll(":scope > .box.task").length;
      const p = document.createElement("p");
      p.className = "zur-aufg";
      p.innerHTML = `<a href="#${aufg.id}">↓ Direkt zu den Aufgaben${cnt ? ` (${cnt})` : ""}</a>`;
      lead.after(p);
    }
  }

  // ---------- Formeln (KaTeX) ----------
  function math(el) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(el || document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      ignoredClasses: ["nomath"],
      throwOnError: false,
    });
  }

  // ---------- Hilfsfunktionen ----------
  const toBin = (n, len) => n.toString(2).padStart(len || 0, "0");
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function normalize(value, mode) {
    let v = String(value).trim().toLowerCase().replace(/\s+/g, mode === "text" ? " " : "");
    if (mode === "bin") {
      v = v.replace(/[()]|_?2$/g, "");
      if (!/^[01]+$/.test(v)) return "#";
      return String(parseInt(v, 2));
    }
    if (mode === "num") v = v.replace(/\.(?=\d{3})/g, "").replace(",", ".");
    return v;
  }

  function checkInput(input) {
    const mode = input.dataset.norm || "plain";
    const answers = input.dataset.answer.split("|").map((a) => normalize(a, mode));
    const ok = input.value.trim() !== "" && answers.includes(normalize(input.value, mode));
    input.classList.toggle("ok", ok);
    input.classList.toggle("bad", !ok);
    return ok;
  }

  // Gruppen mit Eingabefeldern: <div class="check"> … <input data-answer> … <button data-check> <div class="fb">
  function initChecks(scope) {
    (scope || document).querySelectorAll(".check").forEach((group) => {
      const btn = group.querySelector("[data-check]");
      const fb = group.querySelector(".fb");
      const run = () => {
        const inputs = [...group.querySelectorAll("input[data-answer]")];
        const right = inputs.filter(checkInput).length;
        if (fb) {
          fb.className = "fb " + (right === inputs.length ? "ok" : "bad");
          fb.textContent = right === inputs.length
            ? (inputs.length > 1 ? "Alles richtig!" : "Richtig!")
            : `${right} von ${inputs.length} richtig, rot markierte Felder noch einmal prüfen.`;
        }
      };
      if (btn) btn.addEventListener("click", run);
      group.querySelectorAll("input[data-answer]").forEach((inp) =>
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); })
      );
    });
  }

  // Quiz: <div class="q" data-correct="0" data-explain="…"><p>Frage</p><div class="opts"><button>…</button></div><div class="fb"></div></div>
  function initQuiz(scope) {
    (scope || document).querySelectorAll(".quiz .q").forEach((q) => {
      const correct = Number(q.dataset.correct);
      const buttons = [...q.querySelectorAll(".opts button")];
      const fb = q.querySelector(".fb");
      buttons.forEach((b, i) =>
        b.addEventListener("click", () => {
          buttons.forEach((x) => x.classList.remove("right", "wrong"));
          if (i === correct) {
            b.classList.add("right");
            fb.className = "fb ok";
            fb.innerHTML = "Richtig! " + (q.dataset.explain || "");
          } else {
            b.classList.add("wrong");
            fb.className = "fb bad";
            fb.textContent = "Leider nicht, versuche es noch einmal.";
          }
          math(fb);
        })
      );
    });
  }

  // Fälle zuordnen: <div class="cases" data-options="V,K,A"> <div class="case" data-answer="V" data-why="…"><span class="txt">…</span></div> … <button data-check-cases> <div class="fb"></div></div>
  function initCases(scope) {
    (scope || document).querySelectorAll(".cases").forEach((box) => {
      const options = box.dataset.options.split(",");
      const cases = [...box.querySelectorAll(".case")];
      cases.forEach((c) => {
        const btns = document.createElement("span");
        btns.className = "btns";
        btns.innerHTML = options.map((o) => `<button type="button" data-o="${o}">${o}</button>`).join("");
        c.append(btns);
        if (c.dataset.why) {
          const why = document.createElement("span");
          why.className = "why";
          why.innerHTML = c.dataset.why;
          c.append(why);
        }
        btns.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
          btns.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
          c.classList.remove("ok", "bad");
        }));
      });
      const fb = box.querySelector(".fb");
      const check = box.querySelector("[data-check-cases]");
      if (check) check.addEventListener("click", () => {
        let right = 0;
        cases.forEach((c) => {
          const sel = c.querySelector("button.sel");
          const ok = !!sel && sel.dataset.o === c.dataset.answer;
          c.classList.toggle("ok", ok);
          c.classList.toggle("bad", !ok);
          if (ok) right++;
        });
        if (fb) {
          fb.className = "fb " + (right === cases.length ? "ok" : "bad");
          fb.textContent = right === cases.length ? "Alles richtig!" : `${right} von ${cases.length} richtig. Die Begründungen helfen dir weiter.`;
        }
      });
    });
  }

  window.Site = { math, toBin, rand, esc, checkInput, initChecks, initQuiz, initCases };

  structure();
  buildHeader();
  buildPager();
  initChecks();
  initQuiz();
  initCases();
  document.addEventListener("DOMContentLoaded", () => math());
})();
