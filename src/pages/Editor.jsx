import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Plus, Trash2, RefreshCw, Save, Rocket, Eye, Pencil, Check, ChefHat, Sparkles, Image as ImageIcon } from "lucide-react";
import { db } from "../firebase";
import { askJSON } from "../groq";
import { generateCover, writeImagePrompt } from "../image";
import { BlogArticle, Cover, fadeUp, normIng, normNut, normSteps, toast, ytId } from "../ui";

const BLANK = { title: "", intro: "", closing: "", tags: [], thumbnail: "", thumbPrompt: "", youtube: [], recipe: { prepTime: "", cookTime: "", totalTime: "", servings: "", difficulty: "", cuisine: "", spiceLevel: "", ingredients: [], steps: [], nutrition: [], tips: [], equipment: [], pairings: [], variations: [], storage: "" } };
const STAGES = ["Importing your recipe", "Writing the blog story", "Organizing sections", "Preparing the editor"];
const rand = () => Math.floor(Math.random() * 1e6);
const fix = (b) => ({
  ...BLANK, ...b, youtube: b.youtube || [], tags: b.tags || [],
  recipe: { ...BLANK.recipe, ...b.recipe, nutrition: normNut(b.recipe), ingredients: normIng(b.recipe?.ingredients), steps: normSteps(b.recipe).map((s) => ({ title: "", minutes: "", tip: "", ...s })), tips: b.recipe?.tips || [] },
});

export default function Editor({ user, kind }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [b, setB] = useState(null), [tags, setTags] = useState(""), [stage, setStage] = useState(0), [err, setErr] = useState("");
  const [tab, setTab] = useState("edit"), [saving, setSaving] = useState(false), [yt, setYt] = useState(""), [equip, setEquip] = useState(""), [pair, setPair] = useState(""), [coverBusy, setCoverBusy] = useState(false);
  const draftId = useRef(null), auto = useRef(false);

  useEffect(() => {
    (async () => {
      const ready = (x) => { setB(x); setTags(x.tags.join(", ")); setEquip((x.recipe.equipment || []).join(", ")); setPair((x.recipe.pairings || []).join(", ")); };
      try {
        if (kind === "new") return ready(fix({}));
        if (kind === "draft" || kind === "post") {
          const d = await getDoc(kind === "post" ? doc(db, "blogs", id) : doc(db, "users", user.uid, "drafts", id));
          if (!d.exists() || (kind === "post" && d.data().authorId !== user.uid)) { toast("Blog not found"); return nav("/my-blogs"); }
          if (kind === "draft") draftId.current = id;
          return ready(fix(d.data()));
        }
        const chatRef = doc(db, "users", user.uid, "chats", id);
        const c = await getDoc(chatRef); setStage(1);
        if (!c.exists() || !c.data().recipe) { toast("Recipe not found"); return nav("/"); }
        if (c.data().draftId) {
          const dd = await getDoc(doc(db, "users", user.uid, "drafts", c.data().draftId));
          if (dd.exists()) { draftId.current = dd.id; return ready(fix(dd.data())); }
        }
        const { thumbnailPrompt, ...recipe } = c.data().recipe;
        const w = await askJSON('Turn the recipe into a warm, readable blog post. Return {"title":"","intro":"two short paragraphs separated by a blank line","closing":"one short paragraph","tags":[""]}.', JSON.stringify({ recipe, prefs: c.data().prefs }));
        setStage(2);
        const x = fix({ ...w, recipe, thumbnail: "", thumbPrompt: "", youtube: [] });
        draftId.current = doc(collection(db, "users", user.uid, "drafts")).id;
        await setDoc(doc(db, "users", user.uid, "drafts", draftId.current), { ...x, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await updateDoc(chatRef, { draftId: draftId.current });
        setStage(3); await new Promise((r) => setTimeout(r, 600));
        ready(x);
      } catch (e) { setErr(e.message); }
    })();
  }, [kind, id]);
  useEffect(() => {
    if (kind === "import" && b && !b.thumbnail && !auto.current) { auto.current = true; makeCover(false); }
  }, [b]);

  if (err) return <div className="loader-page"><div className="loader-card"><h2>Something went wrong</h2><p className="hint">{err}</p><button className="btn" onClick={() => nav("/")}>Back to chat</button></div></div>;
  if (!b) return (
    <div className="loader-page">
      <motion.div className="loader-card" {...fadeUp}>
        <div className="ring"><ChefHat size={26} /></div>
        <h2>{kind === "import" ? "Turning your recipe into a blog" : "Opening editor"}</h2>
        {kind === "import" && <ul className="stages">{STAGES.map((l, i) => <li key={l} className={i < stage ? "done" : i === stage ? "now" : ""}><span className="dot">{i < stage && <Check size={12} />}</span>{l}</li>)}</ul>}
      </motion.div>
    </div>
  );

  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const setR = (k, v) => setB((x) => ({ ...x, recipe: { ...x.recipe, [k]: v } }));
  const row = (k, i, patch) => setR(k, b.recipe[k].map((x, j) => (j === i ? (typeof x === "string" ? patch : { ...x, ...patch }) : x)));
  const add = (k, v) => setR(k, [...b.recipe[k], v]);
  const del = (k, i) => setR(k, b.recipe[k].filter((_, j) => j !== i));
  const list = (t) => t.split(",").map((x) => x.trim()).filter(Boolean);
  const clean = () => ({
    ...b, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    recipe: { ...b.recipe, ingredients: b.recipe.ingredients.filter((x) => x.item.trim()), steps: b.recipe.steps.filter((x) => String(x.text).trim()), equipment: list(equip), pairings: list(pair), nutrition: b.recipe.nutrition.filter((x) => x.name.trim() && String(x.amount).trim()) },
  });

  async function makeCover(rewrite) {
    if (!b.title.trim()) return toast("Add a title first");
    setCoverBusy(true);
    try {
      let p = b.thumbPrompt;
      if (rewrite || !p?.trim()) p = await writeImagePrompt({ title: b.title, cuisine: b.recipe.cuisine, ingredients: b.recipe.ingredients.map((x) => x.item) });
      const img = await generateCover({ title: b.title, cuisine: b.recipe.cuisine, ingredients: b.recipe.ingredients.map((x) => x.item), description: p });
      setB((x) => ({ ...x, thumbPrompt: p, thumbnail: img }));
    } catch (e) { toast(e.message); }
    setCoverBusy(false);
  }
  async function saveDraft() {
    setSaving(true);
    try {
      if (!draftId.current) draftId.current = doc(collection(db, "users", user.uid, "drafts")).id;
      await setDoc(doc(db, "users", user.uid, "drafts", draftId.current), { ...clean(), updatedAt: serverTimestamp() });
      toast("Draft saved");
    } catch (e) { toast(e.message); }
    setSaving(false);
  }
  async function publish() {
    if (!b.title.trim()) return toast("Add a title first");
    setSaving(true);
    try {
      const d = clean();
      if (!d.thumbnail) {
        const p = d.thumbPrompt || await writeImagePrompt({ title: d.title, cuisine: d.recipe.cuisine, ingredients: d.recipe.ingredients.map((x) => x.item) });
        d.thumbPrompt = p;
        d.thumbnail = await generateCover({ title: d.title, cuisine: d.recipe.cuisine, ingredients: d.recipe.ingredients.map((x) => x.item), description: p });
      }
      if (kind === "post") {
        await updateDoc(doc(db, "blogs", id), { title: d.title, intro: d.intro, closing: d.closing, tags: d.tags, recipe: d.recipe, youtube: d.youtube, thumbnail: d.thumbnail, thumbPrompt: d.thumbPrompt || "", updatedAt: serverTimestamp() });
        toast("Changes saved"); nav(`/blog/${id}`);
      } else {
        const ref = await addDoc(collection(db, "blogs"), { ...d, authorId: user.uid, authorName: user.displayName || user.email, likeCount: 0, commentCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        if (draftId.current) await deleteDoc(doc(db, "users", user.uid, "drafts", draftId.current));
        toast("Published"); nav(`/blog/${ref.id}`, { replace: true });
      }
    } catch (e) { toast(e.message); setSaving(false); }
  }
  const addVideo = () => { set("youtube", [...b.youtube, { url: yt.trim(), note: "" }]); setYt(""); };
  const okLink = ytId(yt) || /youtube\.com\/(@|channel|c\/|user\/)/.test(yt);
  const R = b.recipe;

  return (
    <div className="page">
      <div className="ph"><div><h1>{kind === "post" ? "Edit blog" : kind === "new" ? "New blog" : "Review your blog"}</h1><p>{kind === "import" ? "Your recipe was organized into a blog. Edit anything before publishing." : "Write it your way, then publish when it feels right."}</p></div></div>
      {tab === "preview" ? (
        <div className="article-wrap"><BlogArticle b={{ ...clean(), authorName: user.displayName || user.email }} /></div>
      ) : (
        <div className="editor">
          <section className="panel">
            <h3>Cover image</h3>
            {coverBusy
              ? <div className="cover"><div className="skel fill"><span className="gen"><span className="spin" />Generating cover image</span></div></div>
              : b.thumbnail ? <Cover key={b.thumbnail.slice(-40)} src={b.thumbnail} alt="Cover" /> : <div className="cover empty"><ImageIcon size={22} />No cover yet. Describe the dish below and generate one.</div>}
            <div className="field"><label>Image description</label><textarea rows={3} value={b.thumbPrompt ?? ""} onChange={(e) => set("thumbPrompt", e.target.value)} placeholder="Describe how the finished dish looks: colour, texture, key ingredients and the plate or bowl it is served in" /></div>
            <div className="inrow">
              <button className="btn soft" disabled={coverBusy} onClick={() => makeCover(false)}><RefreshCw size={15} />{b.thumbnail ? "Regenerate image" : "Generate image"}</button>
              <button className="btn soft" disabled={coverBusy} onClick={() => makeCover(true)}><Sparkles size={15} />Rewrite description with AI</button>
            </div>
          </section>
          <section className="panel">
            <div className="field"><label>Title</label><input className="title-input" value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="Give your blog a title" /></div>
            <div className="field"><label>Introduction</label><textarea rows={7} value={b.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Tell the story behind the dish" /></div>
            <div className="field"><label>Tags (comma separated)</label><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vegetarian, high protein, quick" /></div>
          </section>
          <section className="panel">
            <h3>Recipe details</h3>
            <div className="g4">
              {[["prepTime", "Prep time"], ["cookTime", "Cook time"], ["totalTime", "Total time"], ["servings", "Servings"], ["difficulty", "Difficulty"], ["cuisine", "Cuisine"], ["spiceLevel", "Spice (0 to 5)"]].map(([k, l]) => <div className="field" key={k}><label>{l}</label><input value={R[k] ?? ""} onChange={(e) => setR(k, e.target.value)} /></div>)}
            </div>
            <h3>Ingredients</h3>
            {R.ingredients.map((x, i) => (
              <div className="rowx" key={i}>
                <input className="q" placeholder="Amount" value={x.quantity ?? ""} onChange={(e) => row("ingredients", i, { quantity: e.target.value })} />
                <input placeholder="Ingredient" value={x.item ?? ""} onChange={(e) => row("ingredients", i, { item: e.target.value })} />
                <input placeholder="Prep note (optional)" value={x.note ?? ""} onChange={(e) => row("ingredients", i, { note: e.target.value })} />
                <button className="icon-btn" aria-label="Remove" onClick={() => del("ingredients", i)}><Trash2 size={16} /></button>
              </div>
            ))}
            <div><button className="btn soft" onClick={() => add("ingredients", { quantity: "", item: "", note: "" })}><Plus size={15} />Add ingredient</button></div>
            <h3>Method</h3>
            {R.steps.map((x, i) => (
              <div className="rowx" key={i}>
                <span className="num">{i + 1}</span>
                <div className="stack">
                  <div className="inrow">
                    <input placeholder="Step title" value={x.title ?? ""} onChange={(e) => row("steps", i, { title: e.target.value })} />
                    <input className="q" placeholder="Minutes" inputMode="numeric" value={x.minutes ?? ""} onChange={(e) => row("steps", i, { minutes: e.target.value })} />
                  </div>
                  <textarea rows={3} placeholder="What to do, with heat level and doneness cues" value={x.text ?? ""} onChange={(e) => row("steps", i, { text: e.target.value })} />
                  <input placeholder="Tip (optional)" value={x.tip ?? ""} onChange={(e) => row("steps", i, { tip: e.target.value })} />
                </div>
                <button className="icon-btn" aria-label="Remove" onClick={() => del("steps", i)}><Trash2 size={16} /></button>
              </div>
            ))}
            <div><button className="btn soft" onClick={() => add("steps", { title: "", text: "", minutes: "", tip: "" })}><Plus size={15} />Add step</button></div>
            <h3>Nutrition per serving</h3>
            {R.nutrition.map((x, i) => (
              <div className="rowx" key={i}>
                <input placeholder="Nutrient" value={x.name} onChange={(e) => row("nutrition", i, { name: e.target.value })} />
                <input className="q" placeholder="Amount" value={x.amount} onChange={(e) => row("nutrition", i, { amount: e.target.value })} />
                <button className="icon-btn" aria-label="Remove" onClick={() => del("nutrition", i)}><Trash2 size={16} /></button>
              </div>
            ))}
            <div><button className="btn soft" onClick={() => add("nutrition", { name: "", amount: "" })}><Plus size={15} />Add nutrient</button></div>
          </section>
          <section className="panel">
            <div className="field"><label>Closing note</label><textarea rows={3} value={b.closing} onChange={(e) => set("closing", e.target.value)} /></div>
            <div className="field"><label>Equipment (comma separated)</label><input value={equip} onChange={(e) => setEquip(e.target.value)} placeholder="large pot, immersion blender" /></div>
            <div className="field"><label>Serving suggestions (comma separated)</label><input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="warm naan, cucumber raita" /></div>
            <div className="field"><label>Storage and reheating</label><textarea rows={2} value={R.storage ?? ""} onChange={(e) => setR("storage", e.target.value)} /></div>
          </section>
          <section className="panel">
            <h3>YouTube links (optional)</h3>
            {b.youtube.map((l, i) => (
              <div className="rowx" key={i}>
                <input value={l.url} readOnly />
                <input placeholder="What does this show?" value={l.note} onChange={(e) => set("youtube", b.youtube.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                <button className="icon-btn" aria-label="Remove" onClick={() => set("youtube", b.youtube.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
              </div>
            ))}
            <div className="inrow"><input placeholder="https://youtube.com/watch?v=..." value={yt} onChange={(e) => setYt(e.target.value)} /><button className="btn soft" disabled={!okLink} onClick={addVideo}><Plus size={15} />Add</button></div>
          </section>
        </div>
      )}
      <div className="actionbar">
        <div className="seg">
          <button className={tab === "edit" ? "on" : ""} onClick={() => setTab("edit")}><Pencil size={14} />Edit</button>
          <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}><Eye size={14} />Preview</button>
        </div>
        <div className="grow" />
        {kind !== "post" && <button className="btn soft" disabled={saving || coverBusy} onClick={saveDraft}><Save size={15} />Save draft</button>}
        <button className="btn" disabled={saving || coverBusy} onClick={publish}><Rocket size={15} />{kind === "post" ? "Save changes" : "Publish"}</button>
      </div>
    </div>
  );
}
