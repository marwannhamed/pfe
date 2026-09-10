import { useEffect } from 'react';
import { App, ConfigProvider, theme as antdTheme } from 'antd';
import { useThemeStore } from '../store/themeStore';
import AntdFeedbackBridge from './AntdFeedbackBridge';

/**
 * Applies Ant Design dark/light algorithm globally and syncs document/body
 * so non-Ant areas (inline styles, public layout) match the selected theme.
 */
export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark);
  const t = useThemeStore((s) => s.t);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = t.pageBg;
    document.body.style.color = t.text;
  }, [isDark, t]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgLayout: t.pageBg,
          colorBgContainer: t.cardBg,
          colorBorder: t.cardBorder,
          colorBorderSecondary: t.divider,
          colorText: t.text,
          colorTextSecondary: t.textSub,
          colorTextTertiary: t.textMuted,
          colorSplit: t.divider,
        },
        components: {
          Card: {
            colorBgContainer: t.cardBg,
          },
          Table: {
            colorBgContainer: t.cardBg,
            headerBg: isDark ? '#0f172a' : t.tableHead,
            headerColor: t.textSub,
          },
          Layout: {
            bodyBg: t.pageBg,
            headerBg: t.topbar,
            siderBg: '#0f172a',
          },
          Modal: {
            contentBg: t.cardBg,
            headerBg: t.cardBg,
          },
        },
      }}
    >
      <App>
        <AntdFeedbackBridge />
        {children}
      </App>
    </ConfigProvider>
  );
}
