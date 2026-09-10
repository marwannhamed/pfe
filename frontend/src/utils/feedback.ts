/**
 * Context-aware Ant Design message / notification / modal APIs.
 * Bound by AntdFeedbackBridge inside <App>; falls back to static APIs before mount.
 */
import {
  message as staticMessage,
  notification as staticNotification,
  Modal as StaticModal,
} from 'antd';
import { App } from 'antd';

type AppApis = ReturnType<typeof App.useApp>;

let apis: AppApis | null = null;

export function bindAntdFeedback(next: AppApis) {
  apis = next;
}

function proxyApi<T extends object>(getBound: () => T | undefined, fallback: T): T {
  return new Proxy(fallback, {
    get(_target, prop) {
      const api = getBound() ?? fallback;
      const val = (api as Record<string | symbol, unknown>)[prop];
      return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(api) : val;
    },
  }) as T;
}

export const message = proxyApi(() => apis?.message, staticMessage);
export const notification = proxyApi(() => apis?.notification, staticNotification);

/** Static modal dialogs (use instead of `Modal.confirm` from antd). */
export const modal = {
  confirm: (...args: Parameters<typeof StaticModal.confirm>) =>
    (apis?.modal ?? StaticModal).confirm(...args),
  info: (...args: Parameters<typeof StaticModal.info>) =>
    (apis?.modal ?? StaticModal).info(...args),
  success: (...args: Parameters<typeof StaticModal.success>) =>
    (apis?.modal ?? StaticModal).success(...args),
  error: (...args: Parameters<typeof StaticModal.error>) =>
    (apis?.modal ?? StaticModal).error(...args),
  warning: (...args: Parameters<typeof StaticModal.warning>) =>
    (apis?.modal ?? StaticModal).warning(...args),
};
