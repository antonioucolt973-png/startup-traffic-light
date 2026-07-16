import { LogIn, LogOut, Mail, UserRound, X } from "lucide-react";
import { useState } from "react";
import type { CloudSession } from "../lib/cloud";

interface AccountMenuProps {
  session: CloudSession;
  syncState: string;
  onRequestSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountMenu({ session, syncState, onRequestSignIn, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function submit() {
    if (!email.includes("@")) {
      setStatus("请输入有效邮箱。");
      return;
    }
    try {
      await onRequestSignIn(email);
      setStatus("登录链接已发送，请检查邮箱。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登录请求失败。");
    }
  }

  return (
    <div className="accountMenu">
      <button className="accountTrigger" type="button" onClick={() => setOpen((value) => !value)}>
        {session.user ? <UserRound size={16} /> : <LogIn size={16} />}
        <span>账号</span>
      </button>
      {open && (
        <section className="accountPopover">
          <header><strong>{session.user ? "项目账号" : "保存你的创业路线"}</strong><button type="button" onClick={() => setOpen(false)} aria-label="关闭账号面板"><X size={16} /></button></header>
          {session.user ? (
            <>
              <p>{session.user.email}</p>
              <span>{syncState}</span>
              <button className="accountAction" type="button" onClick={() => void onSignOut()}><LogOut size={15} />退出登录</button>
            </>
          ) : session.enabled ? (
            <>
              <p>游客可以直接体验；登录后可跨设备保存项目、问卷和证据。</p>
              <label><Mail size={15} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="你的邮箱" /></label>
              <button className="accountAction primary" type="button" onClick={() => void submit()}>发送登录链接</button>
              {status && <span>{status}</span>}
            </>
          ) : (
            <><p>当前项目会自动保存在这个浏览器中。更换设备、清理浏览器数据后将无法恢复。</p><span>比赛演示阶段不需要登录。</span></>
          )}
        </section>
      )}
    </div>
  );
}
