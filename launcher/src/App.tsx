import { AccountsModal } from "./components/AccountsModal";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { Client } from "./pages/Client";
import { Console } from "./pages/Console";
import { Home } from "./pages/Home";
import { Instances } from "./pages/Instances";
import { Mods } from "./pages/Mods";
import { Settings } from "./pages/Settings";
import { useStore } from "./store";

export function App() {
  const { boot, page, accountsOpen } = useStore();
  return (
    <div className="app">
      <div className="backdrop-glow" />
      <TitleBar />
      <div className="body">
        <Sidebar />
        <main className="content">
          {!boot ? (
            <div className="boot"><span className="boot-bar" /></div>
          ) : (
            <div className="page-anim" key={page}>
              {page === "home" && <Home />}
              {page === "instances" && <Instances />}
              {page === "mods" && <Mods />}
              {page === "client" && <Client />}
              {page === "console" && <Console />}
              {page === "settings" && <Settings />}
            </div>
          )}
        </main>
      </div>
      {accountsOpen && <AccountsModal />}
      <Toasts />
    </div>
  );
}
