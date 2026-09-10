import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ── OpenAPI 3 schema types (subset actually used by FastAPI) ─────────────────

interface SchemaObj {
  $ref?: string;
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, SchemaObj>;
  items?: SchemaObj;
  enum?: unknown[];
  allOf?: SchemaObj[];
}

interface OperationDoc {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: SchemaObj;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: SchemaObj }>;
  };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: SchemaObj }> }>;
}

interface OpenApiSchemaDoc {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, OperationDoc>>;
  components?: { schemas?: Record<string, SchemaObj> };
}

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: unknown[];
}

// ── $ref resolution helpers ───────────────────────────────────────────────────

function resolveRef(ref: string, doc: OpenApiSchemaDoc): SchemaObj | null {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!match) return null;
  return doc.components?.schemas?.[match[1]] ?? null;
}

function typeLabel(schema: SchemaObj | undefined, doc: OpenApiSchemaDoc, depth = 0): string {
  if (!schema) return 'any';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() ?? schema.$ref;
    return name;
  }
  if (schema.type === 'array') {
    const items = schema.items ? typeLabel(schema.items, doc, depth + 1) : 'any';
    return `${items}[]`;
  }
  if (schema.type === 'object') return 'object';
  if (schema.type) return schema.format ? `${schema.type} (${schema.format})` : schema.type;
  return 'any';
}

function schemaFields(schema: SchemaObj | undefined, doc: OpenApiSchemaDoc, depth = 0): SchemaField[] {
  if (!schema) return [];
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, doc);
    return schemaFields(resolved ?? undefined, doc, depth + 1);
  }
  if (schema.allOf) {
    return schema.allOf.flatMap((sub) => schemaFields(sub, doc, depth + 1));
  }
  if (schema.type === 'object' && schema.properties) {
    return Object.entries(schema.properties).map(([name, prop]) => ({
      name,
      type: typeLabel(prop, doc, depth),
      required: schema.required?.includes(name) ?? false,
      description: prop.description,
      enum: prop.enum,
    }));
  }
  return [
    {
      name: '(response value)',
      type: typeLabel(schema, doc, depth),
      required: false,
      description: schema.description,
    },
  ];
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * API Documentation — documents only real endpoints.
 *
 * The endpoint list, parameters, and response structures are derived at runtime
 * from the actual FastAPI OpenAPI schema (/openapi.json), never from a manually
 * maintained duplicate list. Swagger UI is linked directly for interactive use.
 */
export function ApiDocsPage() {
  const [schema, setSchema] = useState<OpenApiSchemaDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/openapi.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while fetching /openapi.json`);
        }
        const parsed = (await response.json()) as OpenApiSchemaDoc;
        if (cancelled) return;
        setSchema(parsed);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSchema(null);
        setError(err instanceof Error ? err.message : 'OpenAPI schema could not be fetched.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const docsUrl = `${API_BASE_URL}/docs`;

  const endpoints = useMemo(() => {
    if (!schema?.paths) return [];
    return Object.entries(schema.paths)
      .map(([path, methods]) => ({
        path,
        operations: Object.entries(methods).map(([method, op]) => ({ method, ...op })),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [schema]);

  return (
    <PageContainer>
      <PageHeader
        title="API Documentation"
        purpose="API"
        description="Endpoints, request/response contracts, and usage for the Ocean Model–Observation API. The endpoint list below is derived live from the FastAPI OpenAPI schema."
        breadcrumb={<Link to="/" className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>← Workspace Home</Link>}
        actions={
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border px-3 py-1.5 text-[11px] font-semibold transition"
            style={{ borderColor: 'var(--os-border-light)', color: 'var(--os-accent)', background: 'var(--os-bg)' }}
          >
            Open Swagger UI
          </a>
        }
      />

      {loading && (
        <SectionCard title="Schema">
          <LoadingState message="Fetching /openapi.json from the backend…" />
        </SectionCard>
      )}

      {!loading && error && (
        <SectionCard title="Schema">
          <ErrorState message={`OpenAPI schema unavailable in this session: ${error}`} />
          <div className="pb-3 text-center">
            <p className="text-[11px]" style={{ color: 'var(--os-text-2)' }}>
              The schema is served by the FastAPI backend at <span className="mono">/openapi.json</span>.
              Start the backend, then reload this page. Interactive documentation is available at{' '}
              <a href={docsUrl} target="_blank" rel="noreferrer" className="mono" style={{ color: 'var(--os-accent)' }}>
                {docsUrl}
              </a>
              .
            </p>
          </div>
        </SectionCard>
      )}

      {!loading && !error && schema && (
        <>
          <SectionCard title="API metadata" className="mb-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              <MetaCell label="Title" value={schema.info?.title ?? 'OceanScope API'} />
              <MetaCell label="OpenAPI version" value={schema.openapi ?? '—'} mono />
              <MetaCell label="API version" value={schema.info?.version ?? '—'} mono />
            </div>
            {schema.info?.description && (
              <p className="mt-2 border-t border-[var(--os-border)] pt-2 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
                {schema.info.description}
              </p>
            )}
            <div className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
              {endpoints.length} documented path(s) · {endpoints.reduce((n, e) => n + e.operations.length, 0)} operation(s) ·
              schema fetched live from <span className="mono">/openapi.json</span>
            </div>
          </SectionCard>

          <SectionCard title="Endpoints">
            <div className="space-y-3">
              {endpoints.length === 0 && (
                <p className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>No paths in the OpenAPI schema.</p>
              )}
              {endpoints.map((entry) => (
                <div key={entry.path} className="border border-[var(--os-border)] bg-[var(--os-bg)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--os-border)] px-3 py-2">
                    <span className="mono text-[13px] font-semibold" style={{ color: 'var(--os-text)' }}>{entry.path}</span>
                    <div className="ml-auto flex gap-1.5">
                      {entry.operations.map((op) => (
                        <MethodBadge key={op.method} method={op.method} />
                      ))}
                    </div>
                  </div>
                  {entry.operations.map((op) => (
                    <OperationBlock
                      key={op.method}
                      method={op.method}
                      op={op}
                      doc={schema}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
              Request and response fields are resolved from the OpenAPI component schemas —
              the same schemas the backend uses for validation. No endpoints are documented
              here unless they exist in the live schema.
            </p>
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
}

function OperationBlock({
  method,
  op,
  doc,
}: {
  method: string;
  op: OperationDoc;
  doc: OpenApiSchemaDoc;
}) {
  const requestSchema = op.requestBody?.content?.['application/json']?.schema;
  const requestFields = schemaFields(requestSchema, doc);

  const responseSchema = op.responses?.['200']?.content?.['application/json']?.schema;
  const responseFields = schemaFields(responseSchema, doc);

  const params = op.parameters ?? [];

  return (
    <div className="border-b border-[var(--os-border)] px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <MethodBadge method={method} small />
        <span className="mono text-[12px] font-medium" style={{ color: 'var(--os-text)' }}>{op.operationId ?? method.toUpperCase()}</span>
        {op.summary && <span className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>— {op.summary}</span>}
      </div>

      {op.description && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>{op.description}</p>
      )}

      <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {params.length > 0 && (
          <SchemaTable title="Parameters" fields={params.map((p) => ({
            name: p.name,
            type: `${p.in}${p.schema ? ` · ${typeLabel(p.schema, doc)}` : ''}`,
            required: p.required ?? false,
            description: p.description,
            enum: p.schema?.enum,
          }))} />
        )}
        {requestFields.length > 0 && <SchemaTable title="Request body" fields={requestFields} />}
        {responseFields.length > 0 && <SchemaTable title="Response (200)" fields={responseFields} />}
      </div>
    </div>
  );
}

function SchemaTable({ title, fields }: { title: string; fields: SchemaField[] }) {
  return (
    <div className="min-w-0 border border-[var(--os-border)] bg-[var(--os-surface)]">
      <div className="border-b border-[var(--os-border)] px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--os-text-3)' }}>{title}</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th className="text-left">Field</th>
            <th className="text-left">Type</th>
            <th className="text-right">Req</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={`${f.name}-${i}`}>
              <td className="mono" style={{ color: 'var(--os-text)' }}>{f.name || '—'}</td>
              <td className="mono text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                {f.type}
                {f.enum ? ` · ${f.enum.join(' | ')}` : ''}
              </td>
              <td className="text-right text-[10px]" style={{ color: f.required ? 'var(--os-accent)' : 'var(--os-text-muted)' }}>
                {f.required ? 'yes' : 'no'}
              </td>
            </tr>
          ))}
          {fields.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-[10px]" style={{ color: 'var(--os-text-3)' }}>—</td>
            </tr>
          )}
        </tbody>
      </table>
      {fields.some((f) => f.description) && (
        <div className="space-y-0.5 border-t border-[var(--os-border)] px-2.5 py-1.5">
          {fields.filter((f) => f.description).map((f, i) => (
            <div key={i} className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>
              <span className="mono">{f.name}</span>: {f.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodBadge({ method, small }: { method: string; small?: boolean }) {
  const get = method.toLowerCase() === 'get';
  return (
    <span
      className={`mono font-semibold uppercase ${small ? 'text-[9px] px-1.5 py-px' : 'text-[10px] px-2 py-0.5'}`}
      style={{
        color: get ? 'var(--os-success)' : 'var(--os-accent)',
        border: `1px solid ${get ? 'rgba(74, 158, 110, 0.5)' : 'rgba(34, 211, 238, 0.5)'}`,
        background: get ? 'rgba(74, 158, 110, 0.08)' : 'rgba(34, 211, 238, 0.08)',
      }}
    >
      {method}
    </span>
  );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--os-text-muted)' }}>{label}</div>
      <div className={`mt-0.5 text-[12px] font-medium ${mono ? 'mono' : ''}`} style={{ color: 'var(--os-text)' }}>{value}</div>
    </div>
  );
}