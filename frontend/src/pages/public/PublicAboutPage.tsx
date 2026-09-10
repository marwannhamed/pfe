import { Typography } from 'antd';
import { useThemeStore } from '../../store/themeStore';

const { Title, Paragraph } = Typography;

export default function PublicAboutPage() {
  const { t } = useThemeStore();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: t.text }}>
      <Title level={2} style={{ color: t.text }}>About LeaseManager</Title>
      <Paragraph style={{ color: t.textSub, fontSize: 16, lineHeight: 1.7 }}>
        LeaseManager helps operators and tenants run office leases in one place: sites and spaces,
        bookings and approvals, contracts, invoices, and maintenance — with clear roles for every user.
      </Paragraph>
      <Paragraph style={{ color: t.textSub, fontSize: 16, lineHeight: 1.7 }}>
        Built for modern workplaces, from single buildings to multi-site portfolios.
      </Paragraph>
    </div>
  );
}
