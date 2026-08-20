import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackHandler, returnToHome } from '../src/back-controller.js';

function createEnvironment({ openOverlay = false } = {}) {
  let clicked = false;
  let hidden = !openOverlay;
  let scrollOptions;
  const closeButton = { click: () => { clicked = true; hidden = true; } };
  const overlay = {
    querySelector: () => closeButton,
    setAttribute: () => { hidden = true; },
  };
  const document = {
    querySelector: (selector) => {
      if (selector === '#modal.open, #modal[aria-hidden="false"]') return hidden ? null : overlay;
      return { focus: () => {} };
    },
  };
  const window = { scrollTo: (options) => { scrollOptions = options; } };
  return { document, window, state: () => ({ clicked, hidden, scrollOptions }) };
}

test('home -> PRO -> back closes the PRO sheet before leaving the app', () => {
  const environment = createEnvironment({ openOverlay: true });
  assert.equal(returnToHome(environment), 'overlay-closed');
  assert.equal(environment.state().clicked, true);
});

test('home -> calculation detail -> back closes the internal detail sheet', () => {
  const environment = createEnvironment({ openOverlay: true });
  assert.equal(returnToHome(environment), 'overlay-closed');
  assert.equal(environment.state().hidden, true);
});

test('home -> internal screen -> back returns to home without exit', () => {
  const environment = createEnvironment();
  assert.equal(returnToHome(environment), 'home');
  assert.deepEqual(environment.state().scrollOptions, { top: 0, behavior: 'instant' });
});

test('the same handler is reusable for native and browser back events', () => {
  const environment = createEnvironment({ openOverlay: true });
  const handleBack = createBackHandler(environment);
  assert.equal(handleBack(), 'overlay-closed');
  assert.equal(handleBack(), 'home');
});
