import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { Plus, Pencil, Eye, Trash2, Heart, MessageCircle, FileText } from "lucide-react";
import { db } from "../firebase";
import { Modal, fmtDate, toast } from "../ui";

const byTime = (a, b) => ((b.updatedAt || b.createdAt)?.seconds || 0) - ((a.updatedAt || a.createdAt)?.seconds || 0);

export default function MyBlogs({ user }) {
  const [tab, setTab] = useState("pub");
  const [pub, setPub] = useState(null), [drafts, setDrafts] = useState(null), [ask, setAsk] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, "blogs"), where("authorId", "==", user.uid)), (s) => setPub(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byTime))), [user.uid]);
  useEffect(() => onSnapshot(collection(db, "users", user.uid, "drafts"), (s) => setDrafts(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byTime))), [user.uid]);

  async function remove() {
    const { kind, id } = ask; setAsk(null);
    try {
      await deleteDoc(kind === "pub" ? doc(db, "blogs", id) : doc(db, "users", user.uid, "drafts", id));
      toast(kind === "pub" ? "Blog deleted" : "Draft deleted");
    } catch (e) { toast(e.message); }
  }
  const list = tab === "pub" ? pub : drafts;
  const tabs = [["pub", "Published", pub], ["draft", "Drafts", drafts]];
  return (
    <div className="page">
      <div className="ph">
        <div><h1>My blogs</h1><p>Write, edit and manage everything you have shared.</p></div>
        <Link to="/editor/new" className="btn"><Plus size={16} />New blog</Link>
      </div>
      <div className="tabs">
        {tabs.map(([k, label, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {tab === k && <motion.span layoutId="tabbg" className="tab-bg" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
            <span>{label}{l ? ` (${l.length})` : ""}</span>
          </button>
        ))}
      </div>
      {list === null ? <div className="skel" style={{ height: 96, borderRadius: 18 }} /> : list.length === 0 ? (
        <div className="empty"><div className="ic"><FileText size={26} /></div><h3>{tab === "pub" ? "No published blogs" : "No drafts"}</h3><p>Start writing, or generate a recipe in the chat and post it.</p></div>
      ) : (
        <div className="rows">
          {list.map((b, i) => (
            <motion.div key={b.id} className="mrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
              <div className="mthumb skel">{b.thumbnail && <img src={b.thumbnail} alt="" loading="lazy" />}</div>
              <div className="minfo">
                <h3>{b.title || "Untitled"}</h3>
                <p>
                  <span>{fmtDate(b.updatedAt || b.createdAt) || "Just now"}</span>
                  {tab === "pub" && <><span className="ic-s"><Heart size={13} />{b.likeCount || 0}</span><span className="ic-s"><MessageCircle size={13} />{b.commentCount || 0}</span></>}
                </p>
              </div>
              <div className="macts">
                {tab === "pub" && <Link className="icon-btn" aria-label="View" to={`/blog/${b.id}`}><Eye size={17} /></Link>}
                <Link className="icon-btn" aria-label="Edit" to={tab === "pub" ? `/editor/post/${b.id}` : `/editor/draft/${b.id}`}><Pencil size={17} /></Link>
                <button className="icon-btn" aria-label="Delete" onClick={() => setAsk({ kind: tab, id: b.id, title: b.title })}><Trash2 size={17} /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Modal open={!!ask} onClose={() => setAsk(null)}>
        <h3>Delete {ask?.kind === "pub" ? "blog" : "draft"}?</h3>
        <p>{ask?.title ? `"${ask.title}" will be removed permanently.` : "This will be removed permanently."} This cannot be undone.</p>
        <div className="inrow"><button className="btn line" onClick={() => setAsk(null)}>Cancel</button><button className="btn danger" onClick={remove}>Delete</button></div>
      </Modal>
    </div>
  );
}
