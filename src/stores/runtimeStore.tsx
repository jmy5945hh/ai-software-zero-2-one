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
  EndpointStatus,
  RuntimeStatus,
  ResourceMetrics,
  AgentProject,
  CreateProjectParams,
} from "../types/runtime";
import { RUNTIME_MODE_KEY } from "../types/runtime";
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
  /** 本地端点连接状态 */
  localEndpoint: EndpointStatus;
  /** 云端端点连接状态 */
  cloudEndpoint: EndpointStatus;
};

const initialState: Omit<RuntimeState, "mode"> = {
  connectionStatus: "disconnected",
  modelReady: false,
  resources: { cpu: 0, memory: 0, disk: 0 },
  projects: [],
  switching: false,
  error: null,
  localEndpoint: { connectionStatus: "disconnected", latency: 0 },
  cloudEndpoint: { connectionStatus: "disconnected", latency: 0 },
};

/** 惰性初始化：在组件挂载时读取 localStorage */
function createInitialState(): RuntimeState {
  const mode = (localStorage.getItem(RUNTIME_MODE_KEY) as RuntimeMode) || "local";
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
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_ENDPOINT_STATUS"; endpoint: RuntimeMode; status: EndpointStatus };

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
    case "SET_ENDPOINT_STATUS":
      return {
        ...state,
        [action.endpoint === "local" ? "localEndpoint" : "cloudEndpoint"]: action.status,
      };
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
  const localConnectorRef = useRef<IRuntimeConnector | null>(null);
  const cloudConnectorRef = useRef<IRuntimeConnector | null>(null);
  const unsubscribesRef = useRef<Array<() => void>>([]);
  const mountedRef = useRef(true);
  const heartbeatRefs = useRef<{ local: ReturnType<typeof setInterval> | null; cloud: ReturnType<typeof setInterval> | null }>({ local: null, cloud: null });

  /** 对指定端点发送心跳请求并更新延迟 */
  const heartbeat = useCallback(async (endpoint: RuntimeMode) => {
    const connector = endpoint === "local" ? localConnectorRef.current : cloudConnectorRef.current;
    if (!connector || !mountedRef.current) return;
    const start = Date.now();
    try {
      const status = await connector.getStatus();
      const latency = Date.now() - start;
      if (!mountedRef.current) return;
      dispatch({
        type: "SET_ENDPOINT_STATUS",
        endpoint,
        status: { connectionStatus: status.connected, latency },
      });
      if (endpoint === state.mode) {
        dispatch({ type: "SET_CONNECTION_STATUS", status: status.connected });
        dispatch({ type: "SET_MODEL_READY", ready: status.modelReady });
      }
    } catch {
      if (!mountedRef.current) return;
      dispatch({
        type: "SET_ENDPOINT_STATUS",
        endpoint,
        status: { connectionStatus: "error", latency: 0 },
      });
      if (endpoint === state.mode) {
        dispatch({ type: "SET_CONNECTION_STATUS", status: "error" });
      }
    }
  }, [state.mode]);

  /** 为指定端点建立连接器 */
  const setupEndpoint = useCallback(async (mode: RuntimeMode) => {
    const targetRef = mode === "local" ? localConnectorRef : cloudConnectorRef;

    dispatch({
      type: "SET_ENDPOINT_STATUS",
      endpoint: mode,
      status: { connectionStatus: "connecting", latency: 0 },
    });
    if (mode === state.mode) {
      dispatch({ type: "SET_CONNECTION_STATUS", status: "connecting" });
    }

    try {
      const connector = await switchRuntime(mode);
      if (!mountedRef.current) { connector.disconnect(); return; }
      targetRef.current = connector;

      unsubscribesRef.current.push(
        connector.onStatusChange((status: RuntimeStatus) => {
          if (!mountedRef.current) return;
          dispatch({
            type: "SET_ENDPOINT_STATUS",
            endpoint: mode,
            status: {
              connectionStatus: status.connected,
              latency: mode === "local" ? state.localEndpoint.latency : state.cloudEndpoint.latency,
            },
          });
          if (mode === state.mode) {
            dispatch({ type: "SET_CONNECTION_STATUS", status: status.connected });
            dispatch({ type: "SET_MODEL_READY", ready: status.modelReady });
          }
        }),
      );

      unsubscribesRef.current.push(
        connector.onResourceUpdate((metrics: ResourceMetrics) => {
          if (!mountedRef.current || mode !== state.mode) return;
          dispatch({ type: "SET_RESOURCES", resources: metrics });
        }),
      );

      if (mode === state.mode) {
        const projects = await connector.listProjects();
        if (!mountedRef.current) return;
        dispatch({ type: "SET_PROJECTS", projects });
      }

      await heartbeat(mode);

      if (heartbeatRefs.current[mode]) clearInterval(heartbeatRefs.current[mode]);
      heartbeatRefs.current[mode] = setInterval(() => heartbeat(mode), 5000);
    } catch (err) {
      if (targetRef.current) { targetRef.current.disconnect(); targetRef.current = null; }
      dispatch({
        type: "SET_ENDPOINT_STATUS",
        endpoint: mode,
        status: { connectionStatus: "error", latency: 0 },
      });
      if (mode === state.mode) {
        dispatch({ type: "SET_CONNECTION_STATUS", status: "error" });
        dispatch({ type: "SET_ERROR", error: `无法连接到${mode === "local" ? "本地" : "云端"}运行时` });
      }
    }
  }, [state.mode, state.localEndpoint.latency, state.cloudEndpoint.latency, heartbeat]);

  // ── 初始化：同时连接本地和云端 ──
  useEffect(() => {
    mountedRef.current = true;
    setupEndpoint("local");
    setupEndpoint("cloud");

    return () => {
      mountedRef.current = false;
      for (const unsub of unsubscribesRef.current) unsub();
      unsubscribesRef.current = [];
      localConnectorRef.current?.disconnect();
      cloudConnectorRef.current?.disconnect();
      localConnectorRef.current = null;
      cloudConnectorRef.current = null;
      if (heartbeatRefs.current.local) clearInterval(heartbeatRefs.current.local);
      if (heartbeatRefs.current.cloud) clearInterval(heartbeatRefs.current.cloud);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 持久化模式到 localStorage ──
  useEffect(() => {
    localStorage.setItem(RUNTIME_MODE_KEY, state.mode);
  }, [state.mode]);

  /** 获取当前活跃模式的连接器 */
  const getCurrentConnector = useCallback((): IRuntimeConnector | null => {
    return state.mode === "local" ? localConnectorRef.current : cloudConnectorRef.current;
  }, [state.mode]);

  // ── Actions ──────────────────────────

  const switchMode = useCallback(async (mode: RuntimeMode) => {
    if (mode === state.mode) return;
    dispatch({ type: "SET_SWITCHING", switching: true });
    dispatch({ type: "SET_ERROR", error: null });
    const targetConnector = mode === "local" ? localConnectorRef.current : cloudConnectorRef.current;
    if (targetConnector) {
      try {
        const status = await targetConnector.getStatus();
        if (mountedRef.current) {
          dispatch({ type: "SET_CONNECTION_STATUS", status: status.connected });
          dispatch({ type: "SET_MODEL_READY", ready: status.modelReady });
          const projects = await targetConnector.listProjects();
          dispatch({ type: "SET_PROJECTS", projects });
        }
      } catch {
        await setupEndpoint(mode);
      }
    } else {
      await setupEndpoint(mode);
    }
    dispatch({ type: "SET_MODE", mode });
    dispatch({ type: "SET_SWITCHING", switching: false });
  }, [state.mode, setupEndpoint]);

  const refreshProjects = useCallback(async () => {
    const connector = getCurrentConnector();
    if (!connector) return;
    const projects = await connector.listProjects();
    dispatch({ type: "SET_PROJECTS", projects });
  }, [getCurrentConnector]);

  const createProject = useCallback(async (params: CreateProjectParams) => {
    const connector = getCurrentConnector();
    if (!connector) throw new Error("No connector");
    const project = await connector.createProject(params);
    dispatch({ type: "ADD_PROJECT", project });
    return project;
  }, [getCurrentConnector]);

  const deleteProject = useCallback(async (id: string) => {
    const connector = getCurrentConnector();
    if (!connector) throw new Error("No connector");
    await connector.deleteProject(id);
    dispatch({ type: "REMOVE_PROJECT", id });
  }, [getCurrentConnector]);

  const startProject = useCallback(async (id: string) => {
    const connector = getCurrentConnector();
    if (!connector) throw new Error("No connector");
    await connector.startProject(id);
    dispatch({ type: "UPDATE_PROJECT", id, patch: { phase: "running", lastActivity: new Date().toISOString() } });
  }, [getCurrentConnector]);

  const pauseProject = useCallback(async (id: string) => {
    const connector = getCurrentConnector();
    if (!connector) throw new Error("No connector");
    await connector.pauseProject(id);
    dispatch({ type: "UPDATE_PROJECT", id, patch: { phase: "paused", lastActivity: new Date().toISOString() } });
  }, [getCurrentConnector]);

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
