import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, Link, useLocation } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Compass, Bookmark, PenLine, LogOut, Leaf, Sparkles, Heart } from "lucide-react";
import { auth, google } from "./firebase";
import { Toaster, initial } from "./ui.jsx";
import Chat from "./pages/Chat.jsx";
import Blogs from "./pages/Blogs.jsx";
import BlogView from "./pages/BlogView.jsx";
import MyBlogs from "./pages/MyBlogs.jsx";
import Editor from "./pages/Editor.jsx";

function Login() {
  const [mode, setMode] = useState("in"), [name, setName] = useState(""), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const go = async (fn) => { setErr(""); setBusy(true); try { await fn(); } catch (e) { setErr(e.message.replace("Firebase: ", "")); } setBusy(false); };
  const submit = () => go(async () => {
    if (mode === "in") return signInWithEmailAndPassword(auth, email, pw);
    const c = await createUserWithEmailAndPassword(auth, email, pw);
    if (name.trim()) await updateProfile(c.user, { displayName: name.trim() });
  });
  return (
    <div className="login-page">
      <div className="hero-side">
        <span className="blob" style={{ width: 340, height: 340, top: -80, right: -90 }} />
        <span className="blob" style={{ width: 220, height: 220, bottom: -60, left: 40, animationDelay: "-3s" }} />
        <img className="logo-hero" src="/logo.png" alt="FlavorFusion.AI" />
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>Cook what you have. Share what you make.</motion.h1>
        <p>An AI sous chef that learns your pantry and nutrition goals, then turns the recipe into a blog people can love and save.</p>
        <div className="hero-list">
          <span><Leaf size={18} />Recipes shaped by your ingredients and nutrition goals</span>
          <span><Sparkles size={18} />From chat to published blog in a few clicks</span>
          <span><Heart size={18} />Likes, saves and comments from fellow cooks</span>
        </div>
      </div>
      <div className="form-side">
        <motion.div className="form-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
          <h2>{mode === "in" ? "Welcome back" : "Create your account"}</h2>
          <p className="hint">{mode === "in" ? "Sign in to continue cooking." : "Start generating and sharing recipes."}</p>
          <button className="btn line gbtn" disabled={busy} onClick={() => go(() => signInWithPopup(auth, google))}><span className="g">G</span>Continue with Google</button>
          <div className="divider">or use email</div>
          {mode === "up" && <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />}
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy || !email || !pw} onClick={submit}>{mode === "in" ? "Sign in" : "Create account"}</button>
          <button className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>{mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        </motion.div>
      </div>
    </div>
  );
}

const links = [["/", "Cook", ChefHat], ["/explore", "Explore", Compass], ["/saved", "Saved", Bookmark], ["/my-blogs", "My blogs", PenLine]];

function Shell({ user }) {
  const loc = useLocation();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand" aria-label="FlavorFusion.AI home"><img className="logo-full" src="/logo.png" alt="FlavorFusion.AI" /><img className="logo-icon" src="/icon.png" alt="" /></Link>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"} className="nl">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="pill" className="pill-bg" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="nl-in"><Icon size={16} /><em className="lbl">{label}</em></span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <span className="avatar" title={user.displayName || user.email}>{initial(user)}</span>
          <button className="icon-btn" onClick={() => signOut(auth)} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <Routes location={loc}>
            <Route path="/" element={<Chat user={user} />} />
            <Route path="/explore" element={<Blogs user={user} />} />
            <Route path="/saved" element={<Blogs user={user} saved />} />
            <Route path="/my-blogs" element={<MyBlogs user={user} />} />
            <Route path="/blog/:id" element={<BlogView user={user} />} />
            <Route path="/editor/new" element={<Editor user={user} kind="new" />} />
            <Route path="/editor/import/:id" element={<Editor user={user} kind="import" />} />
            <Route path="/editor/draft/:id" element={<Editor user={user} kind="draft" />} />
            <Route path="/editor/post/:id" element={<Editor user={user} kind="post" />} />
            <Route path="/blogs" element={<Navigate to="/explore" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <Toaster />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="loader-page"><div className="ring"><ChefHat size={26} /></div></div>;
  return user ? <Shell user={user} /> : <Login />;
}
