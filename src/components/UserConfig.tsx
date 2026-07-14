import { Settings2, X, LogOut } from "lucide-react";
import { useUser } from "../contexts/UserContext";

/**
 * 用户配置弹窗
 */
export function UserConfigModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useUser();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-config-header">
          <Settings2 size={18} />
          <span>用户设置</span>
          <button className="user-config-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="user-config-body">
          <div className="user-config-user">
            <strong>当前用户</strong>
            <span>{user?.username}</span>
          </div>
        </div>

        <div className="user-config-footer">
          <button
            className="user-config-logout-btn"
            type="button"
            onClick={() => { logout(); onClose(); }}
          >
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 用户信息按钮 — 显示在右上角
 */
export function UserMenu({ onOpenConfig }: { onOpenConfig: () => void }) {
  const { user } = useUser();
  if (!user) return null;

  return (
    <button
      className="user-menu-btn"
      type="button"
      onClick={onOpenConfig}
      title="用户设置"
    >
      <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
      <span className="user-name">{user.username}</span>
    </button>
  );
}
