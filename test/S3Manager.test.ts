import { describe, it, expect, vi } from 'vitest';
import { S3Manager, createS3Manager } from '../src/S3Manager';

describe('S3Manager', () => {
    it('pages through ListObjectsV2 until IsTruncated is false', async () => {
        const send = vi.fn()
            .mockResolvedValueOnce({
                Contents: [{ Key: 'notes/a.md', ETag: '"etag1"' }],
                IsTruncated: true,
                NextContinuationToken: 'tok-2',
            })
            .mockResolvedValueOnce({
                Contents: [{ Key: 'notes/b.md', ETag: '"etag2"' }],
                IsTruncated: false,
            });

        const mgr = new S3Manager({
            endpoint: 'https://s3.example',
            region: 'auto',
            bucket: 'notes',
            accessKeyId: 'ak',
            secretAccessKey: 'sk',
            prefix: 'notes/',
        }, { send } as any);

        await expect(mgr.listObjects()).resolves.toEqual([
            { key: 'notes/a.md', etag: 'etag1' },
            { key: 'notes/b.md', etag: 'etag2' },
        ]);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1][0].input.ContinuationToken).toBe('tok-2');
    });

    it('returns object bodies as bytes', async () => {
        const bytes = new Uint8Array([9, 8, 7]);
        const send = vi.fn().mockResolvedValue({
            Body: { transformToByteArray: async () => bytes },
        });
        const mgr = new S3Manager({
            endpoint: '',
            region: 'us-east-1',
            bucket: 'notes',
            accessKeyId: 'ak',
            secretAccessKey: 'sk',
            prefix: '',
        }, { send } as any);

        await expect(mgr.getObject('bin')).resolves.toEqual(bytes);
    });

    it('uses path-style only when an endpoint is set', () => {
        const withEndpoint = createS3Manager({
            endpoint: 'https://s3.example',
            region: 'auto',
            bucket: 'b',
            accessKeyId: 'a',
            secretAccessKey: 's',
            prefix: '',
        });
        const aws = createS3Manager({
            endpoint: '',
            region: 'us-east-1',
            bucket: 'b',
            accessKeyId: 'a',
            secretAccessKey: 's',
            prefix: '',
        });
        expect(withEndpoint.forcePathStyle).toBe(true);
        expect(aws.forcePathStyle).toBe(false);
    });
});
