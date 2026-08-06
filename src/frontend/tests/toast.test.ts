// elementId: academic-year-toast
// New, reusable Toast — not a separate custom element (that would nest a second Shadow DOM
// inside whichever view uses it, forbidden by CLAUDE.md's Web Components rules). Instead,
// like settings-nav.ts's renderSettingsNav(), it's a plain shared render function
// (renderToast) plus a small state-management class (ToastController) that any top-level
// view component instantiates directly and folds into its own single shadow root. First
// user: app-academic-year-settings-view (see views/configuracion/functional-spec.json's
// academic-year-toast elementSpec).
import { describe, it, expect } from 'bun:test';
import { render } from 'lit-html';
import { ToastController } from '../src/toast';
import { renderToast } from '../src/toast';

describe('elementId: academic-year-toast — ToastController', () => {
  it('is not visible on first load (no current toast)', () => {
    const controller = new ToastController(() => {});

    expect(controller.current).toBeNull();
  });

  it('show() sets the current message and variant', () => {
    const controller = new ToastController(() => {});

    controller.show('Ya existe un año académico con ese valor', 'error');

    expect(controller.current).toEqual({ message: 'Ya existe un año académico con ese valor', variant: 'error' });
  });

  it('show() notifies via the onChange callback', () => {
    let notified = false;
    const controller = new ToastController(() => {
      notified = true;
    });

    controller.show('Some message', 'error');

    expect(notified).toBe(true);
  });

  it('dismiss() clears the current toast and notifies', () => {
    let notifyCount = 0;
    const controller = new ToastController(() => {
      notifyCount += 1;
    });
    controller.show('Some message', 'error');

    controller.dismiss();

    expect(controller.current).toBeNull();
    expect(notifyCount).toBe(2);
  });

  it('auto-dismisses without user action after the configured delay', async () => {
    const controller = new ToastController(() => {}, 10);

    controller.show('Some message', 'error');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(controller.current).toBeNull();
  });

  it('a new show() replaces any currently-showing toast instead of stacking', () => {
    const controller = new ToastController(() => {}, 10_000);

    controller.show('First message', 'error');
    controller.show('Second message', 'error');

    expect(controller.current).toEqual({ message: 'Second message', variant: 'error' });
  });

  it('a new show() resets the auto-dismiss timer', async () => {
    const controller = new ToastController(() => {}, 30);

    controller.show('First message', 'error');
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.show('Second message', 'error');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(controller.current).toEqual({ message: 'Second message', variant: 'error' });
  });
});

describe('elementId: academic-year-toast — renderToast', () => {
  it('renders nothing visible when there is no current toast', () => {
    const container = document.createElement('div');
    render(renderToast('academic-year-toast', null, () => {}), container);

    const toastEl = container.querySelector('[data-element-id="academic-year-toast"]');
    expect(toastEl === null || toastEl.textContent?.trim() === '').toBe(true);
  });

  it('renders the message when a toast is showing, tagged with the given elementId', () => {
    const container = document.createElement('div');
    render(renderToast('academic-year-toast', { message: 'Ya existe ese año académico', variant: 'error' }, () => {}), container);

    const toastEl = container.querySelector('[data-element-id="academic-year-toast"]');
    expect(toastEl?.textContent).toContain('Ya existe ese año académico');
  });

  it('clicking the dismiss control calls onDismiss', () => {
    let dismissed = false;
    const container = document.createElement('div');
    render(
      renderToast('academic-year-toast', { message: 'Some message', variant: 'error' }, () => {
        dismissed = true;
      }),
      container,
    );

    container.querySelector<HTMLElement>('[data-element-id="academic-year-toast-dismiss"]')!.click();

    expect(dismissed).toBe(true);
  });
});
