export interface ModuleSizeReportPlugin {
  readonly name: string;
  readonly apply: 'build';
  generateBundle(options: unknown, bundle: Record<string, unknown>): void;
}

export declare function moduleSizeReport(outputDir: string): ModuleSizeReportPlugin;
