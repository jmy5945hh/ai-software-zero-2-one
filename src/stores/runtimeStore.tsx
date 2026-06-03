/**
 * RuntimeStore — 运行时状态管理（React Context + useReducer）。
 *
 * 提供：
 * - 模式切换（local / cloud）
 * - 连接状态追踪
 * - 项目 CRUD
 * - 资源指标轮询
 * - 连接器单例管理
 */
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  RuntimeMode,
  ConnectionStatus,
  RuntimeStatus,
  ResourceMetrics,
  AgentProject,
  CreateProjectParams,
} from "../types/runtime";
import type { IRuntimeConnector } from "../types/runtime";
import { switchRuntime } from "../connectors";

// ── State ──────────────────────────────────────

export type RuntimeState = {
  mode: RuntimeMode;
  connectionStatus: ConnectionStatus;
  modelReady: boolean;
  resources: ResourceMetrics;
  projects: AgentProject[];
  /** 正在切换模式时的加载态 */
  switching: boolean;
  /** 错误信息 */
  error: string | null;
};

const initialState: Omit<RuntimeState, "mode"> = {
  connectionStatus: "disconnected",
  modelReady: false,
  resources: { cpu: 0, memory: 0, disk: 0 },
  projects: [],
  switching: false,
  error: null,
};

/** 惰性初始化：在组件挂载时读取 localStorage */
function createInitialState(): RuntimeState {
  const mode = (localStorage.getItem("zero-one-runtime-mode") as RuntimeMode) || "local";
  return { ...initialState, mode };
}

// ── Actions ─────────────────────────────────────

type RuntimeAction =
  | { type: "SET_MODE"; mode: RuntimeMode }
  | { type: "SET_CONNECTION_STATUS"; status: ConnectionStatus }
  | { type: "SET_MODEL_READY"; ready: boolean }
  | { type: "SET_RESOURCES"; resources: ResourceMetrics }
  | { type: "SET_PROJECTS"; projects: AgentProject[] }
  | { type: "ADD_PROJECT"; project: AgentProject }
  | { type: "UPDATE_PROJECT"; id: string; patch: Partial<AgentProject> }
  | { type: "REMOVE_PROJECT"; id: string }
  | { type: "SET_SWITCHING"; switching: boolean }
  | { type: "SET_ERROR"; error: string | null };

function reducer(state: RuntimeState, action: RuntimeAction): RuntimeState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode, switching: false };
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };
    case "SET_MODEL_READY":
      return { ...state, modelReady: action.ready };
    case "SET_RESOURCES":
      return { ...state, resources: action.resources };
    case "SET_PROJECTS":
      return { ...state, projects: action.projects };
    case "ADD_PROJECT":
      return { ...state, projects: [action.project, ...state.projects] };
    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      };
    case "REMOVE_PROJECT":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
      };
    case "SET_SWITCHING":
      return { ...state, switching: action.switching };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────

export type RuntimeActions = {
  switchMode: (mode: RuntimeMode) => Promise<void>;
  refreshProjects: () => Promise<void>;
  createProject: (params: CreateProjectParams) => Promise<AgentProject>;
  deleteProject: (id: string) => Promise<void>;
  startProject: (id: string) => Promise<void>;
  pauseProject: (id: string) => Promise<void>;
};

const RuntimeStateContext = createContext<RuntimeState>(createInitialState());
const RuntimeActionsContext = createContext<RuntimeActions>({
  switchMode: async () => {},
  refreshProjects: async () => {},
  createProject: async () => ({ id: "", name: "", description: "", phase: "draft", mode: "local", progress: 0, lastActivity: "", toolCallCount: 0, fileCount: 0 }),
  deleteProject: async () => {},
  startProject: async () => {},
  pauseProject: async () => {},
});

// ── Provider ────────────────────────────────────

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState());
  const connectorRef = useRef<IRuntimeConnector | null>(null);
  const resourceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 追踪 handler 取消函数，切换模式时清理旧 handler
  const unsubscribesRef = useRef<Array<() => void>>([]);

  /** 清理旧 connector 的 handler 和轮询 */
  const cleanupConnector = useCallback(() => {
    for (const unsub of unsubscribesRef.current) unsub();
    unsubscribesRef.current = [];
    if (resourceIntervalRef.current) {
      clearInterval(resourceIntervalRef.current);
      resourceIntervalRef.current = null;
    }
  }, []);

  /** 建立 connector 连接并注册 handler */
  const setupConnector = useCallback(async (mode: RuntimeMode) => {
    cleanupConnector();
    dispatch({ type: "SET_SWITCHING", switching: true });
    dispatch({ type: "SET_ERROR", error: null });

    try {
      const connector = await switchRuntime(null, mode);
      connectorRef.current = connector;

      unsubscribesRef.current.push(
        connector.onStatusChange((status: RuntimeStatus) => {
          dispatch({ type: "SET_CONNECTION_STATUS", status: status.connected });
          dispatch({ type: "SET_MODEL_READY", ready: status.modelReady });
        }),
      );

      unsubscribesRef.current.push(
        connector.onResourceUpdate((metrics: ResourceMetrics) => {
          dispatch({ type: "SET_RESOURCES", resources: metrics });
        }),
      );

      const projects = await connector.listProjects();
      dispatch({ type: "SET_PROJECTS", projects });

      // 周期性刷新资源（仅在 store 层做，connector 不再重复轮询）
      resourceIntervalRef.current = setInterval(async () => {
        const metrics = await connector.getResources();
        dispatch({ type: "SET_RESOURCES", resources: metrics });
      }, 5000);
    } catch {
      dispatch({ type: "SET_CONNECTION_STATUS", status: "error" });
      dispatch({ type: "SET_ERROR", error: `无法连接到${mode === "local" ? "本地" : "云端"}运行时` });
    } finally {
      dispatch({ type: "SET_SWITCHING", switching: false });
    }
  }, [cleanupConnector]);

  // ── 初始化连接（仅挂载时执行一次）──
  useEffect(() => {
    setupConnector(state.mode);

    return () => {
      cleanupConnector();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 持久化模式到 localStorage ──
  useEffect(() => {
    localStorage.setItem("zero-one-runtime-mode", state.mode);
  }, [state.mode]);

  // ── Actions ──────────────────────────

  const switchMode = useCallback(async (mode: RuntimeMode) => {
    if (mode === state.mode) return;
    dispatch({ type: "SET_MODE", mode });
    await setupConnector(mode);
  }, [state.mode, setupConnector]);

  const refreshProjects = useCallback(async () => {
    if (!connectorRef.current) return;
    const projects = await connectorRef.current.listProjects();
    dispatch({ type: "SET_PROJECTS", projects });
  }, []);

  const createProject = useCallback(async (params: CreateProjectParams) => {
    if (!connectorRef.current) throw new Error("No connector");
    const project = await connectorRef.current.createProject(params);
    dispatch({ type: "ADD_PROJECT", project });
    return project;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    if (!connectorRef.current) throw new Error("No connector");
    await connectorRef.current.deleteProject(id);
    dispatch({ type: "REMOVE_PROJECT", id });
  }, []);

  const startProject = useCallback(async (id: string) => {
    if (!connectorRef.current) throw new Error("No connector");
    await connectorRef.current.startProject(id);
    dispatch({ type: "UPDATE_PROJECT", id, patch: { phase: "running", lastActivity: new Date().toISOString() } });
  }, []);

  const pauseProject = useCallback(async (id: string) => {
    if (!connectorRef.current) throw new Error("No connector");
    await connectorRef.current.pauseProject(id);
    dispatch({ type: "UPDATE_PROJECT", id, patch: { phase: "paused", lastActivity: new Date().toISOString() } });
  }, []);

  const actions: RuntimeActions = {
    switchMode,
    refreshProjects,
    createProject,
    deleteProject,
    startProject,
    pauseProject,
  };

  return (
    <RuntimeStateContext.Provider value={state}>
      <RuntimeActionsContext.Provider value={actions}>
        {children}
      </RuntimeActionsContext.Provider>
    </RuntimeStateContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────

export function useRuntimeState() {
  return useContext(RuntimeStateContext);
}

export function useRuntimeActions() {
  return useContext(RuntimeActionsContext);
}
