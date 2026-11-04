import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Clock, Target, Scale, PenLine, Compass, Youtube, ImageIcon, Heart, Bookmark, MessageCircle } from "lucide-react";

// Illustrative sample data for the hero demo (axes match the app's flavour profile).
const AXES = ["Sweet", "Sour", "Salty", "Bitter", "Umami", "Spicy"];
const DEMO = [
  { title: "Chingri malai curry", img: "chingri-malai", cuisine: "Bengali", pantry: ["prawns", "coconut milk", "onion", "ginger", "garam masala"], time: "40 min", kcal: 360, spice: 1, radar: [2, 1, 3, 1, 3, 1], steps: ["Marinate the prawns in turmeric and salt, then sear briefly.", "Cook an onion and ginger paste in mustard oil, then add coconut milk.", "Slip the prawns back in and finish with ghee and whole spices."] },
  { title: "Cheese soufflé", img: "souffle", cuisine: "French", pantry: ["eggs", "gruyère", "butter", "flour", "milk"], time: "55 min", kcal: 310, spice: 0, radar: [0, 1, 3, 1, 3, 0], steps: ["Whisk a thick béchamel and melt in the cheese and yolks.", "Fold in stiff egg whites in two batches without deflating them.", "Bake without opening the oven until tall and golden."] },
  { title: "Xiaolongbao", img: "xiaolongbao", cuisine: "Shanghainese", pantry: ["pork mince", "pork stock", "gelatin", "flour", "ginger"], time: "2 hr", kcal: 280, spice: 0, radar: [1, 1, 3, 1, 4, 0], steps: ["Set the stock with gelatin, then dice it into the pork filling.", "Roll thin wrappers and pleat each one closed over the filling.", "Steam for 8 minutes and serve with black vinegar and ginger."] },
];

function Photo({ file, alt, className }) {
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [file]);
  return ok ? <img className={className} src={`/landing/${file}.png`} alt={alt} onError={() => setOk(false)} /> : <span className={className + " lp-photo-empty"} aria-hidden="true" />;
}

function Radar({ values }) {
  const c = 62, r = 46;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const poly = values.map((v, i) => pt(i, v / 5).join(",")).join(" ");
  return (
    <svg viewBox="0 0 124 124" className="lp-radar" role="img" aria-label="Flavour profile">
      {[0.4, 0.7, 1].map((k) => <polygon key={k} points={AXES.map((_, i) => pt(i, k).join(",")).join(" ")} className="lp-ring" />)}
      <motion.polygon key={poly} points={poly} className="lp-fill" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: "62px 62px" }} transition={{ duration: 0.6, delay: 0.5 }} />
      {AXES.map((a, i) => { const [x, y] = pt(i, 1.28); return <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="lp-ax">{a}</text>; })}
    </svg>
  );
}

function HeroDemo() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % DEMO.length), 7000);
    return () => clearInterval(t);
  }, [reduce]);
  const d = DEMO[i];
  return (
    <div className="lp-demo" aria-label="Example of an ingredient list becoming a recipe">
      <AnimatePresence mode="wait">
        <motion.div key={d.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <p className="lp-demo-label">You have</p>
          <div className="lp-chips">
            {d.pantry.map((p, n) => <motion.span key={p} className="lp-chip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + n * 0.12 }}>{p}</motion.span>)}
          </div>
          <motion.article className="lp-recipe" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}>
            <div className="lp-cover"><Photo file={d.img} alt={d.title} /></div>
            <div className="lp-recipe-top">
              <div>
                <h3>{d.title}</h3>
                <div className="lp-meta"><span>{d.cuisine}</span><span><Clock size={13} />{d.time}</span><span>{d.kcal} kcal</span>
                  <span className="lp-spice" aria-label={`Spice level ${d.spice} of 5`}>{[0, 1, 2].map((n) => <Flame key={n} size={13} className={n < d.spice ? "on" : ""} />)}</span></div>
              </div>
            </div>
            <div className="lp-recipe-body">
              <ol>{d.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <Radar values={d.radar} />
            </div>
          </motion.article>
        </motion.div>
      </AnimatePresence>
      <div className="lp-dots" role="tablist" aria-label="Example dishes">
        {DEMO.map((x, n) => <button key={x.title} role="tab" aria-selected={n === i} aria-label={x.title} className={n === i ? "on" : ""} onClick={() => setI(n)} />)}
      </div>
    </div>
  );
}

const STEPS = [
  { h: "Answer a few quick questions", p: "Healthy, tasty or both? Choose nutrition goals like high protein or iron rich, list what is in your kitchen, then set diet, cuisine, spice level, time and servings.",
    v: <div className="lp-mini"><div className="lp-chips">{["Healthy", "Tasty", "Both"].map((x, n) => <span key={x} className={"lp-chip" + (n === 2 ? " sel" : "")}>{x}</span>)}</div><div className="lp-chips">{["High protein", "Iron rich", "High fiber"].map((x, n) => <span key={x} className={"lp-chip" + (n < 2 ? " sel" : "")}>{x}</span>)}</div><div className="lp-chips">{["Vegetarian", "Japanese", "Medium spice", "Under 20 min"].map((x) => <span key={x} className="lp-chip">{x}</span>)}</div></div> },
  { h: "Get a recipe you can cook from", p: "Ingredients are grouped by use. Every step carries heat, timing and what to look, smell or hear for. You also get chef tips, pairings, a flavour profile and per-serving nutrition, and you can rescale servings at any time.",
    v: <div className="lp-mini lp-nut">{[["Calories", "285 kcal", 14], ["Protein", "8 g", 16, 1], ["Carbohydrates", "42 g", 14], ["Fiber", "5 g", 20, 1]].map(([n, a, p, g]) => <div key={n}><span>{n}{g ? <em>goal</em> : null}</span><b>{a}</b><i style={{ "--w": p * 3 + "%" }} /></div>)}</div> },
  { h: "Turn it into a blog", p: "One click moves the recipe into an editor with an AI-generated cover image. Edit the story, attach YouTube videos, save a draft or publish. Readers can like, save and comment.",
    v: <div className="lp-mini lp-post"><div className="lp-thumb"><Photo file="paella" alt="Paella Valenciana" /></div><b>Paella Valenciana</b><p>Saffron rice with a crisp socarrat crust, built step by step.</p><div className="lp-acts"><span><Heart size={15} />24</span><span><Bookmark size={15} />9</span><span><MessageCircle size={15} />6</span></div></div> },
];

const FEATURES = [
  [Target, "Nutrition goals that carry through", "Each goal you pick is mapped to concrete nutrients and highlighted in the recipe's nutrition panel."],
  [Scale, "Rescale to any serving size", "Quantities, pan size, timings and heat are recalculated, with a reminder that salt and spice should be tasted."],
  [ImageIcon, "Cover images that match the dish", "Covers are generated from a visual description of the finished dish, not only its name."],
  [PenLine, "A real editor, not a text dump", "Review the blog, edit every ingredient and step, save drafts and publish when it reads right."],
  [Youtube, "Attach cooking videos", "Add YouTube links with a short note on what each video shows."],
  [Compass, "Explore, save and discuss", "Browse recipes from other cooks, save the ones you want to make, and comment on them."],
];

const GALLERY = [["paella", "Paella Valenciana", "Spanish"], ["xiaolongbao", "Xiaolongbao", "Shanghainese"], ["chingri-malai", "Chingri malai curry", "Bengali"], ["souffle", "Cheese soufflé", "French"], ["mole-poblano", "Mole poblano", "Mexican"], ["galouti-kebab", "Galouti kebab", "Awadhi"]];

// Shows public/landing/<file>.png; falls back to a plain tile if the photo has not been generated yet.
function Tile({ file, name, cuisine }) {
  const [ok, setOk] = useState(true);
  return (
    <li className="lp-tile">
      {ok ? <img src={`/landing/${file}.png`} alt={name} loading="lazy" onError={() => setOk(false)} /> : <span className="lp-tile-empty" aria-hidden="true" />}
      <figcaption><b>{name}</b><span>{cuisine}</span></figcaption>
    </li>
  );
}

const CUISINES = ["Bengali", "French", "Hyderabadi", "Japanese", "Mexican", "Rajasthani", "Italian", "Thai", "Korean", "Middle Eastern", "Gujarati", "Mediterranean"];

export default function Landing({ user }) {
  const start = user ? "/" : "/login?mode=up";
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/welcome" aria-label="FlavorFusion.AI"><img className="lp-logo" src="/logo.png" alt="FlavorFusion.AI" /></Link>
        <nav aria-label="Sections"><a href="#how">How it works</a><a href="#cuisines">Cuisines</a><a href="#features">Features</a></nav>
        <div className="lp-nav-cta">
          {!user && <Link className="btn soft" to="/login">Sign in</Link>}
          <Link className="btn" to={start}>{user ? "Open your kitchen" : "Start cooking"}</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Your pantry in. A finished recipe blog out.</h1>
          <p>FlavorFusion.AI is an AI sous chef. It asks about your mood, nutrition goals and ingredients, writes a complete recipe with timings and nutrition, then turns it into a blog post with its own cover image.</p>
          <div className="lp-cta"><Link className="btn lg" to={start}>{user ? "Open your kitchen" : "Start cooking"}</Link><a className="btn line lg" href="#how">See how it works</a></div>
          <p className="lp-fine">Choose from 19 cuisines, from regional Indian to French, Japanese and Mexican, and 9 nutrition goals.</p>
        </div>
        <HeroDemo />
      </section>

      <section className="lp-sec" id="how">
        <h2>From what you have to something worth sharing</h2>
        <ol className="lp-steps">
          {STEPS.map((s, n) => (
            <li key={s.h}>
              <span className="lp-num">{n + 1}</span>
              <div className="lp-step-copy"><h3>{s.h}</h3><p>{s.p}</p></div>
              {s.v}
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-indian" id="cuisines">
        <div className="lp-indian-in">
          <h2>For the dishes you would not attempt alone</h2>
          <p className="lp-lead">Laminated dough, a soufflé that has to rise, soup sealed inside a dumpling. Ask for the dish you have been avoiding and get exact quantities, timings and the cues that tell you it is working.</p>
          <ul className="lp-cuisines">{CUISINES.map((c) => <li key={c}>{c}</li>)}</ul>
          <ul className="lp-gallery">{GALLERY.map(([f, n, c]) => <Tile key={f} file={f} name={n} cuisine={c} />)}</ul>
        </div>
      </section>

      <section className="lp-sec" id="features">
        <h2>Everything between the idea and the publish button</h2>
        <ul className="lp-feat">
          {FEATURES.map(([Icon, h, p]) => <li key={h}><span className="lp-ic"><Icon size={20} /></span><div><h3>{h}</h3><p>{p}</p></div></li>)}
        </ul>
      </section>

      <section className="lp-final">
        <h2>Open your kitchen</h2>
        <p>Sign in with Google or an email address and start with a single question.</p>
        <Link className="btn lg" to={start}>{user ? "Open your kitchen" : "Create your account"}</Link>
      </section>

      <footer className="lp-foot">
        <img src="/logo.png" alt="FlavorFusion.AI" />
        <span>Cook what you have. Share what you make.</span>
      </footer>
    </div>
  );
}
