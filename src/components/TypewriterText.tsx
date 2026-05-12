import { useState, useEffect, useRef } from "react";

type TypewriterTextProps = {
  text: string;
  /** 每字间隔 (ms) */
  speed?: number;
  /** 开始前延迟 (ms) */
  startDelay?: number;
  /** 完成后是否保持光标闪烁 */
  showCursor?: boolean;
  className?: string;
};

/**
 * 打字机效果文本 —— 逐字输出，支持光标闪烁。
 * 光标始终占据布局空间，通过 CSS opacity 动画闪烁，避免布局跳动。
 */
export function TypewriterText({
  text,
  speed = 80,
  startDelay = 400,
  showCursor = true,
  className,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 逐字输出
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      timerRef.current = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));

        if (indexRef.current >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsTypingDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(delayTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed, startDelay]);

  return (
    <span className={className} style={{ whiteSpace: "nowrap" }}>
      {displayed}
      {showCursor && (
        <span
          className={`typewriter-cursor${isTypingDone ? " blink" : ""}`}
        />
      )}
    </span>
  );
}
