'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/utils/supabase/client';
import { Upload, FileText, Image, FileType, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UploadedFile {
    id: string;
    name: string;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    error?: string;
}

export function FileUploader() {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const supabase = createClient();

        for (const file of acceptedFiles) {
            const fileId = `${Date.now()}-${file.name}`;

            // Add file to UI with uploading status
            setFiles((prev) => [
                ...prev,
                {
                    id: fileId,
                    name: file.name,
                    status: 'uploading',
                },
            ]);

            try {
                setIsUploading(true);

                // Get current user
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    throw new Error('User not authenticated');
                }

                // Upload to Supabase Storage
                const filePath = `${user.id}/${fileId}`;
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file, {
                        contentType: file.type,
                    });

                if (uploadError) {
                    throw uploadError;
                }

                // Update status to processing
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId ? { ...f, status: 'processing' } : f
                    )
                );

                // Call process-document API
                const response = await fetch('/api/process-document', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filePath,
                        fileName: file.name,
                        fileType: file.type,
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to process document');
                }

                // Update status to completed
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId ? { ...f, status: 'completed' } : f
                    )
                );

                toast.success(`${file.name} processed successfully! ${result.chunksProcessed} chunks created.`);
            } catch (error: any) {
                console.error('Error uploading file:', error);

                // Update status to failed
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? { ...f, status: 'failed', error: error.message }
                            : f
                    )
                );

                toast.error(`Failed to process ${file.name}: ${error.message}`);
            } finally {
                setIsUploading(false);
            }
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'text/plain': ['.txt'],
        },
        multiple: true,
    });

    const getFileIcon = (fileName: string) => {
        if (fileName.endsWith('.pdf')) return <FileType className="size-5 text-red-500" />;
        if (fileName.endsWith('.docx')) return <FileText className="size-5 text-blue-500" />;
        if (/\.(jpg|jpeg|png)$/i.test(fileName)) return <Image className="size-5 text-green-500" />;
        return <FileText className="size-5 text-gray-500" />;
    };

    const getStatusIcon = (status: UploadedFile['status']) => {
        switch (status) {
            case 'uploading':
            case 'processing':
                return <Loader2 className="size-4 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle2 className="size-4 text-green-500" />;
            case 'failed':
                return <XCircle className="size-4 text-red-500" />;
        }
    };

    const getStatusText = (status: UploadedFile['status']) => {
        switch (status) {
            case 'uploading':
                return 'Uploading...';
            case 'processing':
                return 'Processing...';
            case 'completed':
                return 'Ready';
            case 'failed':
                return 'Failed';
        }
    };

    return (
        <div className="space-y-4">
            <Card
                {...getRootProps()}
                className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
            >
                <input {...getInputProps()} />
                <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                    <p className="text-lg font-medium">Drop files here...</p>
                ) : (
                    <>
                        <p className="text-lg font-medium mb-2">
                            Drag & drop files here, or click to select
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Supports PDF, Word (.docx), Images (.jpg, .png), and Text files
                        </p>
                    </>
                )}
            </Card>

            {files.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium">Uploaded Files</h3>
                    {files.map((file) => (
                        <Card key={file.id} className="p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    {getFileIcon(file.name)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{file.name}</p>
                                        {file.error && (
                                            <p className="text-xs text-red-500 truncate">{file.error}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {getStatusText(file.status)}
                                    </span>
                                    {getStatusIcon(file.status)}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
