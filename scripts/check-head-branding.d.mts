export declare const FORBIDDEN: RegExp;
export declare const PUBLIC_PATHS: string[];
export declare function extractMetaStrings(source: string): string[];
export declare function checkSources(): Promise<string[]>;
export declare function extractHead(html: string): string;
export declare function checkRendered(baseUrl: string, paths?: string[]): Promise<string[]>;
