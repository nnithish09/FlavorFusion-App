import { Component, useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, Link, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Compass, Bookmark, PenLine, LogOut } from "lucide-react";
import { auth } from "./firebase";
import { Toaster, initial } from "./ui.jsx";
import Chat from "./pages/Chat.jsx";
import Blogs from "./pages/Blogs.jsx";
import BlogView from "./pages/BlogView.jsx";
import MyBlogs from "./pages/MyBlogs.jsx";
import Editor from "./pages/Editor.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";


// Catches render errors so one bad page shows a message instead of a blank white screen.
class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("Render error:", err, info?.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="page">
        <div className="panel">
          <h3>This page hit a problem</h3>
          <p className="hint">{String(this.state.err?.message || this.state.err)}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => this.setState({ err: null })}>Try again</button>
            <button className="btn line" onClick={() => { Object.keys(localStorage).filter((k) => k.startsWith("lastChat")).forEach((k) => localStorage.removeItem(k)); window.location.assign("/"); }}>Start a new chat</button>
          </div>
        </div>
      </div>
    );
  }
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
          <Boundary key={loc.pathname}><Routes location={loc}>
            <Route path="/" element={<Chat user={user} />} />
            <Route path="/explore" element={<Blogs user={user} />} />
            <Route path="/saved" element={<Blogs user={user} saved />} />
            <Route path="/my-blogs" element={<MyBlogs user={user} />} />
            <Route path="/blog/:id" element={<BlogView user={user} />} />
            <Route path="/editor/new" element={<Editor user={user} kind="new" />} />
            <Route path="/editor/import/:id" element={<Editor user={user} kind="import" />} />
            <Route path="/editor/draft/:id" element={<Editor user={user} kind="draft" />} />
            <Route path="/editor/post/:id" element={<Editor user={user} kind="post" />} />
            <Route path="/welcome" element={<Landing user={user} />} />
            <Route path="/blogs" element={<Navigate to="/explore" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes></Boundary>
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
  if (user) return <Shell user={user} />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}