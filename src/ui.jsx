import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Flame, Users, ChefHat, Check, Target } from "lucide-react";

let push = null;
export const toast = (m) => push && push(m);
export function Toaster() {
  const [t, setT] = useState([]);
  useEffect(() => {
    push = (m) => {
      const id = Math.random();
      setT((x) => [...x, { id, m }]);
      setTimeout(() => setT((x) => x.filter((y) => y.id !== id)), 2600);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="toasts">
      <AnimatePresence>
        {t.map((x) => (
          <motion.div key={x.id} className="toast" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
            <Check size={16} />{x.m}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } };
export const fmtDate = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
export const ytId = (u = "") => (u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
export const initial = (u) => (u?.displayName || u?.email || u || "?").toString().slice(0, 1).toUpperCase();

export function normNut(r) {
  const nn = unjson(r?.nutrition);
  if (Array.isArray(nn)) return nn.map(unjson).filter((n) => n && typeof n === "object");
  const o = r?.nutritionPerServing;
  if (!o) return [];
  return Object.entries(o).map(([name, amount]) => ({ name: name[0].toUpperCase() + name.slice(1), amount: String(amount) }));
}

export function Nutrition({ items }) {
  if (!items?.length) return null;
  return (
    <div className="nut">
      {items.map((n, i) => {
        const pct = parseFloat(n.pct), has = !isNaN(pct) && pct > 0;
        return (
          <motion.div key={i} className={"nut-tile" + (n.goal ? " goal" : "")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <span className="nut-name">{n.name}{n.goal && <Target size={12} />}</span>
            <b>{n.amount}</b>
            {has && <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: Math.min(100, pct) + "%" }} transition={{ duration: 0.9, delay: 0.2 + i * 0.04, ease: [0.22, 1, 0.36, 1] }} /></div>}
            {has && <small>{pct}% daily value</small>}
          </motion.div>
        );
      })}
    </div>
  );
}

export function Cover({ src, alt }) {
  const [ok, setOk] = useState(false), [err, setErr] = useState(false);
  return (
    <div className={"cover" + (ok ? " ok" : "")}>
      {!err && <img src={src} alt={alt} onLoad={() => setOk(true)} onError={() => setErr(true)} />}
      {!ok && <div className="skel fill">{err ? "Image unavailable" : ""}</div>}
    </div>
  );
}

export const toMin = (v) => {
  const t = String(v ?? "").toLowerCase();
  const h = (t.match(/(\d+(?:\.\d+)?)\s*h/) || [])[1], m = (t.match(/(\d+(?:\.\d+)?)\s*m/) || [])[1];
  if (h || m) return Math.round((+h || 0) * 60 + (+m || 0));
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
};
const unjson = (x) => {
  if (typeof x !== "string") return x;
  const t = x.trim();
  if ((t[0] === "{" && t.endsWith("}")) || (t[0] === "[" && t.endsWith("]"))) { try { return JSON.parse(t); } catch { /* keep as text */ } }
  return x;
};
export function normIng(list) {
  const out = [];
  list = unjson(list);
  const one = (x, g) => {
    x = unjson(x);
    if (Array.isArray(x)) return x.forEach((y) => one(y, g));
    if (x == null) return;
    if (typeof x === "string") return void out.push({ quantity: "", item: x, group: g });
    const nested = x.items || x.ingredients;
    if (Array.isArray(nested)) return nested.forEach((y) => one(y, x.group || x.name || x.title || g));
    let item = txt(x.item ?? x.name ?? x.ingredient ?? x.food ?? "").trim();
    const quantity = txt(x.quantity ?? x.amount ?? x.qty ?? x.measure ?? "").trim();
    if (!item && !quantity) item = Object.entries(x).filter(([k, v]) => typeof v === "string" && !["group", "note", "substitute"].includes(k)).map(([, v]) => v).join(" ");
    out.push({ ...x, quantity, item, group: x.group || g });
  };
  (Array.isArray(list) ? list : []).forEach((x) => one(x));
  return out;
}
export const normSteps = (r) => [].concat(unjson(r?.steps) || []).map((x) => {
  x = unjson(x);
  if (typeof x === "string") return { text: x };
  return { ...x, text: x.text ?? x.instruction ?? x.description ?? x.step ?? "", title: x.title ?? x.name ?? "", minutes: x.minutes ?? x.time ?? x.duration ?? "" };
});
// Model output is not always the shape the prompt asks for (a tip can come back as an object, equipment as a
// plain string, and so on). React cannot render an object, and one bad field blanks the whole page, so every
// value is turned into plain text or a list of plain text here, before anything renders.
export const txt = (v) => {
  v = unjson(v);
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const k = v.text ?? v.name ?? v.title ?? v.item ?? v.description ?? v.value;
    return k !== undefined ? txt(k) : Object.values(v).map(txt).filter(Boolean).join(" ");
  }
  return String(v);
};
const list = (v) => {
  v = unjson(v);
  if (v == null || v === "") return [];
  if (typeof v === "string") v = v.split(/\n|;/);
  else if (!Array.isArray(v)) v = typeof v === "object" ? Object.values(v) : [v];
  return v.map(txt).map((x) => x.trim()).filter(Boolean);
};
export const normRecipe = (r) => {
  r = r && typeof r === "object" ? r : {};
  return {
    ...r,
    title: txt(r.title), description: txt(r.description), cuisine: txt(r.cuisine),
    prepTime: txt(r.prepTime), cookTime: txt(r.cookTime), totalTime: txt(r.totalTime),
    servings: r.servings ? txt(r.servings) : "", difficulty: txt(r.difficulty),
    healthNote: txt(r.healthNote), storage: txt(r.storage),
    equipment: list(r.equipment), tips: list(r.tips), pairings: list(r.pairings), variations: list(r.variations),
    ingredients: normIng(r.ingredients).map((x) => ({ ...x, quantity: txt(x.quantity), item: txt(x.item), note: txt(x.note), substitute: txt(x.substitute), group: txt(x.group) })),
    steps: normSteps(r).map((x) => ({ ...x, title: txt(x.title), text: txt(x.text), tip: txt(x.tip), minutes: txt(x.minutes) })),
    nutrition: normNut(r).map((n) => ({ ...n, name: txt(n.name), amount: txt(n.amount) })),
  };
};
const grams = (nut, re) => { const x = nut.find((n) => re.test(n.name)); return x ? parseFloat(String(x.amount).replace(/[^\d.]/g, "")) || 0 : 0; };

function Spice({ level }) {
  const n = Math.max(0, Math.min(5, Math.round(+level || 0)));
  return <span className="spice" title={`Spice level ${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <Flame key={i} size={14} className={i <= n ? "on" : ""} />)}</span>;
}

function MacroDonut({ nut }) {
  const p = grams(nut, /protein/i), c = grams(nut, /carb/i), f = grams(nut, /^(total )?fats?\b/i);
  const parts = [["Protein", p, 4, "var(--r500)"], ["Carbs", c, 4, "var(--r300)"], ["Fat", f, 9, "#D8CDCF"]];
  const tot = parts.reduce((a, x) => a + x[1] * x[2], 0);
  if (!tot) return null;
  const kcal = grams(nut, /calor|energy/i) || Math.round(tot), R = 48, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="viz">
      <h4>Where the calories come from</h4>
      <div className="donut-row">
        <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Macronutrient split">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="16" style={{ stroke: "var(--r100)" }} />
          <g transform="rotate(-90 60 60)">
            {parts.map(([n, g, k, col], i) => {
              const len = ((g * k) / tot) * C, el = (
                <motion.circle key={n} cx="60" cy="60" r={R} fill="none" strokeWidth="16" strokeDashoffset={-off} style={{ stroke: col }}
                  initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${len} ${C - len}` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.2, ease: [0.22, 1, 0.36, 1] }} />
              );
              off += len; return el;
            })}
          </g>
          <text x="60" y="58" textAnchor="middle" className="d-num">{Math.round(kcal)}</text>
          <text x="60" y="73" textAnchor="middle" className="d-lbl">kcal</text>
        </svg>
        <ul className="legend">
          {parts.map(([n, g, k, col]) => <li key={n}><i style={{ background: col }} /><span>{n}</span><b>{Math.round(g)} g</b><small>{Math.round(((g * k) / tot) * 100)}%</small></li>)}
        </ul>
      </div>
    </div>
  );
}

const AXES = ["sweet", "sour", "salty", "bitter", "umami", "spicy"];
function FlavorRadar({ fp }) {
  const v = AXES.map((a) => Math.max(0, Math.min(5, +fp?.[a] || 0)));
  if (!v.some((x) => x > 0)) return null;
  const pt = (i, val) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; return [120 + Math.cos(a) * 78 * (val / 5), 120 + Math.sin(a) * 78 * (val / 5)]; };
  const poly = (f) => AXES.map((_, i) => pt(i, f(i)).map((n) => n.toFixed(1)).join(",")).join(" ");
  return (
    <div className="viz">
      <h4>Flavour profile</h4>
      <svg viewBox="0 0 240 240" className="radar" role="img" aria-label="Flavour profile radar chart">
        {[1, 2, 3, 4, 5].map((k) => <polygon key={k} points={poly(() => k)} className="ring-l" />)}
        {AXES.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1="120" y1="120" x2={x} y2={y} className="ring-l" />; })}
        <motion.polygon points={poly((i) => v[i])} className="radar-fill" style={{ transformOrigin: "120px 120px" }} initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        {AXES.map((a, i) => { const [x, y] = pt(i, 6.1); return <text key={a} x={x} y={y + 4} textAnchor="middle" className="ax-lbl">{a}</text>; })}
      </svg>
    </div>
  );
}

function Timeline({ steps }) {
  const t = steps.map((s, i) => ({ i, m: toMin(s.minutes), label: s.title || `Step ${i + 1}` })).filter((x) => x.m > 0);
  const tot = t.reduce((a, x) => a + x.m, 0), max = Math.max(...t.map((x) => x.m), 1);
  if (!tot) return null;
  return (
    <div className="tl">
      <div className="tl-head"><span>Time by step</span><b>{tot} min total</b></div>
      {t.map((x, k) => (
        <div className="tl-row" key={x.i}>
          <span className="tl-n">{x.i + 1}</span>
          <span className="tl-lbl">{x.label}</span>
          <div className="tl-track"><motion.i initial={{ width: 0 }} animate={{ width: (x.m / max) * 100 + "%" }} transition={{ delay: 0.1 + k * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} /></div>
          <b>{x.m} min</b>
        </div>
      ))}
    </div>
  );
}

export function RecipeBody({ r: raw }) {
  const [done, setDone] = useState({}), [sdone, setSdone] = useState({});
  const r = normRecipe(raw);
  const nut = r.nutrition, steps = r.steps;
  const groups = [];
  normIng(r.ingredients).forEach((x, i) => {
    const g = x.group || "Ingredients";
    let G = groups.find((a) => a[0] === g);
    if (!G) groups.push((G = [g, []]));
    G[1].push([x, i]);
  });
  const hasSpice = r.spiceLevel !== undefined && r.spiceLevel !== "" && r.spiceLevel !== null;
  const donut = nut.length ? <MacroDonut nut={nut} /> : null, radar = r.flavorProfile ? <FlavorRadar fp={r.flavorProfile} /> : null;
  return (
    <div className="recipe">
      <div className="facts">
        {r.cuisine ? <span><ChefHat size={15} />{r.cuisine}</span> : null}
        {r.prepTime ? <span><Clock size={15} />Prep {r.prepTime}</span> : null}
        {r.cookTime ? <span><Flame size={15} />Cook {r.cookTime}</span> : null}
        {r.totalTime ? <span><Clock size={15} />Total {r.totalTime}</span> : null}
        {r.servings ? <span><Users size={15} />Serves {r.servings}</span> : null}
        {r.difficulty ? <span>{r.difficulty}</span> : null}
        {hasSpice ? <span>Spice <Spice level={r.spiceLevel} /></span> : null}
      </div>
      {r.healthNote && <p className="callout"><Target size={16} />{r.healthNote}</p>}
      {(donut || radar) && <div className="glance">{donut}{radar}</div>}
      {nut.length > 0 && <><h3 className="sec">Nutrition per serving</h3><Nutrition items={nut} /></>}
      {r.equipment?.length > 0 && <><h3 className="sec">Equipment</h3><div className="tags">{r.equipment.map((x, i) => <span key={i} className="tag">{x}</span>)}</div></>}
      {groups.length > 0 && (
        <>
          <h3 className="sec">Ingredients</h3>
          {groups.map(([g, list]) => (
            <div key={g} className="ing-group">
              {groups.length > 1 && <h5>{g}</h5>}
              <ul className="ings">
                {list.map(([x, i]) => (
                  <li key={i} className={done[i] ? "done" : ""} onClick={() => setDone({ ...done, [i]: !done[i] })}>
                    <span className="box">{done[i] && <Check size={12} />}</span>
                    <span><b>{x.quantity}</b> {x.item}{x.note ? <em className="ing-note">, {x.note}</em> : null}{x.substitute ? <small className="sub">Swap: {x.substitute}</small> : null}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      {steps.length > 0 && (
        <>
          <h3 className="sec">Method</h3>
          <Timeline steps={steps} />
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i} className={sdone[i] ? "done" : ""} onClick={() => setSdone({ ...sdone, [i]: !sdone[i] })}>
                <span className="num">{sdone[i] ? <Check size={15} /> : i + 1}</span>
                <div>
                  {(s.title || toMin(s.minutes) > 0) && <p className="step-head">{s.title && <b>{s.title}</b>}{toMin(s.minutes) > 0 && <span className="step-min"><Clock size={12} />{toMin(s.minutes)} min</span>}</p>}
                  <p>{s.text}</p>
                  {s.tip && <p className="tip-box">{s.tip}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="hint">Tap an ingredient or step to tick it off while you cook.</p>
        </>
      )}
      {r.tips?.length > 0 && <><h3 className="sec">Chef tips</h3><ul className="tips">{r.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
      {r.pairings?.length > 0 && <><h3 className="sec">Serve with</h3><div className="tags">{r.pairings.map((x, i) => <span key={i} className="tag hot">{x}</span>)}</div></>}
      {r.variations?.length > 0 && <><h3 className="sec">Variations</h3><ul className="tips">{r.variations.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
      {r.storage && <><h3 className="sec">Storage and reheating</h3><p className="prose sm">{r.storage}</p></>}
    </div>
  );
}

export function BlogArticle({ b, actions }) {
  const r = b.recipe || {};
  const hasRecipe = r.ingredients?.length || r.steps?.length || normNut(r).length;
  return (
    <article className="article">
      {b.thumbnail && <Cover key={b.thumbnail} src={b.thumbnail} alt={b.title} />}
      <div className="art-head">
        {b.tags?.length > 0 && <div className="tags">{b.tags.map((t) => <span key={t} className="tag hot">{t}</span>)}</div>}
        <h1>{b.title || "Untitled blog"}</h1>
        {b.authorName && <p className="byline">By {b.authorName}{b.createdAt ? ` on ${fmtDate(b.createdAt)}` : ""}</p>}
        {actions}
      </div>
      {b.intro && <p className="prose">{b.intro}</p>}
      {hasRecipe ? <div className="recipe-box"><RecipeBody r={r} /></div> : null}
      {b.closing && <p className="prose">{b.closing}</p>}
      {b.youtube?.map((l, i) =>
        ytId(l.url)
          ? <div key={i}><iframe className="yt" loading="lazy" src={`https://www.youtube.com/embed/${ytId(l.url)}`} allowFullScreen title={`Video ${i + 1}`} />{l.note && <p className="byline">{l.note}</p>}</div>
          : <a key={i} className="act" href={l.url} target="_blank" rel="noreferrer">{l.note || l.url}</a>
      )}
    </article>
  );
}

export function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="modal" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} onClick={(e) => e.stopPropagation()}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
