import { streamText, convertToModelMessages } from 'ai';
import { providers } from './provider';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, modelKey } = body;

  const model = providers[modelKey as keyof typeof providers];
  if (!model) {
    return new Response(JSON.stringify({ error: 'Unknown modelKey' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await streamText({
    model,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
