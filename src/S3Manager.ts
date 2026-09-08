import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

export interface S3Config {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    prefix: string;
}

export class S3Manager {
    private client: S3Client | null = null;
    private config: S3Config;

    constructor(config: S3Config) {
        this.config = config;
        this.client = new S3Client({
            endpoint: config.endpoint || undefined,
            region: config.region || 'auto',
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: true, // Common for non-AWS S3 (like MinIO, R2)
        });
    }

    /**
     * List all objects under the configured prefix
     */
    async listObjects(): Promise<{ key: string; etag: string }[]> {
        if (!this.client) throw new Error('S3 Client not initialized');

        const command = new ListObjectsV2Command({
            Bucket: this.config.bucket,
            Prefix: this.config.prefix,
        });

        const response = await this.client.send(command);
        return (response.Contents || []).map(obj => ({
            key: obj.Key || '',
            etag: (obj.ETag || '').replace(/"/g, ''), // Remove quotes from ETag
        })).filter(obj => obj.key !== '');
    }

    /**
     * Download object content
     */
    async getObject(key: string): Promise<string> {
        if (!this.client) throw new Error('S3 Client not initialized');

        const command = new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
        });

        const response = await this.client.send(command);
        if (!response.Body) throw new Error(`Empty body for key: ${key}`);

        // Convert stream/blob to string
        return await response.Body.transformToString();
    }

    /**
     * Test connection by listing a single object
     */
    async testConnection(): Promise<void> {
        if (!this.client) throw new Error('S3 Client not initialized');
        const command = new ListObjectsV2Command({
            Bucket: this.config.bucket,
            MaxKeys: 1,
        });
        await this.client.send(command);
    }
}
