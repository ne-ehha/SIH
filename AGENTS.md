# OceanScope Development Instructions

## Project
OceanScope is an SIH research/demo prototype for ocean-model verification.

## Scientific ground truth
- Research Mode uses GLORYS12V1 × Argo Delayed Mode.
- Research region is the Bay of Bengal.
- Research period is 2024-01-01 through 2024-01-15.
- Current validated Research 3D comparison window is 0–500 m.
- Difference convention is GLORYS − Argo.
- Positive difference means GLORYS is higher than Argo.
- Scientific values displayed in the UI must come from real API responses.
- Never fabricate, invent, or interpolate scientific observations merely for visualization.
- Never substitute HYCOM for Research Mode.
- HYCOM is operational functionality and must remain separate.

## Research 3D
- The Research 3D inspector represents a real latitude × longitude × depth water-column comparison.
- It uses actual Argo/GLORYS collocation data.
- The pyramid is an INVERTED pyramid:
  - widest at 0 m surface
  - progressively narrower with increasing depth
  - narrow apex at the deepest displayed level
- The current validated depth range is 0–500 m.
- This is a water-column visualization, not physical bathymetry.
- Do not add an ocean-floor/bathymetry interpretation unless explicitly requested with a real dataset.
- Preserve real profile/platform/cycle/depth/value relationships.

## Existing application behavior
- Preserve existing scientific graphs and tables unless the current task explicitly requires changing them.
- Preserve existing observation/profile selection behavior.
- Arbitrary globe clicks are navigation only and must not become scientific observations.
- Only real observation/collocated markers may drive Research 3D selection.
- Preserve the existing API/data contracts unless the current task explicitly requires a contract change.

## Development workflow
- Work in clearly defined phases.
- Before implementation, inspect the relevant existing code and understand the current behavior.
- Make the smallest changes necessary for the requested phase.
- Prefer modifying existing components over creating parallel incompatible systems.
- Keep frontend, backend, data processing, and scientific calculations separated.
- After frontend changes, run the existing frontend build.
- If a build fails because of the current change, fix the relevant issue and rerun the build.
- Do not expand the task to unrelated cleanup.

## Git safety
- Never reset, checkout, stash, discard, or overwrite existing user changes unless explicitly instructed.
- Never modify the stable research prototype branch/tag.
- Do not commit or push unless explicitly instructed by the user.
- Do not add .DS_Store files.
- Preserve unrelated working-tree changes.
- Before completing a task, verify which source files changed.

## Scope control
- When a task specifies allowed files, modify only those files unless a necessary dependency makes another file unavoidable.
- If another file is genuinely required, explain why before modifying it.
- Do not install or upgrade packages unless explicitly requested or clearly necessary.
- Do not change deployment configuration during ordinary feature work.
- Do not change datasets during frontend work.
- Do not change scientific calculations during visual-only work.

## Autonomy
- For work explicitly requested by the user, proceed through implementation, verification, and build without repeatedly asking for approval for routine reversible actions.
- Routine read-only inspection, code edits within the authorized scope, local builds, tests, and diff checks are authorized when they are necessary to complete the requested task.
- Ask before destructive or irreversible actions such as reset, checkout, stash/discard, deleting unrelated files, committing, pushing, deployment, or changing the scientific dataset/model.
- If the task has an explicitly defined scope, treat that scope as authorization to complete the work within that boundary.
- Do not stop after merely describing what could be done; complete the authorized work.

## Completion report
At the end of each implementation task, report:
1. Files changed.
2. What changed.
3. Build/test result.
4. Any warnings or remaining issues.
5. Any action that requires explicit user approval.
