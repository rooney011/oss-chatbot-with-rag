-- Add content column to chat_embeddings to store individual chunk text
alter table chat_embeddings add column if not exists content text;

-- Add file_path column to chat_sources to store Supabase Storage reference
alter table chat_sources add column if not exists file_path text;

-- Update the embedding dimension if needed (from 1536 to 768 for Google's text-embedding-004)
-- Note: This will drop existing data in the embedding column
-- alter table chat_embeddings alter column embedding type vector(768);

-- Create or update match_documents function to return chunk content
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_user_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chat_embeddings.id,
    chat_embeddings.content,
    1 - (chat_embeddings.embedding <=> query_embedding) as similarity
  from chat_embeddings
  join chat_sources on chat_embeddings.source_id = chat_sources.id
  where 1 - (chat_embeddings.embedding <=> query_embedding) > match_threshold
  and chat_sources.user_id = filter_user_id
  order by chat_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;
