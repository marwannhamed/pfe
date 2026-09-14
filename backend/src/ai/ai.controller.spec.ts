import { AiController } from './ai.controller';
import { TICKET_CATEGORY, USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const user: AuthUser = {
  id: 'user-1',
  tenant_id: 'tenant-a',
  role: USER_ROLE.MANAGER,
  email: 'manager@test.local',
};

function makeController(reply: string) {
  const openAi = { chat: jest.fn().mockResolvedValue(reply) };
  return { openAi, controller: new AiController(openAi as never) };
}

describe('AiController.suggestMaintenanceCategory — the model answer is never trusted blindly', () => {
  it('takes the category from a well-formed answer', async () => {
    const { controller } = makeController('HVAC|air conditioner leaking water');

    const result = await controller.suggestMaintenanceCategory({
      title: 'AC leaking',
      description: 'Water on the floor under the unit',
    } as never);

    expect(result).toEqual({
      category: TICKET_CATEGORY.HVAC,
      raw: 'HVAC|air conditioner leaking water',
    });
  });

  it('accepts an answer with no reason after the pipe', async () => {
    const { controller } = makeController('PLUMBING');

    const result = await controller.suggestMaintenanceCategory({
      title: 'Tap dripping',
    } as never);

    expect(result.category).toBe(TICKET_CATEGORY.PLUMBING);
  });

  it('tolerates whitespace and lower case', async () => {
    const { controller } = makeController('  electrical | socket sparking ');

    const result = await controller.suggestMaintenanceCategory({
      title: 'Sparking socket',
    } as never);

    expect(result.category).toBe(TICKET_CATEGORY.ELECTRICAL);
  });

  it('falls back to OTHER when the model invents a category', async () => {
    // A model is free to answer anything; only our own enum may reach the DB.
    const { controller } = makeController('ROOFING|tiles missing');

    const result = await controller.suggestMaintenanceCategory({
      title: 'Roof leak',
    } as never);

    expect(result.category).toBe(TICKET_CATEGORY.OTHER);
  });

  it('falls back to OTHER when the model rambles instead of classifying', async () => {
    const { controller } = makeController(
      'I think this could be several things, possibly plumbing or HVAC.',
    );

    const result = await controller.suggestMaintenanceCategory({
      title: 'Something is wrong',
    } as never);

    expect(result.category).toBe(TICKET_CATEGORY.OTHER);
  });

  it('sends the title and description together as one prompt', async () => {
    const { openAi, controller } = makeController('CLEANING|rubbish left');

    await controller.suggestMaintenanceCategory({
      title: 'Bins overflowing',
      description: 'Kitchen on floor 2',
    } as never);

    const [messages, system] = openAi.chat.mock.calls[0];
    expect(messages).toEqual([
      { role: 'user', content: 'Bins overflowing\nKitchen on floor 2' },
    ]);
    // Every valid category is offered, so the model cannot be blamed for
    // inventing one that simply was not listed.
    for (const category of Object.values(TICKET_CATEGORY)) {
      expect(system).toContain(category);
    }
  });

  it('omits a missing description rather than sending "undefined"', async () => {
    const { openAi, controller } = makeController('OTHER|unclear');

    await controller.suggestMaintenanceCategory({
      title: 'Only a title',
    } as never);

    expect(openAi.chat.mock.calls[0][0][0].content).toBe('Only a title');
  });
});

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
