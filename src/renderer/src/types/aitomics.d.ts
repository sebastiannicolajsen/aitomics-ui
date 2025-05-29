declare module 'aitomics' {
  export class Response {
    constructor(data: any);
    data: any;
    static create(data: any, metadata: any, nodeName: string): Response;
  }

  export class Sequence {
    constructor(items: any[]);
    items: any[];
  }

  export class Caller {
    constructor(code: string);
    execute(sequence: Sequence): Promise<any>;
  }
} 