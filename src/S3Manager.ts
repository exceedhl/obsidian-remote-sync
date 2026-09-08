import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { ObjectBody, ObjectStore, S3ObjectRef } from './core/objectStore';

export interface S3Config {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    prefix: string;
    forcePathStyle?: boolean;
}

export function createS3Manager(config: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    prefix: string;
    forcePathStyle?: boolean;
}): S3Manager {
    return new S3Manager({
        ...config,
        forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
    });
}

export class S3Manager implements ObjectStore {
    private client: S3Client;
    private config: S3Config;

    get prefix(): string {
        return this.config.prefix;
    }

    get forcePathStyle(): boolean {
        return this.config.forcePathStyle ?? Boolean(this.config.endpoint);
    }

    constructor(config: S3Config, client?: S3Client) {
        this.config = {
            ...config,
            forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
        };
        this.client = client ?? new S3Client({
            endpoint: config.endpoint || undefined,
            region: config.region || 'auto',
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
        });
    }

    async listObjects(): Promise<S3ObjectRef[]> {
        const objects: S3ObjectRef[] = [];
        let continuationToken: string | undefined;

        do {
            const response = await this.client.send(new ListObjectsV2Command({
                Bucket: this.config.bucket,
                Prefix: this.config.prefix || undefined,
                ContinuationToken: continuationToken,
            }));

            for (const obj of response.Contents || []) {
                const key = obj.Key || '';
                if (!key) continue;
                objects.push({
                    key,
                    etag: (obj.ETag || '').replace(/"/g, ''),
                });
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        return objects;
    }

    async getObject(key: string): Promise<ObjectBody> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
        }));
        if (!response.Body) throw new Error(`Empty body for key: ${key}`);
        return await response.Body.transformToByteArray();
    }

    async testConnection(): Promise<void> {
        await this.client.send(new ListObjectsV2Command({
            Bucket: this.config.bucket,
            Prefix: this.config.prefix || undefined,
            MaxKeys: 1,
        }));
    }
}
