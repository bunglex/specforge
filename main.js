import './style.css';

const app = document.querySelector('#app');

const templates = {
  feature: {
    heading: 'Feature Spec',
    body: [
      '## Problem',
      '- What user pain is this solving?',
      '',
      '## Proposal',
      '- Describe the behavior and UX details.',
      '',
      '## Acceptance Criteria',
      '- [ ] Happy path works for signed-in users.',
      '- [ ] Validation and error states are handled.',
      '',
      '## Rollout',
      '- Internal dogfood for 1 week, then 10% rollout.'
    ].join('\n')
  },
  bugfix: {
    heading: 'Bugfix Spec',
    body: [
      '## Bug Summary',
      '- Explain the observed issue and expected behavior.',
      '',
      '## Reproduction Steps',
      '1. Step one',
      '2. Step two',
      '',
      '## Root Cause Hypothesis',
      '- Why do we think this happens?',
      '',
      '## Verification',
      '- [ ] Regression test added.',
      '- [ ] Manual test plan documented.'
    ].join('\n')
  },
  api: {
    heading: 'API Spec',
    body: [
      '## Endpoint',
      '- `POST /v1/example`',
      '',
      '## Request Schema',
      '- Include required fields and validation.',
      '',
      '## Response Schema',
      '- Success and error payloads with status codes.',
      '',
      '## Backward Compatibility',
      '- Define migration strategy and deprecation plan.'
    ].join('\n')
  }
};

app.innerHTML = `
  <main class="shell">
    <header>
      <h1>Specforge</h1>
      <p>Generate clean engineering spec starters in seconds.</p>
    </header>

    <section class="controls">
      <label for="template">Template</label>
      <select id="template" aria-label="Choose a template">
        <option value="feature">Feature Spec</option>
        <option value="bugfix">Bugfix Spec</option>
        <option value="api">API Spec</option>
      </select>
      <button id="generate" type="button">Generate Template</button>
    </section>

    <section>
      <h2 id="output-heading"></h2>
      <textarea id="output" rows="16" aria-label="Generated specification template"></textarea>
    </section>
  </main>
`;

const templateSelect = document.querySelector('#template');
const heading = document.querySelector('#output-heading');
const output = document.querySelector('#output');
const generateButton = document.querySelector('#generate');

function renderTemplate(key) {
  const selected = templates[key] ?? templates.feature;
  heading.textContent = selected.heading;
  output.value = selected.body;
}

generateButton.addEventListener('click', () => {
  renderTemplate(templateSelect.value);
});

renderTemplate('feature');
