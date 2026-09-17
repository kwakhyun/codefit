"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";

type ResultEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const subscribe = () => () => {};
function constructor() {
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
/** Only finalized phrases are appended; typing and earlier answers are never replaced. */
export function VoiceInput({
  targetId,
  disabled = false,
  onTranscript,
}: {
  targetId: string;
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  return disabled ? null : <ActiveVoiceInput targetId={targetId} onTranscript={onTranscript} />;
}
function ActiveVoiceInput({
  targetId,
  onTranscript,
}: {
  targetId: string;
  onTranscript: (text: string) => void;
}) {
  const supported = useSyncExternalStore(
    subscribe,
    () => Boolean(constructor()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef<Recognition | null>(null);
  const timeout = useRef<number | undefined>(undefined);
  const receive = useRef(onTranscript);
  useLayoutEffect(() => {
    receive.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    const abort = () => {
      const recognition = active.current;
      active.current = null;
      window.clearTimeout(timeout.current);
      recognition?.abort();
    };
    const hide = () => {
      if (document.hidden) {
        abort();
        setListening(false);
        setMessage("음성 입력을 종료했어요.");
      }
    };
    const stopOther = () => {
      if (active.current) {
        abort();
        setListening(false);
        setMessage("다른 입력란에서 음성 입력을 시작했어요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("codefit:voice-start", stopOther);
    return () => {
      abort();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("codefit:voice-start", stopOther);
    };
  }, []);
  function start() {
    const Speech = constructor();
    if (!Speech || active.current) return;
    window.dispatchEvent(new Event("codefit:voice-start"));
    const recognition = new Speech();
    active.current = recognition;
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    const consumed = new Set<number>();
    const timer = window.setTimeout(() => recognition.stop(), 60_000);
    timeout.current = timer;
    recognition.onresult = (event) => {
      if (active.current !== recognition) return;
      const words: string[] = [];
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && !consumed.has(i)) {
          consumed.add(i);
          words.push(result[0].transcript.trim());
        } else if (!result.isFinal) interim += result[0].transcript;
      }
      if (words.length) receive.current(words.join(" "));
      setMessage(
        interim ? `듣고 있어요: ${interim}` : "인식한 내용을 추가했어요. 계속 말씀하세요.",
      );
    };
    recognition.onerror = ({ error }) => {
      if (active.current !== recognition) return;
      setMessage(
        error === "not-allowed" || error === "service-not-allowed"
          ? "마이크 사용이 허용되지 않았어요. 브라우저 권한을 확인하거나 직접 입력해 주세요."
          : error === "no-speech"
            ? "목소리를 듣지 못했어요. 다시 시도해 주세요."
            : error === "audio-capture"
              ? "마이크를 찾지 못했어요. 연결을 확인해 주세요."
              : "음성 인식이 중단됐어요. 입력한 내용은 그대로 남아 있어요.",
      );
      active.current = null;
      window.clearTimeout(timer);
      recognition.abort();
      setListening(false);
    };
    recognition.onend = () => {
      window.clearTimeout(timer);
      if (active.current !== recognition) return;
      active.current = null;
      setListening(false);
      setMessage("음성 입력을 마쳤어요. 내용을 확인하고 수정해 주세요.");
      document.getElementById(targetId)?.focus();
    };
    try {
      recognition.start();
      setListening(true);
      setMessage("듣고 있어요. 최대 1분 동안 말씀해 주세요.");
    } catch {
      active.current = null;
      window.clearTimeout(timer);
      setListening(false);
      setMessage("음성 입력을 시작하지 못했어요. 다시 시도하거나 직접 입력해 주세요.");
    }
  }
  return (
    <div className="voice-input">
      <button
        type="button"
        className="secondary-button"
        disabled={!supported}
        aria-controls={targetId}
        aria-pressed={listening}
        onClick={() => (listening ? active.current?.stop() : start())}
      >
        {listening ? <Square size={15} /> : <Mic size={16} />}
        {listening ? "음성 입력 마치기" : "음성으로 입력"}
      </button>
      <small>
        {supported
          ? "음성은 브라우저의 음성 인식 서비스에서 처리될 수 있습니다."
          : "이 브라우저는 음성 입력을 지원하지 않습니다. 직접 입력해 주세요."}
      </small>
      <p role="status">{message}</p>
    </div>
  );
}
