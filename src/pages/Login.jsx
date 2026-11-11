import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Clock, Eye, EyeOff } from "lucide-react";
import { auth, google } from "../firebase";
import "./login.css";

// Illustrative sample dishes for the hero (photos live in /public/landing, same as the landing page).
const TABLE = [
  { f: "chingri-malai", n: "Chingri malai curry", c: "Bengali", t: "40 min", k: 360, p: ["prawns", "coconut milk", "onion", "ginger", "garam masala"] },
  { f: "palak-paneer", n: "Palak paneer", c: "North Indian", t: "30 min", k: 410, p: ["spinach", "paneer", "tomato", "garlic", "cream"] },
  { f: "biryani", n: "Hyderabadi biryani", c: "Hyderabadi", t: "1 hr 30", k: 520, p: ["basmati", "chicken", "yoghurt", "saffron", "fried onion"] },
  { f: "paella", n: "Paella Valenciana", c: "Spanish", t: "1 hr", k: 480, p: ["bomba rice", "saffron", "prawns", "green beans", "lemon"] },
  { f: "poha", n: "Kanda poha", c: "Maharashtrian", t: "20 min", k: 290, p: ["flattened rice", "peanuts", "onion", "curry leaves", "lemon"] },
  { f: "mole-poblano", n: "Mole poblano", c: "Mexican", t: "2 hr", k: 540, p: ["chicken", "dried chillies", "dark chocolate", "sesame", "tortillas"] },
];

const friendly = (e) => {
  switch (e.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Check them and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return (e.message || "Something went wrong.").replace("Firebase: ", "");
  }
};

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

// A round photo "plate". Swapping the dish crossfades and settles the photo.
function Plate({ dish, className, delay, reduce }) {
  return (
    <motion.div
      className={"lgn-plate " + className}
      initial={reduce ? false : { opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="lgn-photo">
        <AnimatePresence initial={false}>
          <motion.img
            key={dish.f}
            className="lgn-img"
            src={`/landing/${dish.f}.png`}
            alt=""
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState(params.get("mode") === "up" ? "up" : "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [i, setI] = useState(0);
  const up = mode === "up";

  // The table turns: each dish moves one place along every few seconds.
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % TABLE.length), 6000);
    return () => clearInterval(t);
  }, [reduce]);

  // Warm the cache so swaps never flash an empty plate.
  useEffect(() => {
    TABLE.forEach((d) => { const im = new Image(); im.src = `/landing/${d.f}.png`; });
  }, []);

  const d = TABLE[i];
  const a = TABLE[(i + 1) % TABLE.length];
  const b = TABLE[(i + 2) % TABLE.length];

  const go = async (fn) => {
    setErr("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(friendly(e));
    }
    setBusy(false);
  };

  const submit = () =>
    go(async () => {
      if (!up) return signInWithEmailAndPassword(auth, email, pw);
      const c = await createUserWithEmailAndPassword(auth, email, pw);
      if (name.trim()) await updateProfile(c.user, { displayName: name.trim() });
    });

  const switchMode = (m) => {
    setMode(m);
    setErr("");
  };

  const pop = (delay) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div className="lgn">
      <aside className="lgn-hero">
        <div className="lgn-top-block">
          <img className="lgn-hero-logo" src="/logo-white.png" alt="FlavorFusion.AI" />

          <div className="lgn-hero-copy">
            <h1>Cook what you have. Share what you make.</h1>
            <p>An AI sous chef that learns your pantry and nutrition goals, then turns the recipe into a blog people can love and save.</p>
          </div>

          <div className="lgn-pantry" aria-hidden="true">
            <span className="lgn-have">You have</span>
            <div className="lgn-chips" key={d.f}>
              {d.p.map((p, n) => (
                <motion.span key={p} className="lgn-chip" {...pop(0.15 + n * 0.1)}>{p}</motion.span>
              ))}
            </div>
            <motion.div className="lgn-cap" key={d.n + "-cap"} {...pop(0.15 + d.p.length * 0.1 + 0.1)}>
              <b>{d.n}</b>
              <span>{d.c}<i />{" "}<Clock size={12} />{d.t}<i />{d.k} kcal</span>
            </motion.div>
          </div>
        </div>

        <div className="lgn-table" aria-hidden="true">
          <Plate dish={b} className="b" delay={0.5} reduce={reduce} />
          <Plate dish={a} className="a" delay={0.35} reduce={reduce} />
          <Plate dish={d} className="main" delay={0.15} reduce={reduce} />
        </div>
      </aside>

      <main className="lgn-side">
        <div className="lgn-card">
          <div className="lgn-top">
            <img className="lgn-logo-m" src="/logo.png" alt="FlavorFusion.AI" />
            <Link to="/" className="lgn-back"><ArrowLeft size={15} />Back to home</Link>
          </div>

          <div className="lgn-m-plates" aria-hidden="true">
            {TABLE.slice(0, 3).map((x) => <img key={x.f} src={`/landing/${x.f}.png`} alt="" />)}
          </div>

          <h2>{up ? "Create your account" : "Welcome back"}</h2>
          <p className="lgn-hint">{up ? "Start generating and sharing recipes." : "Sign in to continue cooking."}</p>

          <div className="lgn-seg" data-mode={mode}>
            <span className="lgn-seg-thumb" />
            <button type="button" aria-pressed={!up} onClick={() => switchMode("in")}>Sign in</button>
            <button type="button" aria-pressed={up} onClick={() => switchMode("up")}>Create account</button>
          </div>

          <button type="button" className="btn line lgn-google" disabled={busy} onClick={() => go(() => signInWithPopup(auth, google))}>
            <GoogleG />Continue with Google
          </button>

          <div className="lgn-or"><span>or use email</span></div>

          <form onSubmit={(e) => { e.preventDefault(); if (email && pw && !busy) submit(); }} noValidate>
            <AnimatePresence initial={false}>
              {up && (
                <motion.div
                  key="name"
                  className="lgn-collapse"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="lgn-field">
                    <input id="lgn-name" placeholder=" " autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    <label htmlFor="lgn-name">Your name</label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="lgn-field">
              <input id="lgn-email" type="email" placeholder=" " autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="lgn-email">Email</label>
            </div>

            <div className="lgn-field">
              <input
                id="lgn-pw"
                type={showPw ? "text" : "password"}
                placeholder=" "
                autoComplete={up ? "new-password" : "current-password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <label htmlFor="lgn-pw">Password</label>
              <button type="button" className="lgn-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {err && <p className="lgn-err" role="alert">{err}</p>}

            <button type="submit" className="btn lgn-submit" disabled={busy || !email || !pw}>
              {busy && <span className="lgn-spin" />}
              {busy ? (up ? "Creating account…" : "Signing in…") : up ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}