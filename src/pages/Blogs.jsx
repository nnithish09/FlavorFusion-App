import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, getDoc, doc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Search, Bookmark, Compass } from "lucide-react";
import { db } from "../firebase";
import { initial } from "../ui";

function BlogCard({ b, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.4 }}>
      <Link to={`/blog/${b.id}`} className="bcard">
        <div className="bthumb skel"><img loading="lazy" src={b.thumbnail} alt="" /></div>
        <div className="bbody">
          {b.tags?.length > 0 && <div className="tags">{b.tags.slice(0, 2).map((t) => <span key={t} className="tag hot">{t}</span>)}</div>}
          <h3>{b.title}</h3>
          <p className="bmeta"><span className="avatar sm">{initial(b.authorName)}</span>{b.authorName}<span className="sp" /><Heart size={14} />{b.likeCount || 0}<MessageCircle size={14} />{b.commentCount || 0}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Blogs({ user, saved }) {
  const [list, setList] = useState(null), [q, setQ] = useState("");
  useEffect(() => {
    setList(null);
    if (!saved) return onSnapshot(query(collection(db, "blogs"), orderBy("createdAt", "desc")), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return onSnapshot(collection(db, "users", user.uid, "saves"), async (s) => {
      const docs = await Promise.all(s.docs.map((d) => getDoc(doc(db, "blogs", d.id))));
      setList(docs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [saved, user.uid]);
  const shown = (list || []).filter((b) => `${b.title} ${(b.tags || []).join(" ")} ${b.authorName}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <div className="ph">
        <div><h1>{saved ? "Saved recipes" : "Explore"}</h1><p>{saved ? "Everything you bookmarked, in one place." : "Recipes and stories from the community."}</p></div>
        <div className="search"><Search size={16} /><input placeholder="Search by title, tag or author" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {list === null ? (
        <div className="grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="bcard"><div className="bthumb skel" /><div className="bbody"><div className="skel" style={{ height: 18, borderRadius: 8 }} /><div className="skel" style={{ height: 14, width: "60%", borderRadius: 8 }} /></div></div>)}</div>
      ) : shown.length ? (
        <div className="grid">{shown.map((b, i) => <BlogCard key={b.id} b={b} i={i} />)}</div>
      ) : (
        <div className="empty"><div className="ic">{saved ? <Bookmark size={26} /> : <Compass size={26} />}</div><h3>{q ? "No matches" : saved ? "Nothing saved yet" : "No blogs yet"}</h3><p>{q ? "Try a different search." : saved ? "Tap Save on any blog to keep it here." : "Cook something with the assistant and post it."}</p></div>
      )}
    </div>
  );
}
