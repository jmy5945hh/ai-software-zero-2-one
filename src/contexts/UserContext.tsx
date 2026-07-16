import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { getLocalApiBase } from "../agent/config";

const USER_STORAGE_KEY = "ai-native-dev-user";

export type UserInfo = {
  username: string;
};

type UserContextType = {
  user: UserInfo | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // 应用启动时 warmup：通知后端当前用户，确保 SessionStore 指向正确目录
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return;
    try {
      const info = JSON.parse(stored) as UserInfo;
      fetch(`${getLocalApiBase()}/api/user/me?username=${encodeURIComponent(info.username)}`, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("warmup failed");
          // warmup 成功后通知其他组件（如 useSessionRecords）重新拉取数据
          window.dispatchEvent(new CustomEvent("user:ready"));
        })
        .catch(() => {
          // warmup 失败不阻塞用户，后续 API 会 fallback
        });
    } catch {
      // ignore
    }
  }, []);

  const login = useCallback(async (username: string) => {
    // 调用后端 API 创建用户目录并切换 session store
    const res = await fetch(`${getLocalApiBase()}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "登录失败");
    }
    const data = await res.json();
    const userInfo: UserInfo = { username: data.username };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
    setUser(userInfo);
    // 通知其他组件（如 useSessionRecords）用户已就绪，重新拉取数据
    window.dispatchEvent(new CustomEvent("user:ready"));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
