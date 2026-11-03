import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, setDoc, addDoc, deleteDoc, collection, serverTimestamp, onSnapshot, query, orderBy, writeBatch, increment, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Heart, Bookmark, Link2, Pencil, Send, ChefHat } from "lucide-react";
import { db } from "../firebase";
import { BlogArticle, fmtDate, initial, toast } from "../ui";

export default function BlogView({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [b, setB] = useState(undefined), [liked, setLiked] = useState(false), [saved, setSaved] = useState(false), [cs, setCs] = useState([]), [c, setC] = useState("");
  const ref = doc(db, "blogs", id);
  useEffect(() => onSnapshot(ref, (s) => setB(s.exists() ? s.data() : null)), [id]);
  useEffect(() => onSnapshot(doc(db, "blogs", id, "likes", user.uid), (s) => setLiked(s.exists())), [id]);
  useEffect(() => onSnapshot(doc(db, "users", user.uid, "saves", id), (s) => setSaved(s.exists())), [id]);
  useEffect(() => onSnapshot(query(collection(db, "blogs", id, "comments"), orderBy("createdAt", "desc")), (s) => setCs(s.docs.map((d) => ({ id: d.id, ...d.data() })))), [id]);

  if (b === undefined) return <div className="page"><div className="article-wrap"><div className="skel" style={{ aspectRatio: "16/10", borderRadius: 22 }} /></div></div>;
  if (b === null) return <div className="page"><div className="empty"><h3>This blog is no longer available</h3><Link className="btn" to="/explore">Back to Explore</Link></div></div>;

  async function like() {
    const lr = doc(db, "blogs", id, "likes", user.uid), batch = writeBatch(db);
    if (liked) batch.delete(lr); else batch.set(lr, { at: serverTimestamp() });
    batch.update(ref, { likeCount: increment(liked ? -1 : 1) });
    await batch.commit();
  }
  async function save() {
    const sr = doc(db, "users", user.uid, "saves", id);
    if (saved) await deleteDoc(sr); else await setDoc(sr, { at: serverTimestamp() });
    toast(saved ? "Removed from saved" : "Saved");
  }
  async function tryRecipe() {
    const col = collection(db, "users", user.uid, "chats"), cid = doc(col).id, r = b.recipe;
    await setDoc(doc(col, cid), {
      title: b.title, step: "servings", dishes: [], recipe: null, base: r,
      prefs: { dish: b.title, servings: r.servings || "", source: id },
      msgs: [{ role: "ai", text: `I loaded "${b.title}" from the blog${r.servings ? `, written for ${r.servings} servings` : ""}. How many servings are you cooking? I will rescale every ingredient and adjust the method.` }],
      updatedAt: serverTimestamp(),
    });
    localStorage.setItem("lastChat" + user.uid, cid);
    nav("/");
  }
  async function comment() {
    const text = c.trim(); if (!text) return; setC("");
    await addDoc(collection(db, "blogs", id, "comments"), { uid: user.uid, name: user.displayName || user.email, text, createdAt: serverTimestamp() });
    await updateDoc(ref, { commentCount: increment(1) });
  }
  const actions = (
    <div className="actions">
      {b.recipe?.ingredients?.length > 0 && <motion.button whileTap={{ scale: 0.95 }} className="act primary" onClick={tryRecipe}><ChefHat size={17} />Try this recipe</motion.button>}
      <motion.button whileTap={{ scale: 0.88 }} className={"act" + (liked ? " on" : "")} onClick={like}><Heart size={18} fill={liked ? "currentColor" : "none"} />{b.likeCount || 0}</motion.button>
      <motion.button whileTap={{ scale: 0.92 }} className={"act" + (saved ? " on" : "")} onClick={save}><Bookmark size={18} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</motion.button>
      <button className="act" onClick={() => { navigator.clipboard.writeText(location.href); toast("Link copied"); }}><Link2 size={18} />Share</button>
      {b.authorId === user.uid && <Link className="act" to={`/editor/post/${id}`}><Pencil size={16} />Edit</Link>}
    </div>
  );
  return (
    <div className="page">
      <div className="article-wrap">
        <BlogArticle b={b} actions={actions} />
        <section className="panel" style={{ marginTop: 28 }}>
          <h3>Comments ({b.commentCount || 0})</h3>
          <div className="cmt-new">
            <span className="avatar">{initial(user)}</span>
            <input placeholder="Share your thoughts" value={c} onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === "Enter" && comment()} />
            <button className="btn" disabled={!c.trim()} onClick={comment}><Send size={15} />Post</button>
          </div>
          {cs.map((x) => (
            <motion.div key={x.id} className="cmt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="avatar">{initial(x.name)}</span>
              <div><b>{x.name}</b> <small>{fmtDate(x.createdAt)}</small><p>{x.text}</p></div>
            </motion.div>
          ))}
        </section>
      </div>
    </div>
  );
}
