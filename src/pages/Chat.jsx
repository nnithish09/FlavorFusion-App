import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, setDoc, deleteDoc, getDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Leaf, Flame, Sparkles, Plus, Minus, Trash2, MessageSquare, Menu, Send, RefreshCw, PenLine, ChefHat, Clock } from "lucide-react";
import { db } from "../firebase";
import { askJSON } from "../groq";
import { RecipeBody, fadeUp, normRecipe } from "../ui";
import { RECIPE_SYS, RESCALE_RULES } from "../prompts";

const CUISINES = ["North Indian", "South Indian", "Bengali", "Gujarati", "Rajasthani", "Hyderabadi", "Maharashtrian", "Punjabi", "Italian", "Chinese", "Thai", "Japanese", "Korean", "Mexican", "Mediterranean", "Middle Eastern", "French", "American", "Continental", "Surprise me"];
const NUTRIENTS = ["High protein", "Low carb", "High fiber", "Vitamins and minerals", "Iron rich", "Calcium rich", "Low calorie", "Healthy fats", "Low sodium"];
const CHIPS = { diet: ["Vegetarian", "Vegan", "Eggetarian", "Non-vegetarian"], cuisine: CUISINES, spice: ["Mild", "Medium", "Hot"], time: ["Under 20 min", "20 to 45 min", "No limit"] };
const MOODS = [["Healthy", Leaf, "Nutrition comes first"], ["Tasty", Flame, "Pure comfort and flavour"], ["Both", Sparkles, "Balanced and delicious"]];
const STEPS = ["mood", "nutrition", "ingredients", "diet", "cuisine", "spice", "time", "dishes", "servings", "recipe"];
const Q = {
  nutrition: "Which nutritional goals matter most? Pick any and confirm.",
  ingredients: "What ingredients do you have on hand? List them, or skip and I will suggest freely.",
  diet: "Any dietary preference?",
  cuisine: "Which cuisine are you in the mood for?",
  spice: "How spicy should it be?",
  time: "How much time do you have?",
};
const GREETING = "Hi, I'm your kitchen assistant. Are we going for something healthy, something tasty, or a bit of both?";
const blank = () => ({ msgs: [{ role: "ai", text: GREETING }], step: "mood", prefs: {}, dishes: [], recipe: null, base: null });
const order = (p) => STEPS.filter((x) => !(x === "nutrition" && p.mood === "Tasty"));
const nextStep = (p, s) => order(p)[order(p).indexOf(s) + 1];

function group(list) {
  const now = new Date(), out = { Today: [], "Previous 7 days": [], Older: [] };
  list.forEach((x) => {
    const age = (now - (x.updatedAt?.toDate?.() || now)) / 864e5;
    (age < 1 ? out.Today : age < 7 ? out["Previous 7 days"] : out.Older).push(x);
  });
  return Object.entries(out).filter(([, v]) => v.length);
}

export default function Chat({ user }) {
  const nav = useNavigate();
  const [s, setS] = useState(blank);
  const idRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [sel, setSel] = useState([]);
  const [text, setText] = useState("");
  const [serv, setServ] = useState(2);
  const [sessions, setSessions] = useState([]);
  const [menu, setMenu] = useState(false);
  const end = useRef();
  const col = useMemo(() => collection(db, "users", user.uid, "chats"), [user.uid]);
  const lastKey = "lastChat" + user.uid;

  useEffect(() => onSnapshot(query(col, orderBy("updatedAt", "desc")), (q) => setSessions(q.docs.map((d) => ({ id: d.id, ...d.data() })))), [col]);
  useEffect(() => { const l = localStorage.getItem(lastKey); if (l) load(l); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [s.msgs.length, s.step, busy]);

  // Single source of truth: one session id per conversation, created once, then updated in place.
  async function commit(next) {
    setS(next);
    if (!idRef.current) idRef.current = doc(col).id;
    localStorage.setItem(lastKey, idRef.current);
    const { msgs, step, prefs, dishes, recipe, base } = next;
    const title = prefs.dish || [prefs.mood, prefs.cuisine].filter(Boolean).join(" ") || "New chat";
    try { await setDoc(doc(col, idRef.current), { msgs, step, prefs, dishes, recipe, base: base || null, title, updatedAt: serverTimestamp() }, { merge: true }); } catch (e) { console.error(e); }
  }
  async function load(id) {
    const d = (await getDoc(doc(col, id))).data();
    if (!d) { localStorage.removeItem(lastKey); return; }
    idRef.current = id; localStorage.setItem(lastKey, id);
    setS({ msgs: d.msgs, step: d.step, prefs: d.prefs || {}, dishes: d.dishes || [], recipe: d.recipe || null, base: d.base || null });
    if (d.base?.servings) setServ(parseInt(d.base.servings) || 2);
    setSel([]); setText(""); setMenu(false);
  }
  function fresh() { idRef.current = null; localStorage.removeItem(lastKey); setS(blank()); setSel([]); setText(""); setServ(2); setMenu(false); }
  async function del(id) { await deleteDoc(doc(col, id)); if (id === idRef.current) fresh(); }

  function answer(value, key) {
    if (busy) return;
    const prefs = { ...s.prefs, [key]: value };
    const n = nextStep(prefs, s.step);
    const msgs = [...s.msgs, { role: "user", text: Array.isArray(value) ? value.join(", ") : value }];
    setSel([]); setText("");
    if (n === "dishes") return suggest(prefs, msgs);
    commit({ ...s, msgs: [...msgs, { role: "ai", text: Q[n] }], step: n, prefs });
  }

  async function suggest(prefs, msgs) {
    setBusy("Finding dishes for you");
    setS((x) => ({ ...x, msgs, prefs }));
    try {
      const r = await askJSON(
        'You are a chef and nutritionist. Return {"dishes":[{"name":"","why":"one sentence","calories":"number of kcal per serving","time":"","keyNutrients":[{"name":"","amount":""}]}]} with exactly 5 distinct dishes. keyNutrients has one entry per requested nutrition goal, mapped to a concrete nutrient with a realistic per serving amount and unit (for example High protein becomes Protein 28 g, Iron rich becomes Iron 6 mg). If there are no goals, list Protein and Carbs.',
        `Preferences: ${JSON.stringify(prefs)}. Avoid these dishes: ${JSON.stringify(s.dishes.map((d) => d.name))}. Prioritise the available ingredients, allow only common pantry staples beyond them, and respect nutrition goals, diet, cuisine, spice and time.`);
      await commit({ ...s, msgs: [...msgs, { role: "ai", text: "Here are five options that fit. Pick one." }], step: "dishes", prefs, dishes: r.dishes });
    } catch (e) {
      setS((x) => ({ ...x, msgs: [...msgs, { role: "ai", text: "I couldn't fetch dishes: " + e.message + ". Pick your last option again to retry." }], prefs }));
    }
    setBusy("");
  }

  function pickDish(d) {
    commit({ ...s, step: "servings", prefs: { ...s.prefs, dish: d.name }, msgs: [...s.msgs, { role: "user", text: d.name }, { role: "ai", text: "Great choice. How many servings are you cooking?" }] });
  }

  async function makeRecipe() {
    const prefs = { ...s.prefs, servings: serv };
    const msgs = [...s.msgs, { role: "user", text: `${serv} ${serv === 1 ? "serving" : "servings"}` }];
    setS({ ...s, msgs, prefs }); setBusy(s.base ? "Rescaling your recipe" : "Writing your recipe");
    try {
      const r = s.base
        ? await askJSON(RECIPE_SYS + "\n" + RESCALE_RULES(s.base.servings || "the original number of", serv), `Original recipe: ${JSON.stringify(s.base)}. New servings: ${serv}.`)
        : await askJSON(RECIPE_SYS, `Dish: ${prefs.dish}. Servings: ${serv}. Preferences: ${JSON.stringify(prefs)}.`);
      await commit({ ...s, msgs: [...msgs, { role: "ai", text: s.base ? `Done. Here is the recipe rescaled to ${serv} servings.` : "Your recipe is ready. Review it below, then post it as a blog if you like." }], step: "recipe", prefs, recipe: normRecipe(r) });
    } catch (e) {
      setS((x) => ({ ...x, msgs: [...msgs, { role: "ai", text: "I couldn't create the recipe: " + e.message + ". Try again." }] }));
    }
    setBusy("");
  }

  const st = s.step, r = s.recipe;
  const ord = order(s.prefs), idx = Math.max(0, ord.indexOf(st)), pct = Math.round((idx / (ord.length - 1)) * 100);
  const toggle = (n) => setSel(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]);

  return (
    <div className={"chat-wrap" + (menu ? " open" : "")}>
      <aside className="side">
        <button className="btn" onClick={fresh}><Plus size={16} />New chat</button>
        <div className="side-list">
          {group(sessions).map(([label, items]) => (
            <div key={label}>
              <p className="grp">{label}</p>
              {items.map((x) => (
                <div key={x.id} className={"sess" + (x.id === idRef.current ? " on" : "")} onClick={() => load(x.id)}>
                  <MessageSquare size={14} /><span>{x.title}</span>
                  <button className="icon-btn del" aria-label="Delete chat" onClick={(e) => { e.stopPropagation(); del(x.id); }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ))}
          {!sessions.length && <p className="hint pad">Your conversations will appear here.</p>}
        </div>
      </aside>
      {menu && <div className="scrim-m" onClick={() => setMenu(false)} />}
      <section className="chat">
        <div className="chat-head">
          <button className="icon-btn menu-btn" aria-label="Chats" onClick={() => setMenu(true)}><Menu size={18} /></button>
          <h2>Kitchen assistant</h2>
          <span className="step-l">{st === "recipe" ? "Recipe ready" : s.base ? "Adjust servings" : `Step ${idx + 1} of ${ord.length - 1}`}</span>
          <div className="prog"><motion.i initial={false} animate={{ width: (s.base ? (st === "recipe" ? 100 : 70) : pct) + "%" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} /></div>
        </div>
        <div className="log">
          {s.msgs.map((m, i) => (
            <motion.div key={i} className={"msg " + m.role} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {m.role === "ai" && <span className="av"><ChefHat size={16} /></span>}
              <div className="bub">{m.text}</div>
            </motion.div>
          ))}
          {busy && (
            <motion.div className="msg ai" {...fadeUp}>
              <span className="av"><ChefHat size={16} /></span>
              <div className="bub typing"><i /><i /><i /><em>{busy}</em></div>
            </motion.div>
          )}
          {r && st === "recipe" && !busy && (
            <motion.div className="recipe-card" {...fadeUp}>
              <h2>{r.title}</h2><p className="desc">{r.description}</p>
              <RecipeBody r={r} />
            </motion.div>
          )}
          <div ref={end} />
        </div>
        <div className="dock">
          <AnimatePresence mode="wait">
            <motion.div key={busy ? "busy" : st} className="dock-in" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              {busy ? <p className="hint">This usually takes a few seconds.</p> : (
                <>
                  {st === "mood" && (
                    <div className="moods">
                      {MOODS.map(([m, Icon, sub]) => (
                        <motion.button key={m} className="mood" whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => answer(m, "mood")}>
                          <span className="mood-ic"><Icon size={20} /></span><b>{m}</b><small>{sub}</small>
                        </motion.button>
                      ))}
                    </div>
                  )}
                  {st === "nutrition" && (
                    <>
                      <div className="chips">{NUTRIENTS.map((n) => <button key={n} className={"chip" + (sel.includes(n) ? " on" : "")} onClick={() => toggle(n)}>{n}</button>)}</div>
                      <div className="inrow">
                        <input placeholder="Or type your own, for example omega 3" value={text} onChange={(e) => setText(e.target.value)} />
                        <button className="btn" disabled={!sel.length && !text.trim()} onClick={() => answer([...sel, ...(text.trim() ? [text.trim()] : [])], "nutrition")}>Continue</button>
                      </div>
                    </>
                  )}
                  {st === "ingredients" && (
                    <div className="inrow">
                      <input autoFocus placeholder="For example paneer, spinach, rice, onions" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && answer(text.trim(), "ingredients")} />
                      <button className="btn" disabled={!text.trim()} onClick={() => answer(text.trim(), "ingredients")}><Send size={15} />Send</button>
                      <button className="btn soft" onClick={() => answer("None, suggest freely", "ingredients")}>Skip</button>
                    </div>
                  )}
                  {CHIPS[st] && (
                    <div className="chips">
                      {CHIPS[st].map((c, i) => (
                        <motion.button key={c} className="chip" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.015 }} onClick={() => answer(c, st)}>{c}</motion.button>
                      ))}
                    </div>
                  )}
                  {st === "dishes" && (
                    <>
                      <div className="dishes">
                        {s.dishes.map((d, i) => (
                          <motion.button key={d.name} className="dish" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} whileHover={{ y: -4 }} onClick={() => pickDish(d)}>
                            <b>{d.name}</b><p>{d.why}</p>
                            <div className="tags">
                              <span className="tag hot"><Flame size={12} />{String(d.calories).replace(/kcal/i, "").trim()} kcal</span>
                              {d.keyNutrients?.map((n) => <span className="tag goal" key={n.name}>{n.name} {n.amount}</span>)}
                              <span className="tag"><Clock size={12} />{d.time}</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      <div className="inrow"><button className="btn soft" onClick={() => suggest(s.prefs, [...s.msgs, { role: "user", text: "Show me different dishes" }])}><RefreshCw size={15} />Show different dishes</button></div>
                    </>
                  )}
                  {st === "servings" && (
                    <div className="serv">
                      <div className="stepper">
                        <button className="icon-btn" aria-label="Fewer" onClick={() => setServ(Math.max(1, serv - 1))}><Minus size={16} /></button>
                        <b>{serv}</b>
                        <button className="icon-btn" aria-label="More" onClick={() => setServ(Math.min(24, serv + 1))}><Plus size={16} /></button>
                      </div>
                      <span className="hint">servings</span>
                      <button className="btn" onClick={makeRecipe}><ChefHat size={16} />{s.base ? "Rescale recipe" : "Create recipe"}</button>
                    </div>
                  )}
                  {st === "recipe" && (
                    <div className="inrow">
                      <button className="btn" onClick={() => nav("/editor/import/" + idRef.current)}><PenLine size={16} />Post as blog</button>
                      <button className="btn soft" onClick={fresh}><Plus size={16} />Start a new chat</button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
