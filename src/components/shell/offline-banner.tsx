"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { OFFLINE_MESSAGE } from "@/lib/client-api";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
const RECONNECTED_DURATION = 4000;

/** Always mounted, so a lost connection and its return are announced once each. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [reconnected, setReconnected] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      clearTimeout(timer);
      setReconnected(true);
      timer = setTimeout(() => setReconnected(false), RECONNECTED_DURATION);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setReconnected(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return (
    <div className="connection-banner-region" role="status">
      {!online ? (
        <p className="connection-banner is-offline">
          <WifiOff size={17} aria-hidden="true" />
          <span>{OFFLINE_MESSAGE}</span>
        </p>
      ) : (
        reconnected && (
          <p className="connection-banner is-online">
            <Wifi size={17} aria-hidden="true" />
            <span>인터넷에 다시 연결되었습니다.</span>
          </p>
        )
      )}
    </div>
  );
}
