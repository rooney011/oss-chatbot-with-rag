import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { providers } from './provider';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { tavilySearch } from '@tavily/ai-sdk';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { messages, modelKey, sessionId, webSearch } = body;

    const model = providers[modelKey as keyof typeof providers];
    if (!model) {
      return NextResponse.json({ error: 'Unknown modelKey' }, { status: 400 });
    }

    let currentSessionId = sessionId;

    // If no sessionId provided, create a new session
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New conversation',
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        console.error('Error creating session:', sessionError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }

      currentSessionId = newSession.id;
    }

    // Verify session belongs to user
    const { data: session, error: verifyError } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('id', currentSessionId)
      .eq('user_id', user.id)
      .single();

    if (verifyError || !session) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    // STEP 1: Save user message immediately (before streaming)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      // Extract text content from AI SDK message format
      let messageText = '';

      if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
        // Handle AI SDK format with parts array
        messageText = lastMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      } else if (typeof lastMessage.content === 'string') {
        messageText = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // Handle array of content parts
        messageText = lastMessage.content
          .map((part: any) => (typeof part === 'string' ? part : part.text || ''))
          .join(' ');
      } else if (lastMessage.content?.text) {
        messageText = lastMessage.content.text;
      }

      if (!messageText) {
        console.error('Cannot extract text from message:', lastMessage);
        return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
      }

      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          role: 'user',
          content: messageText,
        });

      if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
      }

      // Auto-generate title if this is the first message
      if (session.title === 'New conversation') {
        const generatedTitle = messageText.substring(0, 50);
        await supabase
          .from('chat_sessions')
          .update({ title: generatedTitle })
          .eq('id', currentSessionId);
      }
    }

    // STEP 2: Stream the AI response
    // Track the full response text in case of early abort
    let fullResponseText = '';

    /**
     * Sliding Window Function: Prevent token/cost overflows
     * - Always includes system prompts at the start
     * - Includes only the last N messages (configurable via MAX_MESSAGES_TO_LLM)
     * - Frontend still displays full history; only LLM request is truncated
     */
    const applyMessageSlidingWindow = (messages: any[], maxMessages: number = 20) => {
      if (!messages || messages.length === 0) return [];

      // Separate system prompts from conversation messages
      const systemMessages = messages.filter(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');

      // Take only the last N conversation messages (sliding window)
      const recentMessages = conversationMessages.slice(-maxMessages);

      // Combine: system prompts first, then recent conversation
      return [...systemMessages, ...recentMessages];
    };

    // Apply sliding window: keep last 20 messages (10 turns) + system prompts
    const truncatedMessages = applyMessageSlidingWindow(messages, 20);

    // RAG ENHANCEMENT: Retrieve relevant document context
    let enhancedMessages = truncatedMessages;
    if (lastMessage && lastMessage.role === 'user') {
      try {
        // Extract text from last message (same logic as earlier)
        let messageText = '';
        if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
          messageText = lastMessage.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join(' ');
        } else if (typeof lastMessage.content === 'string') {
          messageText = lastMessage.content;
        } else if (Array.isArray(lastMessage.content)) {
          messageText = lastMessage.content
            .map((part: any) => (typeof part === 'string' ? part : part.text || ''))
            .join(' ');
        } else if (lastMessage.content?.text) {
          messageText = lastMessage.content.text;
        }

        if (messageText && messageText.trim().length > 0) {
          // Generate embedding for user's message
          const embeddingModel = google.textEmbeddingModel('text-embedding-004');
          const { embedding } = await embed({
            model: embeddingModel,
            value: messageText,
          });

          // Search for relevant documents using match_documents RPC
          const { data: relevantChunks, error: searchError } = await supabase.rpc(
            'match_documents',
            {
              query_embedding: embedding,
              match_threshold: 0.7,
              match_count: 5,
              filter_user_id: user.id,
            }
          );

          if (!searchError && relevantChunks && relevantChunks.length > 0) {
            // Format retrieved context
            const contextText = relevantChunks
              .map((chunk: any, idx: number) => {
                return `[Document ${idx + 1}] (Similarity: ${(chunk.similarity * 100).toFixed(1)}%)\n${chunk.content}`;
              })
              .join('\n\n');

            // Create enhanced system message with context
            const ragSystemMessage = {
              role: 'system',
              content: `You are a helpful assistant. The user has uploaded documents to their knowledge base. Use the following context from their documents to answer their question. If the context is relevant, cite it in your answer. If the context is not relevant to the question, answer normally without mentioning the context.

=== RETRIEVED CONTEXT ===
${contextText}
=== END OF CONTEXT ===

Now answer the user's question based on the above context and your general knowledge.`,
            };

            // Inject RAG system message at the beginning
            enhancedMessages = [ragSystemMessage, ...truncatedMessages];

            console.log(`✅ RAG: Found ${relevantChunks.length} relevant chunks for query`);
          } else {
            console.log('ℹ️ RAG: No relevant documents found for query');
          }
        }
      } catch (ragError) {
        console.error('Error in RAG retrieval:', ragError);
        // Continue without RAG context on error
      }
    }

    const result = await streamText({
      model,
      messages: convertToModelMessages(enhancedMessages),
      // Enable web search tool when user toggles search button
      tools: webSearch ? {
        webSearch: tavilySearch({
          apiKey: process.env.TAVILY_API_KEY!,
          maxResults: 5,
        })
      } : undefined,
      // Multi-step reasoning: allows AI to search, read results, and generate answer
      stopWhen: webSearch ? stepCountIs(5) : undefined,
      onChunk: ({ chunk }) => {
        // Accumulate text as it streams (for partial save on abort)
        if (chunk.type === 'text-delta') {
          fullResponseText += chunk.text;
        }
      },
      onFinish: async ({ text, finishReason }) => {
        // STEP 3: Save assistant response when streaming completes
        // Use the accumulated text (in case text param is empty on abort)
        const contentToSave = text || fullResponseText;

        if (!contentToSave) {
          console.warn('No content to save in onFinish');
          return;
        }

        // Create a promise for the DB save
        const savePromise = (async () => {
          const { error: assistantMsgError } = await supabase
            .from('chat_messages')
            .insert({
              session_id: currentSessionId,
              role: 'assistant',
              content: contentToSave,
            });

          if (assistantMsgError) {
            console.error('Error saving assistant message:', assistantMsgError);
          } else {
            console.log(`Saved assistant message (${contentToSave.length} chars, reason: ${finishReason})`);
          }
        })();

        // Extend request lifecycle to complete DB write even if client disconnects
        // @ts-ignore - waitUntil may not be in all Next.js versions
        if (req.waitUntil) {
          // @ts-ignore
          req.waitUntil(savePromise);
        } else {
          // Fallback: await the promise (may not complete on disconnect)
          await savePromise;
        }
      },
    });

    // Handle request abort to save partial response
    req.signal?.addEventListener('abort', async () => {
      console.log('Request aborted, saving partial response...');
      if (fullResponseText && fullResponseText.length > 0) {
        // Save whatever we have so far
        try {
          await supabase
            .from('chat_messages')
            .insert({
              session_id: currentSessionId,
              role: 'assistant',
              content: fullResponseText + ' [interrupted]',
            });
          console.log(`Saved partial response (${fullResponseText.length} chars)`);
        } catch (error) {
          console.error('Error saving partial response on abort:', error);
        }
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Unexpected error in chat API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
