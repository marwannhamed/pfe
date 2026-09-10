import { Typography, Card, Row, Col } from 'antd';
import { useThemeStore } from '../../store/themeStore';

const { Title, Paragraph } = Typography;

export default function PublicPricingPage() {
  const { t } = useThemeStore();
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px', color: t.text }}>
      <Title level={2} style={{ color: t.text }}>Pricing</Title>
      <Paragraph type="secondary" style={{ color: t.textSub, fontSize: 16 }}>
        Transparent plans for teams of every size. Contact sales for enterprise volume and SLA options.
      </Paragraph>
      <Row gutter={[16, 16]} style={{ marginTop: 32 }}>
        {['Starter', 'Business', 'Enterprise'].map((name, i) => (
          <Col xs={24} md={8} key={name}>
            <Card style={{ background: t.cardBg, borderColor: t.cardBorder }} title={<span style={{ color: t.text }}>{name}</span>}>
              <div style={{ fontSize: 28, fontWeight: 800, color: t.text }}>{['49', '149', 'Custom'][i]} €</div>
              <div style={{ color: t.textMuted, marginBottom: 16 }}>per month / per site</div>
              <Paragraph style={{ color: t.textSub, margin: 0 }}>
                {i === 2
                  ? 'Dedicated support, custom integrations, and on-prem options.'
                  : 'Core lease management, bookings, and billing included.'}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
