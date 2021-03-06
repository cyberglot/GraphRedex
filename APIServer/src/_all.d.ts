interface Blob {
    /* for arango */
}

interface MulterDiskFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
}

interface Language {
    name: string;
    path: string;
    dir: string;
    query?: { name: string; query: string }[];
    onDisk?: boolean;
    _key?: Number;
}

interface TermMeta {
    _id: string;
    _key: string;
    term: string;
}
