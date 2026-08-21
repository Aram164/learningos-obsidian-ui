import type { HomeView } from '../../views/home-view';
import {
  button,
  empty,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asText as projectedText,
} from '../../projection/readers';
import {
  type HomeItem,
  readResumePointer,
  firstProjectedModuleId,
} from './model';

export function renderContinue(
  view: HomeView,

    root: HTMLElement,
  ): void {
    const pointer = readResumePointer(
      view.plugin.store.data?.resume_pointer,
    );

    const unit = pointer.unit_id
      ? view.plugin.store.get(pointer.unit_id)
      : null;

    const map = pointer.study_map_id
      ? view.plugin.store.get(
        pointer.study_map_id,
      )
      : null;

    const stage = pointer.stage_id
      ? view.plugin.store.stage(
        pointer.stage_id,
      )
      : null;

    const wrap = root.createDiv({
      cls: 'los-continue',
    });

    if (
      !unit
      || !stage
      || !pointer.unit_id
      || !pointer.stage_id
    ) {
      empty(
        wrap,
        'Nothing to resume yet',
        'Open Learn and choose a module or project.',
        'Open Learn',
        () => view.plugin.openLearn(),
      );

      return;
    }

    wrap.createDiv({
      cls: 'los-kicker',
      text: 'Continue learning',
    });

    const body = wrap.createDiv({
      cls: 'los-continue-body',
    });

    const copy = body.createDiv({
      cls: 'los-continue-copy',
    });

    const unitModuleId =
      projectedString(unit.module_id);

    const module = unitModuleId
      ? view.plugin.store.get(unitModuleId)
      : null;

    copy.createDiv({
      cls: 'los-continue-module',
      text: `${
        module
          ? projectedLabel(module)
          : unitModuleId ?? 'Unknown module'
      } · ${projectedLabel(unit)}`,
    });

    copy.createEl('h2', {
      text: projectedLabel(stage),
    });

    const stages =
      projectedRecords(map?.stages);

    const position = stages.findIndex(
      (row: ProjectionRecord) =>
        projectedString(row.id)
        === pointer.stage_id,
    );

    const meta = copy.createDiv({
      cls: 'los-continue-meta',
    });

    if (stages.length) {
      meta.createSpan({
        text:
          `Stage ${
            position >= 0
              ? position + 1
              : 1
          } of ${stages.length}`,
      });
    }

    const estimate = projectedText(
      stage.estimate_minutes,
    );

    if (estimate) {
      meta.createSpan({
        text: `${estimate} min planned`,
      });
    }

    copy.createDiv({
      cls: 'los-continue-context',
      text:
        'Your selected stage, exact resources, and open working state are kept together.',
    });

    const actions = body.createDiv({
      cls: 'los-actions',
    });

    button(
      actions,
      'Continue session',
      () =>
        view.plugin.openUnit(
          pointer.unit_id as string,
          pointer.stage_id as string,
        ),
      'cta',
    );
  }

export function renderToday(
  view: HomeView,

    root: HTMLElement,
  ): void {
    const sectionEl = section(
      root,
      'Today',
      'Only items likely to affect the next decision.',
    );

    const items: HomeItem[] = [];

    const today =
      new Date().toISOString().slice(0, 10);

    const upcoming =
      view.plugin.store
        .rows('academic_deadlines')
        .filter(
          (row: ProjectionRecord) => {
            const boundary =
              projectedString(row.end_date)
              ?? projectedString(
                row.start_date,
              )
              ?? '';

            return boundary >= today;
          },
        )
        .sort(
          (
            left: ProjectionRecord,
            right: ProjectionRecord,
          ) => {
            const leftDate =
              projectedString(
                left.start_date,
              )
              ?? projectedString(
                left.end_date,
              )
              ?? '';

            const rightDate =
              projectedString(
                right.start_date,
              )
              ?? projectedString(
                right.end_date,
              )
              ?? '';

            return leftDate.localeCompare(
              rightDate,
            );
          },
        );

    for (
      const deadline of upcoming.slice(0, 2)
    ) {
      const moduleId =
        projectedString(deadline.module_id)
        ?? firstProjectedModuleId(
          deadline.modules,
        );

      const kind =
        projectedString(deadline.kind);

      const label =
        projectedString(deadline.label);

      const title =
        kind === 'registration-window'
          ? label
            ?? projectedLabel(deadline)
          : projectedString(deadline.title)
            ?? label
            ?? projectedLabel(deadline);

      const startDate =
        projectedString(deadline.start_date);

      const endDate =
        projectedString(deadline.end_date);

      const date =
        endDate
        && startDate
        && endDate !== startDate
          ? `${startDate} → ${endDate}`
          : startDate
            ?? endDate
            ?? 'Date pending';

      const registrationState =
        projectedString(
          deadline.registration_state,
        );

      const registrationDetail =
        registrationState
        && registrationState !== 'registered'
          ? ` · ${registrationState}`
          : '';

      items.push({
        title,
        detail:
          `${date}${registrationDetail}`,
        actionLabel:
          moduleId
            ? 'Open module'
            : '',
        action:
          moduleId
            ? () =>
              view.plugin.openModule(
                moduleId,
              )
            : null,
      });
    }

    // Home never reverse-engineers a queue. Core publishes the exact decision
    // records and their reasons; this surface only gives the queue one quiet
    // entry point.
    const reviewItems =
      view.plugin.store.reviewItems();

    const reviewCount = reviewItems.length;

    if (reviewCount) {
      const categories = new Map<string, number>();

      for (const item of reviewItems) {
        const category =
          projectedString(item.category)
          ?? 'other';

        categories.set(
          category,
          (categories.get(category) ?? 0) + 1,
        );
      }

      const details = [...categories.entries()]
        .map(([category, count]) =>
          `${count} ${category.replaceAll('-', ' ')}`,
        );

      items.push({
        title:
          `${reviewCount} decision${
            reviewCount === 1
              ? ''
              : 's'
          } waiting`,
        detail: details.join(' · '),
        actionLabel: 'Open review',
        action:
          () => view.plugin.openReview(),
      });
    }

    if (!items.length) {
      empty(
        sectionEl,
        'Nothing time-sensitive',
        'Continue the active learning session when you are ready.',
      );

      return;
    }

    const list = sectionEl.createDiv({
      cls: 'los-home-list',
    });

    for (
      const item of items.slice(0, 4)
    ) {
      view.renderHomeRow(
        list,
        item,
      );
    }
  }
