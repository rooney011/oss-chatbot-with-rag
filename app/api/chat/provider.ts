import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export const providers = {
  openai: openai('gpt-4-turbo'),
  claude: anthropic('claude-3-5-sonnet-20241022'),
  gemini: google('gemini-2.0-flash'),
  gemini_pro: google('gemini-2.0-flash-lite'),
};
