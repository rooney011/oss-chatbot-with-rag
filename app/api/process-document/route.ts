import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import mammoth from 'mammoth';
import { generateText } from 'ai';

// Helper to get embedding model
function getEmbeddingModel() {
    if (process.env.OPENAI_API_KEY) {
        return openai.embedding('text-embedding-3-small');
    }
    return google.textEmbeddingModel('text-embedding-004');
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        console.log('📝 RAG Process Request Body:', JSON.stringify(body, null, 2));
        const { filePath, fileName, fileType } = body;

        if (!filePath || !fileName) {
            console.error('❌ Missing fields:', { filePath, fileName });
            return NextResponse.json({ error: 'Missing filePath or fileName' }, { status: 400 });
        }

        // Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(filePath);

        if (downloadError || !fileData) {
            console.error('Error downloading file:', downloadError);
            return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
        }

        // Convert Blob to Buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Step 1: Extract text based on file type
        let extractedText = '';

        try {
            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                // PDF extraction - pdf-parse is a CommonJS module
                const pdfParse = await import('pdf-parse');
                // @ts-ignore - pdf-parse has complex module exports
                const parser = pdfParse.default || pdfParse;
                const pdfData = await parser(buffer);
                extractedText = pdfData.text;
            } else if (
                fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                fileName.endsWith('.docx')
            ) {
                // Word document extraction
                const result = await mammoth.extractRawText({ buffer });
                extractedText = result.value;
            } else if (fileType?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(fileName)) {
                // Image analysis using Gemini Vision
                const base64Image = buffer.toString('base64');
                const mimeType = fileType || 'image/jpeg';

                const { text } = await generateText({
                    model: google('gemini-1.5-flash'),
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Analyze this image in detail. Describe all visible text, charts, and data for search purposes.',
                                },
                                {
                                    type: 'image',
                                    image: `data:${mimeType};base64,${base64Image}`,
                                },
                            ],
                        },
                    ],
                });

                extractedText = text;
            } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
                // Plain text file
                extractedText = buffer.toString('utf-8');
            } else {
                return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
            }
        } catch (extractError) {
            console.error('Error extracting text:', extractError);
            return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 500 });
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return NextResponse.json({ error: 'No text content extracted from file' }, { status: 400 });
        }

        // Step 2: Chunk the text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const chunks = await splitter.splitText(extractedText);

        if (chunks.length === 0) {
            return NextResponse.json({ error: 'No chunks created from text' }, { status: 400 });
        }

        // Step 3: Save file metadata to chat_sources
        const { data: sourceData, error: sourceError } = await supabase
            .from('chat_sources')
            .insert({
                user_id: user.id,
                name: fileName,
                content: extractedText.substring(0, 5000), // Store first 5000 chars as preview
            })
            .select()
            .single();

        if (sourceError || !sourceData) {
            console.error('Error saving source:', sourceError);
            return NextResponse.json({ error: 'Failed to save source' }, { status: 500 });
        }

        // Step 4: Generate embeddings and save chunks
        // Use OpenAI if available (bypass Gemini quota limits), otherwise Google
        const embeddingModel = getEmbeddingModel();

        const { embeddings } = await embedMany({
            model: embeddingModel,
            values: chunks,
        });

        const embeddingPromises = chunks.map(async (chunk, index) => {
            try {
                // Get the pre-generated embedding for this chunk
                const embedding = embeddings[index];

                // Save to chat_embeddings
                const { error: embeddingError } = await supabase
                    .from('chat_embeddings')
                    .insert({
                        source_id: sourceData.id,
                        content: chunk, // Store the chunk text
                        embedding: embedding,
                        metadata: {
                            chunk_index: index,
                            chunk_length: chunk.length,
                            file_name: fileName,
                        },
                    });

                if (embeddingError) {
                    console.error('Error saving embedding:', embeddingError);
                    throw embeddingError;
                }

                return { success: true, index };
            } catch (error) {
                console.error(`Error processing chunk ${index}:`, error);
                return { success: false, index, error };
            }
        });

        const results = await Promise.all(embeddingPromises);
        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.filter((r) => !r.success).length;

        return NextResponse.json({
            success: true,
            sourceId: sourceData.id,
            chunksProcessed: successCount,
            chunksFailed: failureCount,
            totalChunks: chunks.length,
        });
    } catch (error) {
        console.error('Unexpected error in process-document API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
