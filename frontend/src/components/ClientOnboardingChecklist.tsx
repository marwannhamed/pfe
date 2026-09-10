import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  CheckCircleOutlined,
  RightOutlined,
  CloseOutlined,
  UserOutlined,
  AppstoreOutlined,
  TeamOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useClientOnboarding } from '../hooks/useClientOnboarding';
import type { ClientOnboardingStepId } from '../utils/clientOnboarding';

const STEP_ICONS: Record<ClientOnboardingStepId, ReactNode> = {
  profile: <UserOutlined />,
  space: <AppstoreOutlined />,
  team: <TeamOutlined />,
};

export default function ClientOnboardingChecklist() {
  const navigate = useNavigate();
  const { visible, steps, completedCount, totalCount, progressPct, isLoading, dismiss } =
    useClientOnboarding();

  if (!visible) return null;

  const nextStep = steps.find((s) => !s.completed);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 20,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <RocketOutlined style={{ fontSize: 18 }} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>Get your workspace ready</span>
          </div>
          <div style={{ fontSize: 13, color: '#bfdbfe', maxWidth: 520 }}>
            Complete these steps to start managing bookings and reception.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          title="Dismiss checklist"
          style={{
            border: 'none',
            background: 'rgba(255,255,255,0.12)',
            color: '#dbeafe',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CloseOutlined />
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#dbeafe' }}>
          <span>{completedCount} of {totalCount} completed</span>
          <span>{progressPct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: '#fff',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {steps.map((step, index) => {
          const done = step.completed;
          const isNext = !done && step.id === nextStep?.id;
          return (
            <button
              key={step.id}
              type="button"
              disabled={isLoading}
              onClick={() => navigate(step.path)}
              style={{
                textAlign: 'left',
                border: `1px solid ${done ? 'rgba(34,197,94,0.5)' : isNext ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'}`,
                background: done ? 'rgba(22,163,74,0.2)' : isNext ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                color: '#fff',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.15)',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {done ? <CheckCircleOutlined /> : STEP_ICONS[step.id]}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#bfdbfe' }}>Step {index + 1}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{step.label}</div>
              <div style={{ fontSize: 11, color: '#dbeafe', lineHeight: 1.4 }}>{step.description}</div>
              {!done && (
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isNext ? 'Start here' : 'Go'} <RightOutlined style={{ fontSize: 10 }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {nextStep && (
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate(nextStep.path)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#fff',
              color: '#1d4ed8',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Continue setup <RightOutlined />
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#93c5fd' }}>
        Tip: finish your profile first, then add a space, then invite your team (any role).
      </div>
    </div>
  );
}
