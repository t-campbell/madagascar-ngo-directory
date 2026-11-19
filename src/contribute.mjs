for (const button of document.querySelectorAll('[data-copy]')) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy);
    const status = button.parentElement.querySelector('[role=status]');
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = 'Template copied.';
    } catch {
      field.focus();
      field.select();
      status.textContent = 'Template selected. Use your device’s copy command.';
    }
  });
}

function openEvidence() {
  const details = document.querySelector('#sources');
  if (details && location.hash.startsWith('#source-')) details.open = true;
}
openEvidence();
window.addEventListener('hashchange', openEvidence);
