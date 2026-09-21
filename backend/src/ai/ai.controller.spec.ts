import { AiController } from './ai.controller';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const user: AuthUser = {
  id: 'user-1',
  tenant_id: 'tenant-a',
  role: USER_ROLE.MANAGER,
  email: 'manager@test.local',
};

function makeController(reply: string) {
  const openAi = { chat: jest.fn().mockResolvedValue(reply) };
  const triage = { triage: jest.fn() };
  return {
    openAi,
    triage,
    controller: new AiController(openAi as never, triage as never),
  };
}

describe('AiController — the assistants pass the conversation through', () => {
  it('forwards lease-assistant messages and returns the reply', async () => {
    const { openAi, controller } = makeController('A deposit is …');

    const result = await controller.leaseAssistant(user, {
      messages: [{ role: 'user', content: 'What is a security deposit?' }],
    } as never);

    expect(result).toEqual({ reply: 'A deposit is …' });
    expect(openAi.chat.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'What is a security deposit?' },
    ]);
  });

  it('tells the model which role it is speaking to', async () => {
    const { openAi, controller } = makeController('ok');

    await controller.tenantAssistant(
      { ...user, role: USER_ROLE.TENANT_EMPLOYEE },
      { messages: [{ role: 'user', content: 'hi' }] } as never,
    );

    expect(openAi.chat.mock.calls[0][1]).toContain(USER_ROLE.TENANT_EMPLOYEE);
  });

  it('keeps multi-turn history in order', async () => {
    const { openAi, controller } = makeController('ok');

    await controller.leaseAssistant(user, {
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ],
    } as never);

    expect(
      openAi.chat.mock.calls[0][0].map((m: { content: string }) => m.content),
    ).toEqual(['first', 'reply', 'second']);
  });
});
