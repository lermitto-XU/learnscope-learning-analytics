import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  Network,
  Route as RouteIcon,
  ChartNoAxesCombined,
  ClipboardCheck,
  LogOut,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  BookOpen,
  Settings2,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { api, setCsrf } from "./api";
import { DataProvider } from "./state";
import type { User } from "./types";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const GraphPage = lazy(() => import("./pages/Graph"));
const PathPage = lazy(() => import("./pages/Path"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Detail = lazy(() => import("./pages/Detail"));
const Assessment = lazy(() => import("./pages/Assessment"));
const About = lazy(() => import("./pages/About"));
const Manage = lazy(() => import("./pages/Manage"));
const links = [
  { path: "/", label: "学习总览", icon: LayoutDashboard },
  { path: "/graph", label: "知识图谱", icon: Network },
  { path: "/paths", label: "路径规划", icon: RouteIcon },
  { path: "/analysis", label: "分析与预测", icon: ChartNoAxesCombined },
  { path: "/assessment", label: "诊断测验", icon: ClipboardCheck },
];
function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Network size={25} />
      </div>
      <div>
        <strong>知序</strong>
        <span>LearnScope</span>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const boot = async () => {
    setLoading(true);
    setBootError("");
    try {
      const session = await api<{ user: User; csrf: string }>("/auth/me");
      setCsrf(session.csrf);
      setUser(session.user);
    } catch (e) {
      if (!(e instanceof Error && "status" in e && e.status === 401))
        setBootError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void boot();
    const expired = () => {
      setCsrf("");
      setUser(undefined);
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const logout = async () => {
    try {
      await api("/auth/logout", {});
      setCsrf("");
      setUser(undefined);
      navigate("/");
    } catch (e) {
      setBootError((e as Error).message);
    }
  };
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <span className="spinner" />
        正在准备学习空间…
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(u, csrf) => {
          setCsrf(csrf);
          setUser(u);
          navigate("/");
        }}
        bootError={bootError}
      />
    );
  const label =
    links.find((l) => l.path === location.pathname)?.label ||
    (location.pathname.startsWith("/knowledge")
      ? "知识详情"
      : location.pathname === "/about"
        ? "项目说明"
        : "知识库管理");
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">LEARNING WORKSPACE</div>
        <nav>
          {links.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={19} />
              <span>{label}</span>
              {path === "/analysis" && <span className="nav-badge">LAB</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <FlaskConical size={21} />
            <strong>让学习决策有据可循</strong>
            <p>从知识结构到学习证据，探索你的下一步。</p>
            <NavLink to="/about">
              了解项目 <ArrowRight size={14} />
            </NavLink>
          </div>
          {user.role !== "STUDENT" && (
            <NavLink className="bottom-link" to="/manage">
              <Settings2 size={18} />
              知识库管理
            </NavLink>
          )}
          <button
            className="user-block"
            onClick={() => void logout()}
            title="退出登录"
          >
            <span className="avatar">{user.displayName.slice(0, 1)}</span>
            <span>
              <strong>{user.displayName}</strong>
              <small>
                {user.role === "STUDENT"
                  ? "学习者"
                  : user.role === "TEACHER"
                    ? "教师"
                    : "管理员"}
              </small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="打开导航"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              学习空间 <span>/</span> <strong>{label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="course-label">
              <BookOpen size={16} />
              数据结构与算法
              <ChevronDown size={14} />
            </span>
            <span className="demo-label">
              <i />
              演示课程
            </span>
          </div>
        </header>
        <main>
          <DataProvider key={user.id} user={user}>
            <Suspense
              fallback={
                <div className="loading">
                  <span className="spinner" />
                  正在加载…
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/paths" element={<PathPage />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/knowledge/:id" element={<Detail />} />
                <Route path="/assessment" element={<Assessment />} />
                <Route path="/about" element={<About />} />
                <Route path="/manage" element={<Manage />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>这个页面还不存在</h1>
                      <NavLink to="/">返回学习总览</NavLink>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </DataProvider>
        </main>
        <footer>
          LearnScope · 知识分析与预测{" "}
          <span>以证据理解学习，以结构规划进步</span>
        </footer>
      </div>
      {bootError && (
        <div className="toast" role="alert">
          {bootError}
        </div>
      )}
    </div>
  );
}

function Login({
  onLogin,
  bootError,
}: {
  onLogin: (user: User, csrf: string) => void;
  bootError: string;
}) {
  const [username, setUsername] = useState("student");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(bootError);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    void api<{ demo: boolean }>("/health")
      .then((data) => setDemo(data.demo))
      .catch(() => setError("暂时无法连接后端，请检查服务是否启动"));
  }, []);
  const signIn = async (name: string, pass: string) => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: User; csrf: string }>("/auth/login", {
        username: name,
        password: pass,
      });
      onLogin(data.user, data.csrf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!register) {
      await signIn(username, password);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/register", { username, displayName, password });
      await signIn(username, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand />
        <span className="login-kicker">KNOWLEDGE, CONNECTED.</span>
        <h1>
          看见知识的联系。
          <br />
          找到学习的方向。
        </h1>
        <p>
          知识图谱、学习证据与个性化路径，
          <br />
          让每一次学习都有清晰的下一步。
        </p>
        <div className="login-network" aria-hidden="true">
          <svg viewBox="0 0 520 280">
            <g stroke="#7195dd" strokeOpacity=".35" strokeWidth="2">
              <path d="M60 140 175 65 315 110 445 50M60 140 200 220 315 110 420 225M175 65 200 220M315 110 445 50" />
            </g>
            {[
              [60, 140],
              [175, 65],
              [200, 220],
              [315, 110],
              [445, 50],
              [420, 225],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={i === 3 ? 31 : 23}
                  fill={i === 3 ? "#507efe" : "#263e65"}
                  stroke="#779dff"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                >
                  {["基础", "结构", "证据", "理解", "进阶", "目标"][i]}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="login-caption">
          一个围绕知识分析与预测构建的学习实验室
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <div className="eyebrow">WELCOME TO LEARNSCOPE</div>
          <h2>{register ? "创建学习账号" : "进入你的学习空间"}</h2>
          <p>
            {register
              ? "从一次诊断开始，逐步建立自己的学习证据。"
              : "继续探索，让知识逐渐连成一张网。"}
          </p>
          <form onSubmit={submit}>
            <label>
              用户名
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern={register ? "[a-zA-Z0-9_]{3,32}" : undefined}
                autoComplete="username"
              />
            </label>
            {register && (
              <label>
                显示名称
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={64}
                />
              </label>
            )}
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={register ? 10 : undefined}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "至少 10 个字符" : "请输入密码"}
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy ? (
                <RefreshCw size={17} className="spin" />
              ) : (
                <>
                  {register ? "注册并进入" : "登录学习空间"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <button
            className="text-button wide"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "已有账号？返回登录" : "还没有账号？创建账号"}
          </button>
          {demo && !register && (
            <div className="demo-entry">
              <div>
                <span>作品集演示</span>
                <small>可直接体验，初始学习记录为合成数据</small>
              </div>
              <div className="demo-buttons">
                <button
                  disabled={busy}
                  onClick={() => void signIn("student", "LearnScope2026!")}
                >
                  体验学习者 <ArrowRight size={14} />
                </button>
                <button
                  disabled={busy}
                  onClick={() => void signIn("teacher", "LearnScope2026!")}
                >
                  体验教师 <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="login-foot">
            <FlaskConical size={15} />
            探索性预测仅作为学习参考
          </div>
        </div>
      </section>
    </div>
  );
}
