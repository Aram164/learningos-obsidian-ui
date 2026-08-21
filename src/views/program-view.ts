import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import {
  badge,
  button,
  disclosure,
  empty,
  localFilePath,
  pageHeader,
  projectedExcerpt,
  section,
  unitCard,
} from '../components';
import { LEARN_AREAS, VIEW_PROGRAM } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { errorMessage, isRecord } from '../projection/readers';
import { enableButtonGroupKeyboardNavigation } from '../accessibility/button-group';

interface ProgramViewState {
  programId?: string | null;
}

interface ProgramSemester {
  readonly title: string;
  readonly status: string;
}

type ProgramPlugin = Pick<
  AppSurface,
  | 'clearInboxDraft'
  | 'gateway'
  | 'generate'
  | 'getInboxDraft'
  | 'mutate'
  | 'setInboxDraft'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openLearn'
    | 'openModule'
    | 'openProjects'
    | 'openUnit'
  >;
};

const COORDINATION_HEADINGS = [
  'Priorities',
  'Commitments',
  'Dependencies',
  'Deferrals',
] as const;

function readProgramSemesters(
  value: unknown,
): ProgramSemester[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const semesters: ProgramSemester[] = [];

  for (const candidate of value) {
    if (
      !isRecord(candidate)
      || typeof candidate.title !== 'string'
      || typeof candidate.status !== 'string'
    ) {
      continue;
    }

    semesters.push({
      title: candidate.title,
      status: candidate.status,
    });
  }

  return semesters;
}

export class ProgramView extends ItemView {
  private readonly plugin: ProgramPlugin;
  private programId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ProgramPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_PROGRAM;
  }

  getDisplayText() {
    if (this.programId === 'inbox') {
      return 'LearningOS · Capture';
    }

    if (this.programId === 'queue-needs-map') {
      return 'LearningOS · Planning';
    }

    const program = this.programId
      ? this.plugin.store.get(this.programId)
      : null;
    const title = typeof program?.title === 'string'
      ? program.title
      : 'Learn';

    return `LearningOS · ${title}`;
  }

  async setState(
    state: ProgramViewState = {},
  ): Promise<void> {
    if (typeof state.programId === 'string') {
      this.programId = state.programId;
    }

    this.render();
    this.leaf.updateHeader?.();
  }

  getState(): ProgramViewState {
    return {
      programId: this.programId,
    };
  }

  async onOpen(): Promise<void> {
    const programId = this.leaf.state?.programId;

    if (typeof programId === 'string') {
      this.programId = programId;
    }

    this.render();
    this.leaf.updateHeader?.();
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-program-view');

    // The Navigator can reach this view whatever the projection's health, so it
    // has to degrade like Home rather than throw on a null manifest.
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'LearningOS',
        'Projection unavailable',
      );
      empty(
        root,
        'The interface contract could not be loaded',
        this.plugin.store.error,
        'Rebuild views',
        () => this.plugin.generate(),
      );
      return;
    }

    if (this.programId === 'queue-needs-map') {
      this.renderNeedsMap(root);
      return;
    }

    if (this.programId === 'inbox') {
      this.renderInbox(root);
      return;
    }

    const program = this.programId
      ? this.plugin.store.get(this.programId)
      : null;

    if (!program) {
      empty(
        root,
        'Area unavailable',
        'Return Home and choose another area.',
      );
      return;
    }

    pageHeader(
      root,
      'Learn',
      'Learning horizon',
      'Current commitments, long-running skills, and the degree structure they belong to.',
    );

    // The areas are sub-areas of one destination now, so the switcher lives in
    // the page rather than eating three permanent sidebar slots.
    const tabs = root.createDiv({
      cls: 'los-tabs los-program-tabs',
      attr: {
        role: 'group',
        'aria-label': 'Learning areas',
      },
    });
    enableButtonGroupKeyboardNavigation(tabs);

    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(
        tabs,
        title,
        () => this.plugin.nav.openLearn(areaId),
        active ? 'cta' : 'quiet',
      );

      tab.setAttrs({
        'aria-pressed': String(active),
      });
    }

    if (
      typeof program.description === 'string'
      && program.description
    ) {
      root.createEl('p', {
        cls: 'los-muted',
        text: program.description,
      });
    }

    const semesters = readProgramSemesters(
      program.semesters,
    );

    const currentSemester = semesters.find(
      (semester) => semester.status === 'current',
    );

    const modules = program.id
      ? this.plugin.store.modulesFor(program.id)
      : [];

    const context = root.createDiv({
      cls: 'los-learning-context',
    });

    context.createEl('h2', {
      text:
        currentSemester?.title
        ?? (
          program.id === 'program-skills'
            ? 'Long-running tracks'
            : projectedExcerpt(
              program.title,
              80,
            ) || 'Learning'
        ),
    });

    context.createSpan({
      text:
        `${modules.length} commitment${
          modules.length === 1 ? '' : 's'
        } · ${
          currentSemester?.status
          ?? projectedExcerpt(program.status, 40)
        }`,
    });

    const list = root.createDiv({
      cls: 'los-learning-list',
    });

    if (!modules.length) {
      if (program.id === 'program-thesis-projects') {
        empty(
          root,
          'Projects have their own operating space',
          'The horizon keeps the commitment visible; project structure, decisions, and files stay together in Projects.',
          'Open Projects',
          () => this.plugin.nav.openProjects(),
        );
      } else {
        empty(
          root,
          'No commitments in this area yet',
          'Nothing is hidden.',
        );
      }
    }

    for (const module of modules) {
      const row = list.createDiv({
        cls: 'los-learning-row',
      });

      const copy = row.createDiv({
        cls: 'los-learning-copy',
      });

      const title = button(
        copy,
        projectedExcerpt(
          module.title,
          180,
        ) || projectedExcerpt(module.id, 180),
        () => this.plugin.nav.openModule(
          projectedExcerpt(module.id, 180),
        ),
        'row',
      );

      title.addClass('los-learning-title');

      const examination = isRecord(
        module.examination,
      )
        ? projectedExcerpt(
          module.examination.type,
          80,
        )
        : '';

      const meta = [
        projectedExcerpt(module.status, 60),
        module.credits
          ? `${projectedExcerpt(module.credits, 20)} LP`
          : '',
        examination,
      ]
        .filter(Boolean)
        .join(' · ');

      row.createDiv({
        cls: 'los-learning-meta los-micro',
        text: meta,
      });
    }

    if (Boolean(program.semester_bound)) {
      const semesters = disclosure(root, 'Semesters');

      for (
        const semester of readProgramSemesters(program.semesters)
      ) {
        const row = semesters.createDiv({
          cls: 'los-row',
        });

        row.createEl('strong', {
          text: semester.title,
        });

        badge(
          row,
          semester.status,
          semester.status,
        );
      }
    }

    this.renderCoordination(root);
  }

  /**
   * The full coordination record — commitments, dependencies, deferrals — moved
   * off Home to here. Home carries the one-line priority; this is where the
   * whole decision layer is read when the learner actually wants it.
   */
  renderCoordination(
    root: HTMLElement,
  ): void {
    const coordination =
      this.plugin.store.get('coordination');

    const sections = isRecord(coordination?.sections)
      ? coordination.sections
      : {};

    const rows: Array<readonly [string, string]> =
      COORDINATION_HEADINGS
        .map(
          (heading): readonly [string, string] => [
            heading,
            projectedExcerpt(
              sections[heading],
              1600,
            ),
          ],
        )
        .filter((row) => Boolean(row[1]));

    if (!rows.length) {
      return;
    }

    const panel = disclosure(
      root,
      'Semester coordination',
      'los-coordination-details',
    );

    for (const [heading, body] of rows) {
      const row = panel.createDiv({
        cls: 'los-coordination-row',
      });

      row.createEl('strong', {
        text: heading,
      });

      row.createEl('p', {
        text: body,
      });
    }
  }

  renderNeedsMap(
    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Review',
      'Units needing a study map',
    );

    const grid = root.createDiv({
      cls: 'los-card-grid',
    });

    const units = this.plugin.store.units().filter(
      (row: ProjectionRecord) =>
        !row.id || !this.plugin.store.mapForUnit(row.id),
    );

    for (const unit of units) {
      unitCard(grid, this.plugin, unit);
    }
  }

  renderInbox(
    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      '',
      'Capture',
      'You capture; the operator files.',
    );

    const count =
      this.plugin.store.data?.counts?.inbox_items || 0;

    const wrap = section(
      root,
      `${count} item${count === 1 ? '' : 's'} awaiting routing`,
    );

    const form = wrap.createDiv({
      cls: 'los-capture-grid',
    });

    const textPanel = form.createDiv({
      cls: 'los-capture-panel',
    });

    textPanel.createEl('h3', {
      text: 'Quick text',
    });

    const title = textPanel.createEl('input', {
      cls: 'los-search los-capture-title',
      attr: {
        type: 'text',
        placeholder: 'Optional title',
        'aria-label': 'Capture title',
      },
    });

    const editor = textPanel.createEl('textarea', {
      cls: 'los-note-editor los-capture-editor',
      attr: {
        placeholder:
          'Paste a link, thought, question, or fragment…',
        'aria-label': 'Capture text',
      },
    });

    const draft = this.plugin.getInboxDraft();

    title.value = draft.title || '';
    editor.value = draft.text || '';

    const status = textPanel.createDiv({
      cls: 'los-draft-status',
      attr: {
        'aria-live': 'polite',
      },
    });

    const captureButton = button(
      textPanel,
      'Capture text',
      () => {
        const text = editor.value.trim();

        if (!text) {
          new Notice(
            'Enter some text before capturing.',
          );
          editor.focus();
          return;
        }

        this.capture(
          () =>
            this.plugin.gateway.captureText(
              text,
              title.value.trim(),
            ),
          () => {
            this.plugin.clearInboxDraft();
            editor.value = '';
            title.value = '';
          },
        );
      },
      'cta',
    );

    const syncDraft = (): void => {
      const hasDraft = Boolean(
        title.value || editor.value,
      );

      this.plugin.setInboxDraft(
        title.value,
        editor.value,
      );

      captureButton.disabled =
        !editor.value.trim();

      status.setText(
        hasDraft
          ? 'Draft kept locally until capture.'
          : 'Nothing entered yet.',
      );

      status.toggleClass(
        'is-dirty',
        hasDraft,
      );
    };

    title.addEventListener(
      'input',
      syncDraft,
    );

    editor.addEventListener(
      'input',
      syncDraft,
    );

    captureButton.disabled =
      !editor.value.trim();

    status.setText(
      title.value || editor.value
        ? 'Draft kept locally until capture.'
        : 'Nothing entered yet.',
    );

    status.toggleClass(
      'is-dirty',
      Boolean(title.value || editor.value),
    );

    const filePanel = form.createDiv({
      cls: 'los-capture-panel',
    });

    filePanel.createEl('h3', {
      text: 'File or handwriting',
    });

    filePanel.createEl('p', {
      cls: 'los-muted',
      text:
        'The original is copied into the inbox; it is not moved or renamed.',
    });

    const picker = filePanel.createEl('input', {
      cls: 'los-file-input los-capture-file',
      attr: {
        type: 'file',
        'aria-label':
          'Choose inbox capture file',
      },
    });

    const fileCaptureButton = button(
      filePanel,
      'Capture selected file',
      () => {
        const localPath =
          localFilePath(picker.files?.[0]);

        if (!localPath) {
          new Notice(
            'Choose a local file first.',
          );
          return;
        }

        this.capture(
          () =>
            this.plugin.gateway.captureFile(
              localPath,
            ),
          () => {
            picker.value = '';
          },
        );
      },
      'quiet',
    );

    const syncFileCapture = (): void => {
      fileCaptureButton.disabled =
        !picker.files?.length;
      fileCaptureButton.setAttribute(
        'aria-disabled',
        String(fileCaptureButton.disabled),
      );
    };

    picker.addEventListener(
      'change',
      syncFileCapture,
    );
    syncFileCapture();
  }

  async capture(
    action: () => Promise<unknown>,
    clear: (() => void) | null = null,
  ): Promise<void> {
    if (this.plugin.gateway.isBusy) {
      new Notice(
        'Queued behind the running LearningOS write.',
      );
    }

    try {
      await this.plugin.mutate(
        async () => {
          await action();

          await this.plugin.gateway.call(
            ['generate'],
            {
              expectJson: false,
            },
          );
        },
      );

      // Only after the core confirmed the capture in JSON — clearing earlier
      // is what used to lose the thought when the CLI answered with garbage.
      clear?.();

      new Notice(
        'Captured to the LearningOS inbox.',
      );

      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }
}
