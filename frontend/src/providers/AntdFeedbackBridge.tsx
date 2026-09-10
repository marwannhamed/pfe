import { App } from 'antd';
import { useEffect } from 'react';
import { bindAntdFeedback } from '../utils/feedback';

/** Binds App.useApp() APIs so `utils/feedback` message/notification/Modal use theme context. */
export default function AntdFeedbackBridge() {
  const appApis = App.useApp();

  useEffect(() => {
    bindAntdFeedback(appApis);
  }, [appApis]);

  return null;
}
