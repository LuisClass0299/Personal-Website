/* Shared terminal-design code: the ⌘K command palette.
   A page opts in with a .t-jump button and a <dialog class="t-palette"> (see index.html);
   the items are plain links, so each page writes hrefs relative to itself. */

(() => {
  const dialog = document.querySelector('.t-palette');
  if (!dialog) return;

  const input = dialog.querySelector('input');
  const options = [...dialog.querySelectorAll('[role="option"]')];
  const empty = dialog.querySelector('.t-palette-empty');
  let returnFocusTo = null;
  let active = null;

  options.forEach((option, i) => {
    option.id = `t-palette-option-${i}`;
    option.tabIndex = -1; // focus stays in the input; arrows move aria-activedescendant
  });

  const visibleOptions = () => options.filter((option) => !option.hidden);

  function setActive(option) {
    if (active) active.removeAttribute('aria-selected');
    active = option;
    if (active) {
      active.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  // Matches the label or the command hint, e.g. "pro" or "open".
  function filter() {
    const needle = input.value.trim().toLowerCase();
    for (const option of options) option.hidden = !option.textContent.toLowerCase().includes(needle);
    const visible = visibleOptions();
    empty.hidden = visible.length > 0;
    empty.lastElementChild.textContent = input.value.trim();
    setActive(visible[0] || null);
  }

  // Safari doesn't focus a clicked button, so a click names its button as the trigger.
  function open(trigger) {
    if (dialog.open) return;
    returnFocusTo = trigger;
    input.value = '';
    filter();
    dialog.showModal();
    input.focus();
  }

  input.addEventListener('input', filter);

  input.addEventListener('keydown', (event) => {
    const visible = visibleOptions();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visible.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(visible[(visible.indexOf(active) + step + visible.length) % visible.length]);
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      dialog.close();
      active.click();
    }
  });

  // The pointer moves the same highlight as the arrows, so only one row is ever lit.
  options.forEach((option) => option.addEventListener('pointerenter', () => setActive(option)));

  document.querySelectorAll('.t-jump').forEach((button) => button.addEventListener('click', () => open(button)));

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open(document.activeElement);
    }
  });

  dialog.querySelector('.t-palette-close').addEventListener('click', () => dialog.close());

  // A click on the ::backdrop reports the dialog itself as target, from outside its box.
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (event.target === dialog && !inside) dialog.close();
  });

  dialog.addEventListener('close', () => {
    if (returnFocusTo && returnFocusTo.isConnected) returnFocusTo.focus();
    returnFocusTo = null;
  });
})();
