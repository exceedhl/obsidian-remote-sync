export interface S3ObjectRef {
    key: string;
    etag: string;
}

export type ObjectBody = string | Uint8Array;

export interface ObjectStore {
    listObjects(): Promise<S3ObjectRef[]>;
    getObject(key: string): Promise<ObjectBody>;
}
