function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "-";

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-md bg-paper p-4">
            {renderValue(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <dl className="space-y-3">
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div key={key}>
            <dt className="text-xs font-semibold uppercase text-muted">{key}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{renderValue(nestedValue)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return String(value);
}

export default function GeneratedSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-5 text-sm leading-6 text-ink">{renderValue(value)}</div>
    </section>
  );
}
