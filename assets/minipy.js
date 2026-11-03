/* MiniPy: kleiner Python-Interpreter für den Unterricht (Teilmenge von Python 3).
   Unterstützt: Zuweisungen (=, +=, -=, *=), if/elif/else, while, for … in range(…), def/return,
   global, pass, break, continue, and/or/not, Vergleiche, + - * / // % **, int/float/str/bool/None,
   print, input, int, float, str, round, abs, len, min, max, type.
   Die Ausführung ist ein Generator: Vor jeder Anweisung wird {type:"line"} geliefert, nach jeder
   Zuweisung {type:"assign"}; eingebaute Befehle (z. B. SpaceBug) können eigene Ereignisse liefern. */
(function () {
  "use strict";

  class PyError extends Error {
    constructor(kind, msg, line) { super(msg); this.kind = kind; this.line = line; }
  }
  class PyFloat { constructor(v) { this.v = v; } }
  const BREAK = { brk: 1 }, CONTINUE = { cont: 1 };
  class ReturnSignal { constructor(v) { this.value = v; } }

  // ---------------- Tokenizer ----------------
  const KEYWORDS = new Set(["def", "return", "if", "elif", "else", "while", "for", "in", "and", "or", "not", "True", "False", "None", "pass", "break", "continue", "global"]);
  function tokenize(src) {
    const lines = src.replace(/\t/g, "    ").split(/\r?\n/);
    const toks = [], indents = [0];
    let depth = 0; // Klammertiefe: Zeilenumbrüche in Klammern ignorieren
    for (let ln = 0; ln < lines.length; ln++) {
      const line = lines[ln], L = ln + 1;
      let i = 0;
      if (depth === 0) {
        const stripped = line.replace(/#.*$/, "");
        if (!stripped.trim()) continue;
        const ind = line.match(/^ */)[0].length;
        if (ind > indents[indents.length - 1]) { indents.push(ind); toks.push({ t: "INDENT", line: L }); }
        else {
          while (ind < indents[indents.length - 1]) { indents.pop(); toks.push({ t: "DEDENT", line: L }); }
          if (ind !== indents[indents.length - 1]) throw new PyError("IndentationError", "Die Einrückung passt zu keiner vorherigen Ebene.", L);
        }
        i = ind;
      }
      while (i < line.length) {
        const c = line[i];
        if (c === " ") { i++; continue; }
        if (c === "#") break;
        if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1]))) {
          const m = line.slice(i).match(/^\d*\.?\d+(?:[eE][+-]?\d+)?|^\d+\./)[0];
          toks.push({ t: "NUM", v: m.includes(".") || /e/i.test(m) ? new PyFloat(parseFloat(m)) : parseInt(m, 10), line: L });
          i += m.length; continue;
        }
        if (/[A-Za-z_äöüÄÖÜß]/.test(c)) {
          const m = line.slice(i).match(/^[A-Za-z_äöüÄÖÜß][A-Za-z0-9_äöüÄÖÜß]*/)[0];
          toks.push({ t: KEYWORDS.has(m) ? m : "NAME", v: m, line: L });
          i += m.length; continue;
        }
        if (c === '"' || c === "'") {
          let j = i + 1, s = "";
          while (j < line.length && line[j] !== c) {
            if (line[j] === "\\" && j + 1 < line.length) { const n = line[j + 1]; s += n === "n" ? "\n" : n === "t" ? "\t" : n; j += 2; }
            else s += line[j++];
          }
          if (j >= line.length) throw new PyError("SyntaxError", "Die Zeichenkette wird nicht geschlossen (Anführungszeichen fehlt).", L);
          toks.push({ t: "STR", v: s, line: L }); i = j + 1; continue;
        }
        const two = line.substr(i, 2);
        if (["==", "!=", "<=", ">=", "//", "**", "+=", "-=", "*=", "/="].includes(two)) { toks.push({ t: two, line: L }); i += 2; continue; }
        if ("+-*/%<>=(),:".includes(c)) {
          if (c === "(") depth++;
          if (c === ")") depth = Math.max(0, depth - 1);
          toks.push({ t: c, line: L }); i++; continue;
        }
        if (c === ";") throw new PyError("SyntaxError", "Bitte jede Anweisung in eine eigene Zeile schreiben (ohne Semikolon).", L);
        throw new PyError("SyntaxError", `Unerwartetes Zeichen „${c}“.`, L);
      }
      if (depth === 0) toks.push({ t: "NEWLINE", line: L });
    }
    const last = lines.length;
    while (indents.length > 1) { indents.pop(); toks.push({ t: "DEDENT", line: last }); }
    toks.push({ t: "EOF", line: last });
    return toks;
  }

  // ---------------- Parser ----------------
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const at = (t) => toks[p].t === t;
    function expect(t, msg) {
      if (!at(t)) {
        const tk = peek();
        throw new PyError("SyntaxError", msg || `Erwartet wurde „${t}“.`, tk.line);
      }
      return next();
    }
    function block(header) {
      expect(":", `Am Ende der Zeile mit „${header}“ fehlt der Doppelpunkt.`);
      expect("NEWLINE", "Nach dem Doppelpunkt muss eine neue Zeile beginnen.");
      if (!at("INDENT")) throw new PyError("IndentationError", `Nach „${header}:“ muss der Block eingerückt sein.`, peek().line);
      next();
      const body = [];
      while (!at("DEDENT") && !at("EOF")) body.push(statement());
      if (at("DEDENT")) next();
      return body;
    }
    function statement() {
      const tk = peek(), line = tk.line;
      switch (tk.t) {
        case "def": {
          next();
          const name = expect("NAME", "Nach def muss ein Name stehen.").v;
          expect("(", "Nach dem Namen der Operation fehlen die Klammern ().");
          const params = [];
          while (!at(")")) { params.push(expect("NAME", "Parameter müssen Namen sein.").v); if (at(",")) next(); else break; }
          expect(")", "Die schließende Klammer fehlt.");
          const body = block("def " + name + "()");
          return { k: "def", name, params, body, line };
        }
        case "if": {
          next();
          const test = expr();
          const body = block("if");
          let orelse = [];
          if (at("elif")) { const l2 = peek().line; toks[p] = { ...toks[p], t: "if" }; orelse = [statement()]; orelse[0].line = l2; orelse[0].elif = true; }
          else if (at("else")) { next(); orelse = block("else"); }
          return { k: "if", test, body, orelse, line };
        }
        case "while": {
          next();
          const test = expr();
          return { k: "while", test, body: block("while"), line };
        }
        case "for": {
          next();
          const v = expect("NAME", "Nach for muss ein Variablenname stehen.").v;
          expect("in", "In der for-Wiederholung fehlt „in“.");
          const it = expr();
          if (!(it.k === "call" && it.f.k === "name" && it.f.id === "range")) throw new PyError("SyntaxError", "Hier wird nur „for … in range(…)“ unterstützt.", line);
          return { k: "for", v, args: it.args, body: block("for"), line };
        }
        case "else": case "elif":
          throw new PyError("SyntaxError", `„${tk.t}“ ohne passendes if (oder falsch eingerückt).`, line);
        case "INDENT":
          throw new PyError("IndentationError", "Unerwartete Einrückung.", line);
      }
      const s = simple();
      if (!at("NEWLINE") && !at("EOF")) throw new PyError("SyntaxError", "Unerwarteter Text am Zeilenende.", peek().line);
      if (at("NEWLINE")) next();
      return s;
    }
    function simple() {
      const tk = peek(), line = tk.line;
      if (tk.t === "pass") { next(); return { k: "pass", line }; }
      if (tk.t === "break") { next(); return { k: "break", line }; }
      if (tk.t === "continue") { next(); return { k: "continue", line }; }
      if (tk.t === "return") { next(); const v = at("NEWLINE") || at("EOF") ? null : expr(); return { k: "return", v, line }; }
      if (tk.t === "global") {
        next(); const names = [expect("NAME").v];
        while (at(",")) { next(); names.push(expect("NAME").v); }
        return { k: "global", names, line };
      }
      if (tk.t === "NAME" && ["=", "+=", "-=", "*=", "/="].includes(toks[p + 1].t)) {
        const name = next().v, op = next().t;
        return { k: "assign", name, op, v: expr(), line };
      }
      const e = expr();
      if (at("=")) throw new PyError("SyntaxError", "Links vom = muss ein Variablenname stehen.", line);
      return { k: "expr", e, line };
    }
    // Ausdrücke
    function expr() { return orExpr(); }
    function orExpr() { let l = andExpr(); while (at("or")) { next(); l = { k: "bool", op: "or", l, r: andExpr() }; } return l; }
    function andExpr() { let l = notExpr(); while (at("and")) { next(); l = { k: "bool", op: "and", l, r: notExpr() }; } return l; }
    function notExpr() { if (at("not")) { next(); return { k: "not", e: notExpr() }; } return cmp(); }
    function cmp() {
      let l = add();
      const ops = ["==", "!=", "<", "<=", ">", ">="];
      if (at("=")) throw new PyError("SyntaxError", "Für einen Vergleich braucht man == (zwei Gleichheitszeichen).", peek().line);
      if (ops.includes(peek().t)) {
        const parts = [l], os = [];
        while (ops.includes(peek().t)) { os.push(next().t); parts.push(add()); }
        return { k: "cmp", parts, ops: os };
      }
      return l;
    }
    function add() { let l = mul(); while (at("+") || at("-")) { const op = next().t; l = { k: "bin", op, l, r: mul() }; } return l; }
    function mul() { let l = unary(); while (at("*") || at("/") || at("//") || at("%")) { const op = next().t; l = { k: "bin", op, l, r: unary() }; } return l; }
    function unary() { if (at("-")) { next(); return { k: "neg", e: unary() }; } if (at("+")) { next(); return unary(); } return power(); }
    function power() { const b = call(); if (at("**")) { next(); return { k: "bin", op: "**", l: b, r: unary() }; } return b; }
    function call() {
      let e = atom();
      while (at("(")) {
        next();
        const args = [];
        while (!at(")")) {
          if (at("NAME") && toks[p + 1].t === "=") { const kw = next().v; next(); args.push({ kw, v: expr() }); }
          else args.push(expr());
          if (at(",")) next(); else break;
        }
        expect(")", "Die schließende Klammer fehlt.");
        e = { k: "call", f: e, args };
      }
      return e;
    }
    function atom() {
      const tk = next();
      switch (tk.t) {
        case "NUM": return { k: "const", v: tk.v };
        case "STR": return { k: "const", v: tk.v };
        case "True": return { k: "const", v: true };
        case "False": return { k: "const", v: false };
        case "None": return { k: "const", v: null };
        case "NAME": return { k: "name", id: tk.v, line: tk.line };
        case "(": { const e = expr(); expect(")", "Die schließende Klammer fehlt."); return e; }
        case "NEWLINE": case "EOF": throw new PyError("SyntaxError", "Die Zeile ist unvollständig.", tk.line);
        default: throw new PyError("SyntaxError", `Unerwartetes „${tk.v || tk.t}“.`, tk.line);
      }
    }
    const body = [];
    while (!at("EOF")) {
      if (at("NEWLINE")) { next(); continue; }
      if (at("INDENT")) throw new PyError("IndentationError", "Unerwartete Einrückung.", peek().line);
      body.push(statement());
    }
    return body;
  }

  // ---------------- Werte ----------------
  const isNum = (v) => typeof v === "number" || v instanceof PyFloat;
  const num = (v) => (v instanceof PyFloat ? v.v : typeof v === "boolean" ? +v : v);
  function typeName(v) {
    if (v === null || v === undefined) return "NoneType";
    if (typeof v === "boolean") return "bool";
    if (typeof v === "number") return "int";
    if (v instanceof PyFloat) return "float";
    if (typeof v === "string") return "str";
    if (v && v.pyfunc) return "function";
    if (v && v.pytype) return "type";
    return "object";
  }
  function repr(v, inner) {
    if (v === null || v === undefined) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (v instanceof PyFloat) {
      if (!isFinite(v.v)) return v.v > 0 ? "inf" : "-inf";
      return Number.isInteger(v.v) && Math.abs(v.v) < 1e16 ? v.v.toFixed(1) : String(v.v);
    }
    if (typeof v === "string") return inner ? "'" + v + "'" : v;
    if (v && v.pyfunc) return `<function ${v.name}>`;
    if (v && v.pytype) return `<class '${v.pytype}'>`;
    return String(v);
  }
  const truthy = (v) => !(v === null || v === false || v === 0 || v === "" || (v instanceof PyFloat && v.v === 0));
  function mkNum(x, float) { return float ? new PyFloat(x) : x; }

  function binop(op, a, b, line) {
    const fl = a instanceof PyFloat || b instanceof PyFloat;
    if (op === "+" && typeof a === "string" && typeof b === "string") return a + b;
    if (op === "*" && typeof a === "string" && typeof b === "number") return a.repeat(Math.max(0, b));
    if (op === "*" && typeof b === "string" && typeof a === "number") return b.repeat(Math.max(0, a));
    const okA = isNum(a) || typeof a === "boolean", okB = isNum(b) || typeof b === "boolean";
    if (!okA || !okB) {
      if (op === "+" && typeof a === "string") throw new PyError("TypeError", `can only concatenate str (not "${typeName(b)}") to str: Text und Zahl lassen sich nicht mit + verbinden. Tipp: str(…)`, line);
      throw new PyError("TypeError", `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'` + (a === null || b === null ? ", ein Wert ist None. Fehlt ein return?" : ""), line);
    }
    const x = num(a), y = num(b);
    switch (op) {
      case "+": return mkNum(x + y, fl);
      case "-": return mkNum(x - y, fl);
      case "*": return mkNum(x * y, fl);
      case "/": if (y === 0) throw new PyError("ZeroDivisionError", "division by zero, durch 0 kann man nicht teilen.", line); return new PyFloat(x / y);
      case "//": if (y === 0) throw new PyError("ZeroDivisionError", "integer division by zero, durch 0 kann man nicht teilen.", line); return mkNum(Math.floor(x / y), fl);
      case "%": if (y === 0) throw new PyError("ZeroDivisionError", "modulo by zero", line); return mkNum(((x % y) + y) % y, fl);
      case "**": return mkNum(Math.pow(x, y), fl || y < 0);
    }
  }
  function compare(op, a, b, line) {
    if (op === "==") return eq(a, b);
    if (op === "!=") return !eq(a, b);
    const bothNum = (isNum(a) || typeof a === "boolean") && (isNum(b) || typeof b === "boolean");
    const bothStr = typeof a === "string" && typeof b === "string";
    if (!bothNum && !bothStr) throw new PyError("TypeError", `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`, line);
    const x = bothNum ? num(a) : a, y = bothNum ? num(b) : b;
    return op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : x >= y;
  }
  function eq(a, b) {
    if ((isNum(a) || typeof a === "boolean") && (isNum(b) || typeof b === "boolean")) return num(a) === num(b);
    return a === b;
  }

  // Namen, denen in einer Funktion etwas zugewiesen wird (= lokale Variablen)
  function localNames(body, params) {
    const loc = new Set(params), glob = new Set();
    (function walk(list) {
      list.forEach((s) => {
        if (s.k === "assign") loc.add(s.name);
        else if (s.k === "for") { loc.add(s.v); walk(s.body); }
        else if (s.k === "global") s.names.forEach((n) => glob.add(n));
        else if (s.k === "if") { walk(s.body); walk(s.orelse); }
        else if (s.k === "while") walk(s.body);
        else if (s.k === "def") loc.add(s.name);
      });
    })(body);
    glob.forEach((n) => loc.delete(n));
    return loc;
  }

  // ---------------- Interpreter ----------------
  /* opts: { builtins: {name: fn(args)}  (fn darf ein Generator sein),
             input: (prompt) => string, print: (text) => void, maxSteps } */
  function* run(src, opts) {
    opts = opts || {};
    const tree = parse(src);
    const globals = new Map();
    const frames = [{ name: "<Hauptprogramm>", vars: globals, locals: null }];
    let steps = 0;
    const maxSteps = opts.maxSteps || 20000;

    const BUILTINS = {
      print: function* (args, kw, line) { const sep = kw.sep !== undefined ? repr(kw.sep) : " "; const end = kw.end !== undefined ? repr(kw.end) : "\n"; opts.print && opts.print(args.map((a) => repr(a)).join(sep) + end); yield { type: "print", line }; return null; },
      input: function* (args) { const s = opts.input ? opts.input(args.length ? repr(args[0]) : "") : ""; return s === null || s === undefined ? "" : String(s); },
      int: function* (args, kw, line) {
        const v = args[0];
        if (v instanceof PyFloat) return Math.trunc(v.v);
        if (typeof v === "string") { if (!/^\s*[+-]?\d+\s*$/.test(v)) throw new PyError("ValueError", `invalid literal for int(): '${v}', das ist keine ganze Zahl.`, line); return parseInt(v, 10); }
        if (typeof v === "boolean") return +v;
        if (typeof v === "number") return v;
        throw new PyError("TypeError", `int() kann '${typeName(v)}' nicht umwandeln`, line);
      },
      float: function* (args, kw, line) {
        const v = args[0];
        if (typeof v === "string") { const t = v.trim().replace(/^\+/, ""); if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) throw new PyError("ValueError", `could not convert string to float: '${v}'. Tipp: Dezimalpunkt statt Komma verwenden.`, line); return new PyFloat(parseFloat(t)); }
        if (isNum(v) || typeof v === "boolean") return new PyFloat(num(v));
        throw new PyError("TypeError", `float() kann '${typeName(v)}' nicht umwandeln`, line);
      },
      str: function* (args) { return repr(args[0]); },
      bool: function* (args) { return truthy(args[0]); },
      round: function* (args) {
        const x = num(args[0]);
        if (args.length > 1) { const f = Math.pow(10, num(args[1])); return new PyFloat(Math.round(x * f) / f); }
        const r = Math.round(x); return Math.abs(x % 1) === 0.5 ? (r % 2 === 0 ? r : r - 1) : r;
      },
      abs: function* (args) { const v = args[0]; return v instanceof PyFloat ? new PyFloat(Math.abs(v.v)) : Math.abs(v); },
      len: function* (args, kw, line) { if (typeof args[0] !== "string") throw new PyError("TypeError", `object of type '${typeName(args[0])}' has no len()`, line); return args[0].length; },
      min: function* (args) { return args.reduce((a, b) => (compare("<", b, a) ? b : a)); },
      max: function* (args) { return args.reduce((a, b) => (compare(">", b, a) ? b : a)); },
      type: function* (args) { return { pytype: typeName(args[0]) }; },
    };
    const userBuiltins = opts.builtins || {};

    function frame() { return frames[frames.length - 1]; }
    function lookup(name, line) {
      const f = frame();
      if (f.locals && f.locals.has(name)) {
        if (!f.vars.has(name)) throw new PyError("UnboundLocalError", `Die lokale Variable „${name}“ wird benutzt, bevor sie einen Wert hat. (Soll die Variable des Hauptprogramms gemeint sein, fehlt „global ${name}“.)`, line);
        return f.vars.get(name);
      }
      if (globals.has(name)) return globals.get(name);
      if (name in userBuiltins) return { pyfunc: true, builtin: userBuiltins[name], name };
      if (name in BUILTINS) return { pyfunc: true, builtin: BUILTINS[name], name };
      if (name === "range") throw new PyError("SyntaxError", "range(…) kann hier nur in einer for-Wiederholung verwendet werden.", line);
      throw new PyError("NameError", `name '${name}' is not defined, „${name}“ ist unbekannt. Tippfehler? Wurde die Variable oder Operation schon festgelegt?`, line);
    }
    function* assign(name, value, line) {
      const f = frame();
      const target = f.locals && f.locals.has(name) ? f.vars : globals;
      target.set(name, value);
      yield { type: "assign", name, value, line, scope: target === globals ? "global" : f.name };
    }

    function* evalE(e) {
      switch (e.k) {
        case "const": return e.v;
        case "name": return lookup(e.id, e.line);
        case "neg": { const v = yield* evalE(e.e); if (!isNum(v) && typeof v !== "boolean") throw new PyError("TypeError", `bad operand type for unary -: '${typeName(v)}'`); return v instanceof PyFloat ? new PyFloat(-v.v) : -num(v); }
        case "not": return !truthy(yield* evalE(e.e));
        case "bool": {
          const l = yield* evalE(e.l);
          if (e.op === "and") return truthy(l) ? yield* evalE(e.r) : l;
          return truthy(l) ? l : yield* evalE(e.r);
        }
        case "bin": { const a = yield* evalE(e.l), b = yield* evalE(e.r); return binop(e.op, a, b, curLine); }
        case "cmp": {
          let a = yield* evalE(e.parts[0]);
          for (let i = 0; i < e.ops.length; i++) {
            const b = yield* evalE(e.parts[i + 1]);
            if (!compare(e.ops[i], a, b, curLine)) return false;
            a = b;
          }
          return true;
        }
        case "call": {
          const f = yield* evalE(e.f);
          const args = [], kw = {};
          for (const a of e.args) { if (a && a.kw) kw[a.kw] = yield* evalE(a.v); else args.push(yield* evalE(a)); }
          if (!f || !f.pyfunc) throw new PyError("TypeError", `'${typeName(f)}' object is not callable, „${repr(f)}“ ist keine Operation.`, curLine);
          if (f.builtin) {
            const r = f.builtin(args, kw, curLine);
            if (r && typeof r.next === "function") return yield* r;
            return r === undefined ? null : r;
          }
          return yield* callUser(f, args);
        }
      }
      throw new PyError("SyntaxError", "Unbekannter Ausdruck.", curLine);
    }
    function* callUser(f, args) {
      if (args.length !== f.params.length) throw new PyError("TypeError", `${f.name}() erwartet ${f.params.length} Argument(e), bekommen hat sie ${args.length}.`, curLine);
      if (frames.length > 200) throw new PyError("RecursionError", "Zu viele verschachtelte Aufrufe (ruft sich eine Operation endlos selbst auf?).", curLine);
      const fr = { name: f.name + "()", vars: new Map(), locals: f.locals };
      f.params.forEach((pn, i) => fr.vars.set(pn, args[i]));
      frames.push(fr);
      yield { type: "call", name: f.name };
      try {
        yield* execBlock(f.body);
      } catch (sig) {
        if (sig instanceof ReturnSignal) { frames.pop(); yield { type: "return", name: f.name, value: sig.value }; return sig.value; }
        throw sig;
      }
      frames.pop();
      yield { type: "return", name: f.name, value: null };
      return null;
    }

    let curLine = 0;
    function* execBlock(list) { for (const s of list) yield* exec(s); }
    function* exec(s) {
      curLine = s.line;
      if (++steps > maxSteps) throw new PyError("Endlosschleife", `Abbruch nach ${maxSteps} Schritten, vermutlich eine Endlosschleife.`, s.line);
      if (s.k !== "def" || true) yield { type: "line", line: s.line };
      switch (s.k) {
        case "expr": yield* evalE(s.e); return;
        case "assign": {
          let v = yield* evalE(s.v);
          if (s.op !== "=") v = binop(s.op[0], lookup(s.name, s.line), v, s.line);
          yield* assign(s.name, v, s.line); return;
        }
        case "if": {
          if (truthy(yield* evalE(s.test))) yield* execBlock(s.body);
          else yield* execBlock(s.orelse);
          return;
        }
        case "while": {
          while (true) {
            curLine = s.line;
            if (!truthy(yield* evalE(s.test))) break;
            try { yield* execBlock(s.body); }
            catch (sig) { if (sig === BREAK) break; if (sig === CONTINUE) { yield { type: "line", line: s.line }; continue; } throw sig; }
            if (++steps > maxSteps) throw new PyError("Endlosschleife", `Abbruch nach ${maxSteps} Schritten, vermutlich eine Endlosschleife.`, s.line);
            yield { type: "line", line: s.line };
          }
          return;
        }
        case "for": {
          const a = [];
          for (const x of s.args) { const v = yield* evalE(x); if (typeof v !== "number") throw new PyError("TypeError", `range() braucht ganze Zahlen, nicht '${typeName(v)}'.`, s.line); a.push(v); }
          let [start, stop, stepv] = a.length === 1 ? [0, a[0], 1] : [a[0], a[1], a.length > 2 ? a[2] : 1];
          if (stepv === 0) throw new PyError("ValueError", "range() arg 3 must not be zero", s.line);
          let first = true;
          for (let i = start; stepv > 0 ? i < stop : i > stop; i += stepv) {
            if (!first) { curLine = s.line; yield { type: "line", line: s.line }; }
            first = false;
            yield* assign(s.v, i, s.line);
            try { yield* execBlock(s.body); }
            catch (sig) { if (sig === BREAK) break; if (sig === CONTINUE) continue; throw sig; }
          }
          return;
        }
        case "def": {
          const f = { pyfunc: true, name: s.name, params: s.params, body: s.body, locals: localNames(s.body, s.params) };
          const fr = frame();
          (fr.locals && fr.locals.has(s.name) ? fr.vars : globals).set(s.name, f);
          return;
        }
        case "return":
          if (frames.length === 1) throw new PyError("SyntaxError", "'return' outside function, return gehört in eine Operation (def).", s.line);
          throw new ReturnSignal(s.v ? yield* evalE(s.v) : null);
        case "pass": case "global": return;
        case "break": throw BREAK;
        case "continue": throw CONTINUE;
      }
    }

    const api = { globals, frames, repr };
    yield { type: "start", api };
    try {
      yield* execBlock(tree);
    } catch (sig) {
      if (sig === BREAK || sig === CONTINUE) throw new PyError("SyntaxError", "break/continue steht außerhalb einer Wiederholung.", curLine);
      if (sig instanceof ReturnSignal) throw new PyError("SyntaxError", "'return' outside function", curLine);
      if (sig instanceof PyError && !sig.line) sig.line = curLine;
      throw sig;
    }
    yield { type: "end" };
  }

  // ---------------- Struktogramm (Nassi-Shneiderman) ----------------
  const OPTXT = { and: "und", or: "oder" };
  function exprText(e, prec) {
    prec = prec || 0;
    switch (e.k) {
      case "const": return typeof e.v === "string" ? '"' + e.v + '"' : repr(e.v);
      case "name": return e.id;
      case "neg": return "-" + exprText(e.e, 9);
      case "not": { const t = "nicht " + exprText(e.e, 3); return prec > 3 ? "(" + t + ")" : t; }
      case "bool": { const p = e.op === "or" ? 1 : 2; const t = exprText(e.l, p) + " " + OPTXT[e.op] + " " + exprText(e.r, p + 1); return prec > p ? "(" + t + ")" : t; }
      case "cmp": { const sym = { "==": "=", "!=": "≠", "<=": "≤", ">=": "≥", "<": "<", ">": ">" }; let t = exprText(e.parts[0], 5); e.ops.forEach((o, i) => (t += " " + sym[o] + " " + exprText(e.parts[i + 1], 5))); return prec > 4 ? "(" + t + ")" : t; }
      case "bin": { const p = e.op === "+" || e.op === "-" ? 5 : e.op === "**" ? 8 : 6; const sym = { "*": "·", "/": ":", "//": "div", "%": "mod" }[e.op] || e.op; const t = exprText(e.l, p) + " " + sym + " " + exprText(e.r, p + 1); return prec > p ? "(" + t + ")" : t; }
      case "call": {
        const name = e.f.k === "name" ? e.f.id : "?";
        if (name === "input") return "Eingabe" + (e.args.length ? " (" + exprText(e.args[0]) + ")" : "");
        return name + "(" + e.args.map((a) => exprText(a.kw ? a.v : a)).join(", ") + ")";
      }
    }
    return "?";
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function nsdBlock(list) {
    if (!list.length) return `<div class="nsd-s nsd-empty">∅</div>`;
    return list.map(nsdStmt).join("");
  }
  function nsdStmt(s) {
    const L = ` data-line="${s.line}"`;
    switch (s.k) {
      case "expr": {
        const e = s.e;
        if (e.k === "call" && e.f.k === "name" && e.f.id === "print") return `<div class="nsd-s"${L}>Ausgabe: ${esc(e.args.map((a) => exprText(a.kw ? a.v : a)).join(", "))}</div>`;
        return `<div class="nsd-s"${L}>${esc(exprText(e))}</div>`;
      }
      case "assign": {
        const rhs = s.op === "=" ? exprText(s.v) : s.name + " " + s.op[0].replace("*", "·").replace("/", ":") + " " + exprText(s.v, 6);
        return `<div class="nsd-s"${L}>${esc(s.name)} ← ${esc(rhs)}</div>`;
      }
      case "return": return `<div class="nsd-s"${L}>gib ${s.v ? esc(exprText(s.v)) + " " : ""}zurück</div>`;
      case "pass": return `<div class="nsd-s nsd-empty"${L}>∅</div>`;
      case "break": return `<div class="nsd-s"${L}>Wiederholung verlassen</div>`;
      case "continue": return `<div class="nsd-s"${L}>nächster Durchlauf</div>`;
      case "global": return "";
      case "def": return `<div class="nsd-s"${L}>Operation ${esc(s.name)}() festlegen</div>`;
      case "while": return `<div class="nsd-loop"${L}><div class="nsd-head">solange ${esc(exprText(s.test))}</div><div class="nsd-body">${nsdBlock(s.body)}</div></div>`;
      case "for": {
        const a = s.args.map((x) => exprText(x));
        const head = a.length === 1 ? `wiederhole ${a[0]}-mal (${s.v} von 0 bis ${a[0]} − 1)` : `für ${s.v} von ${a[0]} bis ${a[1]} − 1${a[2] ? " (Schritt " + a[2] + ")" : ""}`;
        return `<div class="nsd-loop"${L}><div class="nsd-head">${esc(head)}</div><div class="nsd-body">${nsdBlock(s.body)}</div></div>`;
      }
      case "if": return `<div class="nsd-if"${L}><div class="nsd-cond"><svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="50" y2="10"/><line x1="100" y1="0" x2="50" y2="10"/></svg><span class="nsd-q">${esc(exprText(s.test))}</span><span class="nsd-t">wahr</span><span class="nsd-f">falsch</span></div><div class="nsd-branches"><div class="nsd-br">${nsdBlock(s.body)}</div><div class="nsd-br">${nsdBlock(s.orelse)}</div></div></div>`;
    }
    return "";
  }
  // Liefert HTML: ein Struktogramm je Operation und eines für das Hauptprogramm
  function structogram(src) {
    const tree = parse(src);
    const defs = tree.filter((s) => s.k === "def"), main = tree.filter((s) => s.k !== "def");
    let html = "";
    defs.forEach((d) => (html += `<div class="nsd"><div class="nsd-title">${esc(d.name)}(${esc(d.params.join(", "))})</div>${nsdBlock(d.body)}</div>`));
    if (main.length) html += `<div class="nsd">${defs.length ? '<div class="nsd-title">Hauptprogramm</div>' : ""}${nsdBlock(main)}</div>`;
    return html;
  }

  window.MiniPy = { run, parse, structogram, repr, PyError, PyFloat, typeName };
})();
