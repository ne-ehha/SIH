/**
 * DatasetFindings — dataset-level verified findings for the GLORYS12V1 × Argo
 * collocation dataset (Bay of Bengal, Jan 2024, 1,220 records).
 *
 * Values are validated results identical to the backend-verified statistics —
 * they are surfaced here as observed evidence, never fabricated. Hypotheses are
 * explicitly labelled as candidate explanations, not proven causes.
 */
export function DatasetFindings() {
  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)]">
      <header className="border-b border-[var(--os-border)] px-3 py-2">
        <div className="text-[13px] font-semibold text-[var(--os-text)]">
          Dataset-level findings
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--os-text-3)]">
          GLORYS12V1 × Argo Delayed Mode · Bay of Bengal · 01–15 Jan 2024 · 1,220 collocated records · difference = GLORYS − Argo
        </div>
      </header>

      <div className="space-y-4 p-3">
        {/* Summary statistics */}
        <section>
          <div className="section-label mb-1.5">Summary statistics</div>
          <div className="panel overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="text-right">Temperature</th>
                  <th className="text-right">Salinity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-[var(--os-text-2)]">Bias (GLORYS − Argo)</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-pos)' }}>+0.2477 °C</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-neg)' }}>−0.0368 PSU</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">MAE</td>
                  <td className="mono text-right">0.3720 °C</td>
                  <td className="mono text-right">0.1717 PSU</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">RMSE</td>
                  <td className="mono text-right">0.5438 °C</td>
                  <td className="mono text-right">0.3601 PSU</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">Positive errors</td>
                  <td className="mono text-right">795 / 1220 (65.2%)</td>
                  <td className="mono text-right text-[var(--os-text-3)]">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Depth-band analysis */}
        <section>
          <div className="section-label mb-1.5">Temperature depth response</div>
          <div className="panel overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Depth band</th>
                  <th className="text-right">Mean Δ (°C)</th>
                  <th className="text-right">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">0–50 dbar</td>
                  <td className="mono text-right">+0.0005</td>
                  <td className="text-right text-[var(--os-text-3)]">near zero</td>
                </tr>
                <tr>
                  <td className="mono">50–100 dbar</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-pos)' }}>+0.6989</td>
                  <td className="text-right text-[var(--os-diff-pos)]">strongest</td>
                </tr>
                <tr>
                  <td className="mono">100–200 dbar</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-pos)' }}>+0.4949</td>
                  <td className="text-right text-[var(--os-diff-pos)]">strong</td>
                </tr>
                <tr>
                  <td className="mono">200–300 dbar</td>
                  <td className="mono text-right">+0.1570</td>
                  <td className="text-right text-[var(--os-text-3)]">moderate</td>
                </tr>
                <tr>
                  <td className="mono">300–500 dbar</td>
                  <td className="mono text-right">−0.0404</td>
                  <td className="text-right text-[var(--os-text-3)]">near zero</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--os-text-3)]">
            Strongest discrepancy: 50–200 dbar. Largest latitude-band bias: +0.7222 °C at 9–11°N
            (within 50–200 dbar). Temperature bias is positive on every sampled observation date.
          </p>
        </section>

        {/* Reference date detail — Jan 10 */}
        <section>
          <div className="section-label mb-1.5">10 January 2024 reference date</div>
          <div className="panel overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="text-right">Temperature</th>
                  <th className="text-right">Salinity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-[var(--os-text-2)]">Real records</td>
                  <td className="mono text-right">206</td>
                  <td className="mono text-right">206</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">Argo mean</td>
                  <td className="mono text-right">18.3658 °C</td>
                  <td className="mono text-right">34.5613</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">GLORYS mean</td>
                  <td className="mono text-right">18.8640 °C</td>
                  <td className="mono text-right">34.4512</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">Mean difference</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-pos)' }}>+0.4982 °C</td>
                  <td className="mono text-right" style={{ color: 'var(--os-diff-neg)' }}>−0.1101</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">RMS</td>
                  <td className="mono text-right">0.7341 °C</td>
                  <td className="mono text-right">0.2818</td>
                </tr>
                <tr>
                  <td className="text-[var(--os-text-2)]">Max |Δ|</td>
                  <td className="mono text-right">1.7062 °C</td>
                  <td className="mono text-right">1.0056</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Evidence vs interpretation separation */}
        <section className="border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2.5">
          <div className="section-label mb-1">Observed fact</div>
          <p className="text-[12px] leading-relaxed text-[var(--os-text-2)]">
            GLORYS temperature is systematically warmer than Argo in the 50–200 dbar range,
            with the largest mean bias at 50–100 dbar (+0.6989 °C). The positive bias persists
            on all nine sampled observation dates.
          </p>
          <div className="section-label mb-1 mt-3">Interpretation (hypothesis, not proven cause)</div>
          <p className="text-[12px] leading-relaxed text-[var(--os-text-2)]">
            The depth structure is consistent with a model vertical-structure / mixing
            representation issue near the thermocline. This remains a candidate explanation
            requiring targeted diagnostics.
          </p>
          <div className="section-label mb-1 mt-3">Recommended investigation</div>
          <p className="text-[12px] leading-relaxed text-[var(--os-text-2)]">
            Inspect additional profiles and time periods; compare against independent
            observations before any correction is proposed.
          </p>
        </section>
      </div>
    </div>
  );
}