export interface AjvValidationError {
  readonly instancePath: string;
  readonly message?: string;
  readonly keyword?: string;
  readonly schemaPath?: string;
  readonly params?: Record<string, unknown>;
}

export interface ManifestValidator {
  (data: unknown): boolean;
  errors?: readonly AjvValidationError[] | null;
}

declare const validateManifest: ManifestValidator;
export default validateManifest;
