declare module "form-data" {
  type AppendOptions = {
    filename?: string;
    contentType?: string;
    knownLength?: number;
  };

  export default class FormData {
    append(name: string, value: any, filenameOrOptions?: string | AppendOptions): void;
    getHeaders(): Record<string, string>;
  }
}


