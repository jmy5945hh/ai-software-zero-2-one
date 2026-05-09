import { useState, useEffect, useRef } from "react";

/**
 * 模拟大模型流式输出 —— 逐字打字机效果。
 * @param text      需要逐字输出的完整文本
 * @param speed     每个字符之间的毫秒间隔（越小越快）
 * @param startDelay 开始输出前的延迟
 */
export function useTypewriter(text: string, speed = 35, startDelay = 400) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 重置
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    // 清理之前的定时器
    if (timerRef.current) clearTimeout(timerRef.current);

    const tick = () => {
      if (indexRef.current < text.length) {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));
        // 遇到标点稍微停顿一下，模拟思考
        const ch = text[indexRef.current - 1];
        const extraPause = "，。！？；：\n".includes(ch) ? 120 : 0;
        timerRef.current = setTimeout(tick, speed + extraPause);
      } else {
        setDone(true);
      }
    };

    const startTimer = setTimeout(tick, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, speed, startDelay]);

  return { text: displayed, done } as const;
}

/**
 * 逐条展示列表项，每条之间有一定间隔，模拟 Agent 逐步完成。
 */
export function useStreamingList(items: string[], speed = 800) {
  const [visible, setVisible] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    setVisible([]);
    setAllDone(false);
    let i = 0;

    const timer = setInterval(() => {
      if (i < items.length) {
        setVisible(items.slice(0, i + 1));
        i += 1;
      } else {
        setAllDone(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items 每次传进来都是新数组引用
  }, [items.join(","), speed]);

  return { items: visible, allDone };
}

/**
 * 带淡入 + 逐字输出的文本组件。
 * 直接渲染文本，不负责包裹容器。
 */
export function StreamText({ text, speed }: { text: string; speed?: number }) {
  const { text: displayed, done } = useTypewriter(text, speed);
  return (
    <>
      {displayed}
      {!done && <span className="cursor-blink" />}
    </>
  );
}

/**
 * 返回一个 key 用于在切换步骤时触发重新流式输出。
 * 当 stepIndex 变化时，所有使用该 hook 的 StreamingText 都会重新播放入场动画。
 */
export function useStepKey(stepIndex: number) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    setKey((k) => k + 1);
  }, [stepIndex]);
  return key;
}
