import { randomUUID } from 'node:crypto';
import { ClientFactory, ServiceParameters, withA2AExtensions } from '@a2a-js/sdk/client';
import type { AgentCard, MessageSendParams, Message, Task } from '@a2a-js/sdk';

const DEAL_EXTENSION_URI = 'https://a2a-platform.example/ext/deal/v1';

const factory = new ClientFactory();

export async function sendRfpToAgent(
  agentCardJson: unknown,
  rfpData: Record<string, unknown>
): Promise<Message | Task | null> {
  const agentCard = agentCardJson as AgentCard;
  const client = await factory.createFromAgentCard(agentCard);

  const params: MessageSendParams = {
    message: {
      kind: 'message',
      messageId: randomUUID(),
      role: 'user',
      parts: [
        {
          kind: 'data',
          data: rfpData,
        },
      ],
      extensions: [DEAL_EXTENSION_URI],
    },
  };

  const serviceParameters = ServiceParameters.create(withA2AExtensions(DEAL_EXTENSION_URI));
  const response = (await client.sendMessage(params, { serviceParameters })) as Message | Task;
  if (response && (response as Task).kind === 'task') {
    return response as Task;
  }
  if (response && (response as Message).kind === 'message') {
    return response as Message;
  }
  return null;
}

export async function getTaskFromAgent(
  agentCardJson: unknown,
  taskId: string,
  historyLength?: number
): Promise<Task> {
  const agentCard = agentCardJson as AgentCard;
  const client = await factory.createFromAgentCard(agentCard);
  const serviceParameters = ServiceParameters.create(withA2AExtensions(DEAL_EXTENSION_URI));
  return client.getTask({ id: taskId, historyLength }, { serviceParameters }) as Promise<Task>;
}

export async function subscribeTaskFromAgent(
  agentCardJson: unknown,
  taskId: string
): Promise<AsyncGenerator<unknown, void, undefined>> {
  const agentCard = agentCardJson as AgentCard;
  const client = await factory.createFromAgentCard(agentCard);
  const serviceParameters = ServiceParameters.create(withA2AExtensions(DEAL_EXTENSION_URI));
  return client.resubscribeTask({ id: taskId }, { serviceParameters }) as AsyncGenerator<
    unknown,
    void,
    undefined
  >;
}
