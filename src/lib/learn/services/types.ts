export type ServiceDomain = "commerce" | "booking" | "work" | "content" | "support";
export type ServiceSample = {
  label: string;
  values: number[];
  fields: [string, string][];
  expected: { allowed: boolean; amount?: number };
};
export type ServiceCase = {
  id: string;
  domain: ServiceDomain;
  title: string;
  concept: string;
  summary: string;
  policy: string;
  fault: string;
  repair: string;
  operation: string;
  entity: string;
  samples: [ServiceSample, ServiceSample, ServiceSample];
  transfer: { question: string; choices: [string, string, string]; explanation: string };
  code: string;
};
export type ServiceResult = { allowed: boolean; amount?: number; detail: string };
export type ServiceState = {
  selected: number;
  result: ServiceResult | null;
  history: { sample: number; result: ServiceResult }[];
};
