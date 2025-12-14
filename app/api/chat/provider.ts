import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export const providers = {
  openai: openai('gpt-4o-mini'),
  claude: anthropic('claude-3-5-sonnet-20241022'),
  gemini: google('gemini-2.5-flash'),
  gemini_flash_lite: google('gemini-2.5-flash-lite'),
  gemini_pro: google('gemini-2.5-pro'),
};