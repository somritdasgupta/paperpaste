// Simple global refresh emitter using EventTarget
type RefreshHandler = () => void;

const REFRESH_EVENT = "paperpaste-global-refresh";

const emitter = new EventTarget();

export function subscribeToGlobalRefresh(handler: RefreshHandler) {
  const wrapped = (e: Event) => {
    try {
      handler();
    } catch (err) {
      console.error("Global refresh handler error:", err);
    }
  };
  emitter.addEventListener(REFRESH_EVENT, wrapped);
  return () => emitter.removeEventListener(REFRESH_EVENT, wrapped);
}

export function triggerGlobalRefresh() {
  emitter.dispatchEvent(new Event(REFRESH_EVENT));
}

export default emitter;
