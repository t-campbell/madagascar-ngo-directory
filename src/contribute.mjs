const form = document.querySelector('#submission-form');
if (form) {
  const button = form.querySelector('button[type=submit]');
  const status = document.querySelector('#submission-status');
  const params = new URLSearchParams(location.search);
  const kind = form.elements.namedItem('kind');
  const organisation = form.elements.namedItem('organisation');
  const requestedKind = params.get('kind') ?? (location.hash === '#confirm' ? 'confirmation' : '');
  if (!kind.value && [...kind.options].some(option => option.value === requestedKind)) kind.value = requestedKind;
  if (!organisation.value) organisation.value = (params.get('organisation') ?? '').slice(0, organisation.maxLength);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form))
      });
      const { message } = await response.json();
      status.textContent = message;
      if (response.status === 202) form.reset();
    } catch {
      status.textContent = 'Could not send the suggestion. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}

function openEvidence() {
  const details = document.querySelector('#sources');
  if (details && location.hash.startsWith('#source-')) details.open = true;
}
openEvidence();
window.addEventListener('hashchange', openEvidence);
