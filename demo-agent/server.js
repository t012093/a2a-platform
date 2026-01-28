import express from 'express';
import { randomUUID } from 'node:crypto';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';

const DEAL_EXTENSION_URI = 'https://a2a-platform.example/ext/deal/v1';

const port = Number(process.env.PORT || 4000);
const baseUrl = process.env.AGENT_BASE_URL || `http://localhost:${port}`;

const agentCard = {
  name: 'Demo Offer Agent',
  description: 'Returns a sample offer for RFP testing.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: `${baseUrl}/a2a/jsonrpc`,
  preferredTransport: 'JSONRPC',
  skills: [
    {
      id: 'lp-offer',
      name: 'LP Offer',
      description: 'Provides a mock LP offer for testing.',
      tags: ['lp', 'offer', 'demo'],
    },
  ],
  capabilities: {
    pushNotifications: false,
    streaming: true,
    stateTransitionHistory: true,
    extensions: [
      {
        uri: DEAL_EXTENSION_URI,
        description: 'Deal extension for RFP/Offer data parts.',
      },
    ],
  },
  defaultInputModes: ['text', 'data'],
  defaultOutputModes: ['text', 'data'],
  additionalInterfaces: [
    { url: `${baseUrl}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${baseUrl}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
};

class OfferExecutor {
  async execute(requestContext, eventBus) {
    const now = new Date().toISOString();

    eventBus.publish({
      kind: 'task',
      id: requestContext.taskId,
      contextId: requestContext.contextId,
      status: {
        state: 'working',
        timestamp: now,
      },
      history: [],
      artifacts: [],
    });

    eventBus.publish({
      kind: 'status-update',
      taskId: requestContext.taskId,
      contextId: requestContext.contextId,
      final: false,
      status: {
        state: 'working',
        timestamp: now,
      },
    });

    const offerData = {
      schema: 'deal.offer',
      schema_version: 'v1',
      offer_id: randomUUID(),
      price: 50000,
      currency: 'JPY',
      delivery_days: 14,
      revision_count: 2,
      deliverables: ['LP design', 'LP implementation'],
      exclusions: ['Ad spend'],
    };

    eventBus.publish({
      kind: 'artifact-update',
      taskId: requestContext.taskId,
      contextId: requestContext.contextId,
      artifact: {
        artifactId: `offer_${randomUUID()}`,
        name: 'Offer',
        description: 'Demo offer artifact',
        extensions: [DEAL_EXTENSION_URI],
        parts: [
          {
            kind: 'data',
            data: offerData,
          },
        ],
      },
      lastChunk: true,
    });

    eventBus.publish({
      kind: 'status-update',
      taskId: requestContext.taskId,
      contextId: requestContext.contextId,
      final: true,
      status: {
        state: 'completed',
        timestamp: new Date().toISOString(),
      },
    });

    eventBus.finished();
  }

  cancelTask = async (_taskId, eventBus) => {
    eventBus.publish({
      kind: 'status-update',
      taskId: _taskId,
      contextId: _taskId,
      final: true,
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString(),
      },
    });
    eventBus.finished();
  };
}

const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new OfferExecutor()
);

const app = express();

app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
app.use('/a2a/rest', restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

app.listen(port, () => {
  console.log(`A2A demo agent running at ${baseUrl}`);
});
