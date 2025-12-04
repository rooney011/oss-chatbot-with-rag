'use client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, GlobeIcon, RefreshCcwIcon } from 'lucide-react';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';
const models = [
  { name: 'Gemini (flash)', value: 'gemini' },
  { name: 'Gemini (lite)', value: 'gemini_flash_lite' },
  { name: 'Gemini (pro)', value: 'gemini_pro' },
  { name: 'GPT-4 Turbo', value: 'openai' },
  { name: 'Claude 3.5', value: 'claude' },
];

const ChatBotDemo = () => {
  const [model, setModel] = useState(models[0].value);
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);

  const { messages, sendMessage, status, regenerate } = useChat({});

  const handleSubmit = async (message?: { text?: string }, e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const text = message?.text ?? input;
    if (!text?.trim()) return;

    await sendMessage(
      {
        text,
      },
      {
        body: {
          modelKey: model,
          webSearch,
        },
      }
    );
    setInput('');
  };

  function handleInputChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setInput(event.target.value);
  }

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === 'source-url',
                        ).length
                      }
                    />
                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                      <SourcesContent key={`${message.id}-${i}`}>
                        <Source
                          key={`${message.id}-${i}`}
                          href={part.url}
                          title={part.url}
                        />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                          {message.role === 'assistant' && i === message.parts.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => regenerate()}
                                label="Retry"
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput 
          onSubmit={handleSubmit} 
          className="mt-4" 
          globalDrop 
          multiple
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={handleInputChange}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => setWebSearch(!webSearch)}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem key={model.value} value={model.value}>
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
